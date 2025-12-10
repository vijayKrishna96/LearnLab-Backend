// controllers/paymentController.js
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Course = require("../models/courseModel");
const Payment = require("../models/paymentModel");
const { Student, Instructor, User } = require("../models/userModel");
const mongoose = require("mongoose");

/**
 * Create Stripe checkout session
 * POST /payment/create-checkout
 */
const createCheckout = async (req, res) => {
  const { courseIds, userId } = req.body;

  // Validate request
  if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
    return res.status(400).json({ 
      error: "Invalid course IDs",
      message: "Course IDs must be a non-empty array" 
    });
  }

  // Verify authenticated user matches request
  if (req.user.id !== userId) {
    return res.status(403).json({ 
      error: "Unauthorized",
      message: "User ID mismatch" 
    });
  }

  try {
    // Fetch courses from database
    const courses = await Course.find({ _id: { $in: courseIds } })
      .select("_id title price image instructor")
      .populate("instructor", "name");

    if (courses.length !== courseIds.length) {
      return res.status(404).json({ 
        error: "Courses not found",
        message: "Some courses in the cart no longer exist" 
      });
    }

    // Check if user already owns any of these courses
    const user = await User.findById(userId).select("courses");
    
    // FIX: Check if user.courses exists before using includes
    const userCourses = user.courses || [];
    const alreadyOwned = courses.filter(course => 
      userCourses.includes(course._id.toString())
    );

    if (alreadyOwned.length > 0) {
      return res.status(400).json({
        error: "Courses already owned",
        message: "You already own some of these courses",
        ownedCourses: alreadyOwned.map(c => c.title)
      });
    }

    // Create line items for Stripe
    const lineItems = courses.map((course) => ({
      price_data: {
        currency: "inr",
        product_data: {
          name: course.title,
          images: course.image?.url ? [course.image.url] : [],
          metadata: {
            courseId: course._id.toString(),
            instructorId: course.instructor._id.toString(),
          }
        },
        unit_amount: Math.round(course.price * 100),
      },
      quantity: 1,
    }));

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      // FIXED: Use template literal to properly handle the placeholder
      success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cart?canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId,
        courseIds: JSON.stringify(courseIds),
        instructorIds: JSON.stringify(courses.map(c => c.instructor._id.toString())),
      },
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes from now
      automatic_tax: { enabled: false },
    });

    // Create pending payment record
    await Payment.create({
      userId,
      sessionId: session.id,
      courseIds,
      amount: courses.reduce((sum, c) => sum + c.price, 0),
      status: "pending",
      createdAt: new Date(),
    });

    res.json({ 
      sessionId: session.id, 
      url: session.url,
      success: true 
    });

  } catch (error) {
    console.error("Stripe checkout error:", error);
    res.status(500).json({ 
      error: "Checkout failed",
      message: error.message || "Failed to create checkout session" 
    });
  }
};

/**
 * Verify payment and complete purchase
 * POST /payment/verify
 * IMPORTANT: This should be called from frontend after redirect
 */
const verifyPayment = async (req, res) => {
  const { sessionId } = req.body;
  const userId = req.user.id;

  if (!sessionId) {
    return res.status(400).json({ 
      error: "Missing session ID",
      message: "Session ID is required" 
    });
  }

  try {
    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify session belongs to user
    if (session.client_reference_id !== userId) {
      return res.status(403).json({ 
        error: "Unauthorized",
        message: "Session does not belong to user" 
      });
    }

    // Check payment status
    if (session.payment_status !== "paid") {
      return res.status(400).json({ 
        error: "Payment not completed",
        message: "Payment was not successful",
        success: false 
      });
    }

    // Check if already processed (idempotency)
    const existingPayment = await Payment.findOne({ 
      sessionId, 
      status: "completed" 
    });

    if (existingPayment) {
      return res.json({
        success: true,
        courseIds: existingPayment.courseIds,
        message: "Payment already processed",
        alreadyProcessed: true
      });
    }

    // Parse metadata
    const courseIds = JSON.parse(session.metadata.courseIds);
    const instructorIds = JSON.parse(session.metadata.instructorIds);

    // Process enrollment
    await processEnrollment(userId, courseIds, instructorIds, sessionId, session.payment_intent);

    res.json({
      success: true,
      courseIds,
      message: "Payment verified and courses enrolled successfully"
    });

  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ 
      error: "Verification failed",
      message: error.message || "Failed to verify payment",
      success: false 
    });
  }
};

/**
 * Process course enrollment (shared between verify and webhook)
 */
