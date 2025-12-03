// controllers/paymentController.js
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Course = require("../models/courseModel");
const Payment = require("../models/paymentModel");
const { User } = require("../models/userModel");

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
      success_url: `${process.env.FRONTEND_URL}/cart?session_id={CHECKOUT_SESSION_ID}&payment_success=true`,
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
async function processEnrollment(userId, courseIds, instructorIds, sessionId, paymentIntentId) {
  const sessionDb = await User.startSession();
  await sessionDb.startTransaction();

  try {
    // Update user's courses and clear cart
    await User.findByIdAndUpdate(
      userId,
      {
        $addToSet: { courses: { $each: courseIds } },
        $pull: { cart: { $in: courseIds } }
      },
      { session: sessionDb }
    );

    // Update each course's student list
    await Course.updateMany(
      { _id: { $in: courseIds } },
      { $addToSet: { students: userId } },
      { session: sessionDb }
    );

    // Update instructors' student lists
    await User.updateMany(
      { _id: { $in: instructorIds } },
      { $addToSet: { students: userId } },
      { session: sessionDb }
    );

    // Update payment record
    await Payment.findOneAndUpdate(
      { sessionId },
      { 
        status: "completed",
        completedAt: new Date(),
        paymentIntentId
      },
      { session: sessionDb }
    );

    await sessionDb.commitTransaction();
  } catch (error) {
    await sessionDb.abortTransaction();
    throw error;
  } finally {
    sessionDb.endSession();
  }
}

/**
 * Webhook handler for Stripe events
 * POST /payment/webhook
 * CRITICAL: This is the authoritative source of payment completion
 */
const webHook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).send("Webhook secret not configured");
  }

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.rawBody || req.body, // Use rawBody for webhooks
      sig, 
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        console.log(`✅ Payment successful for session: ${session.id}`);

        // Check if already processed (idempotency)
        const existingPayment = await Payment.findOne({ 
          sessionId: session.id, 
          status: "completed" 
        });

        if (existingPayment) {
          console.log(`Session ${session.id} already processed, skipping`);
          break;
        }

        // Only process if payment is complete
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

          console.log(`✅ Enrollment completed for user ${userId}`);
        }
        break;

      case "checkout.session.expired":
        const expiredSession = event.data.object;
        console.log(`⏰ Session expired: ${expiredSession.id}`);
        
        await Payment.findOneAndUpdate(
          { sessionId: expiredSession.id, status: "pending" },
          { status: "expired", expiredAt: new Date() }
        );
        break;

      case "checkout.session.async_payment_succeeded":
        // Handle delayed payment methods (bank transfers, etc.)
        const asyncSession = event.data.object;
        console.log(`✅ Async payment succeeded: ${asyncSession.id}`);
        
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
        console.log(`❌ Async payment failed: ${failedSession.id}`);
        
        await Payment.findOneAndUpdate(
          { sessionId: failedSession.id, status: "pending" },
          { status: "failed", failedAt: new Date() }
        );
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    // Return 200 to acknowledge receipt
    res.json({ received: true });

  } catch (error) {
    console.error(`Error processing webhook event ${event.type}:`, error);
    // Still return 200 to prevent Stripe from retrying
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