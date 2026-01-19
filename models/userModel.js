const mongoose = require("mongoose");

// ============================================================================
// BASE USER SCHEMA (Shared across all roles)
// ============================================================================
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },

    password: { type: String, required: true, select: false },

    // For refresh-token rotation
    refreshToken: { type: String, select: false },

    verified: { type: Boolean, default: false }, // email verification

    bio: { type: String, default: "" },

    phone: { type: String, trim: true },

    profilePicture: { type: String, default: "" },

    headline: { type: String },

    active: { type: Boolean, default: true },

    // Discriminator used for multi-role separation
    role: {
      type: String,
      enum: ["student", "instructor", "admin"],
      required: true,
    },

    socialLinks: {
      facebook: String,
      linkedin: String,
      twitter: String,
      github: String,
    },
    cart: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],

    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
  },
  {
    timestamps: true,
    discriminatorKey: "role",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual: account creation date (nice for dashboards)
userSchema.virtual("joined").get(function () {
  return this._id.getTimestamp();
});

// Base model
const User = mongoose.model("User", userSchema);

// ============================================================================
// STUDENT SCHEMA (Wishlist, Cart, Purchased Courses, Progress)
// ============================================================================
const studentSchema = new mongoose.Schema(
  {
    purchasedCourses: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        purchasedAt: { type: Date, default: Date.now },
      },
    ],

    courseProgress: [
      {
        course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        progress: { type: Number, default: 0 }, // % completed
        lastViewed: { type: Date },
      },
    ]
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual: Populate course details in wishlist
studentSchema.virtual("wishlistDetails", {
  ref: "Course",
  localField: "wishlist",
  foreignField: "_id",
});

// Virtual: Populate purchased course documents
studentSchema.virtual("purchasedCourseDetails", {
  ref: "Course",
  localField: "purchasedCourses.course",
  foreignField: "_id",
});

const Student = User.discriminator("student", studentSchema);

// ============================================================================
// INSTRUCTOR SCHEMA (Courses Created, Income, Students Taught)
// ============================================================================
const instructorSchema = new mongoose.Schema(
  {
    expertise: { type: String },

    rating: { type: Number, default: 0 },

    // Instructor courses (Course model holds enrolled students)
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],

    // Total income earned from courses (cached or computed)
    totalIncome: { type: Number, default: 0 },

    // Total unique students taught (computed/updated occasionally)
    studentsTaughtCount: { type: Number, default: 0 },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual: populate full course details
instructorSchema.virtual("courseDetails", {
  ref: "Course",
  localField: "courses",
  foreignField: "_id",
});

const Instructor = User.discriminator("instructor", instructorSchema);

// ============================================================================
// ADMIN SCHEMA (No special fields needed)
// ============================================================================
const adminSchema = new mongoose.Schema(
  {},
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const Admin = User.discriminator("admin", adminSchema);

// ============================================================================
// EXPORT
// ============================================================================
module.exports = {
  User,
  Student,
  Instructor,
  Admin,
};