const processEnrollment = async (userId, courseIds, instructorIds, sessionId, paymentIntentId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Add courses to student's purchasedCourses
    const student = await Student.findById(userId).session(session);
    
    if (!student) {
      throw new Error(`Student not found: ${userId}`);
    }

    // Prevent duplicate purchases
    const alreadyPurchased = student.purchasedCourses
      .map(p => p.course.toString())
      .filter(id => courseIds.includes(id));

    if (alreadyPurchased.length > 0) {
      console.warn(`User ${userId} already owns courses: ${alreadyPurchased}`);
      // Don't throw error - mark as completed anyway to prevent retry
    } else {
      // Add new purchases
      const newPurchases = courseIds.map(courseId => ({
        course: courseId,
        purchasedAt: new Date()
      }));
      
      student.purchasedCourses.push(...newPurchases);
    }

    // 2. Initialize course progress for new purchases
    const newProgressEntries = courseIds
      .filter(id => !student.courseProgress.some(p => p.course.toString() === id))
      .map(courseId => ({
        course: courseId,
        progress: 0,
        lastViewed: new Date()
      }));
    
    student.courseProgress.push(...newProgressEntries);

    // 3. Clear purchased courses from cart
    student.cart = student.cart.filter(
      cartCourse => !courseIds.includes(cartCourse.toString())
    );

    await student.save({ session });

    // 4. Update courses (increment enrolled students)
    await Course.updateMany(
      { _id: { $in: courseIds } },
      { $inc: { enrolledStudents: 1 } },
      { session }
    );

    // 5. Update instructors' stats
    for (let i = 0; i < courseIds.length; i++) {
      const courseId = courseIds[i];
      const instructorId = instructorIds[i];
      
      const course = await Course.findById(courseId).session(session);
      if (course && instructorId) {
        await Instructor.findByIdAndUpdate(
          instructorId,
          { 
            $inc: { 
              totalIncome: course.price,
              studentsTaughtCount: 1 
            }
          },
          { session }
        );
      }
    }

    // 6. Update payment record
    await Payment.findOneAndUpdate(
      { sessionId },
      { 
        status: "completed",
        completedAt: new Date(),
        paymentIntentId
      },
      { session }
    );

    await session.commitTransaction();
    console.log(`✅ Successfully enrolled user ${userId} in ${courseIds.length} courses`);

  } catch (error) {
    await session.abortTransaction();
    console.error("Enrollment processing error:", error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Webhook handler for Stripe events
 * POST /payment/webhook
 * CRITICAL: This is the authoritative source of payment completion
 */
// Helper function (add before webhook)

const webHook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).send("Webhook secret not configured");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody || req.body,
      sig, 
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        console.log(`✅ Payment successful for session: ${session.id}`);

        const existingPayment = await Payment.findOne({ 
          sessionId: session.id, 
          status: "completed" 
        });

        if (existingPayment) {
          console.log(`Session ${session.id} already processed`);
          break;
        }

        if (session.payment_status === "paid") {
          const userId = session.client_reference_id;
          const courseIds = JSON.parse(session.metadata.courseIds);
          const instructorIds = JSON.parse(session.metadata.instructorIds);

          await processEnrollment(
            userId, 
            courseIds, 
            instructorIds, 
            session.id, 
            session.payment_intent
          );
        }
        break;

      case "checkout.session.expired":
        const expiredSession = event.data.object;
        await Payment.findOneAndUpdate(
          { sessionId: expiredSession.id, status: "pending" },
          { status: "expired", expiredAt: new Date() }
        );
        break;

      case "checkout.session.async_payment_succeeded":
        const asyncSession = event.data.object;
        const payment = await Payment.findOne({ sessionId: asyncSession.id });
        
        if (payment && payment.status !== "completed") {
          const userId = asyncSession.client_reference_id;
          const courseIds = JSON.parse(asyncSession.metadata.courseIds);
          const instructorIds = JSON.parse(asyncSession.metadata.instructorIds);

          await processEnrollment(
            userId, 
            courseIds, 
            instructorIds, 
            asyncSession.id, 
            asyncSession.payment_intent
          );
        }
        break;

      case "checkout.session.async_payment_failed":
        const failedSession = event.data.object;
        await Payment.findOneAndUpdate(
          { sessionId: failedSession.id, status: "pending" },
          { status: "failed", failedAt: new Date() }
        );
        break;

      default:
        console.log(`Unhandled event: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error(`Error processing ${event.type}:`, error);
    res.status(200).json({ received: true, error: error.message });
  }
};

/**
 * Get payment status (optional - for polling)
 * GET /payment/status/:sessionId
 */
const getPaymentStatus = async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  try {
    const payment = await Payment.findOne({ sessionId });

    if (!payment) {
      return res.status(404).json({ 
        error: "Payment not found" 
      });
    }

    if (payment.userId.toString() !== userId) {
      return res.status(403).json({ 
        error: "Unauthorized" 
      });
    }

    res.json({
      status: payment.status,
      courseIds: payment.courseIds,
      amount: payment.amount,
      completedAt: payment.completedAt
    });

  } catch (error) {
    console.error("Get payment status error:", error);
    res.status(500).json({ 
      error: "Failed to get payment status" 
    });
  }
};

module.exports = {
  createCheckout,
  verifyPayment,
  webHook,
  getPaymentStatus
};