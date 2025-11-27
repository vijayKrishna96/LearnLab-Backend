const mongoose = require('mongoose');
const { Schema } = mongoose;

// Review Schema
const ReviewSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Lesson Schema
const LessonSchema = new Schema({
  title: { type: String, required: true },
  duration: { type: String, required: true },
  image: { publicId: String, url: String },
  video: { publicId: String, url: String }, // optional
  isPreview: { type: Boolean, default: false }
});

// Module Schema
const ModuleSchema = new Schema({
  moduleNumber: { type: Number, required: true },
  title: { type: String, required: true },
  lessons: [LessonSchema]
});

// Course Schema
const CourseSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true }, // SEO friendly
  description: { type: String, required: true },

  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ type: Schema.Types.ObjectId, ref: "User" }],

  price: { type: Number, required: true },
  isFree: { type: Boolean, default: false },

  image: { publicId: String, url: String },
  promoVideo: { publicId: String, url: String },

  level: {
    type: String,
    enum: ["beginner", "intermediate", "advanced"],
    default: "beginner"
  },

  language: { type: String, default: "English" },

  requirements: [String],
  whatYouWillLearn: [String],
  tags: [String],

  modules: [ModuleSchema],
  reviews: [ReviewSchema],

  averageRating: { type: Number, default: 0 },
  totalDuration: { type: Number, default: 0 }, // minutes
  enrollmentCount: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ["draft", "published"],
    default: "draft"
  },

  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual populations
CourseSchema.virtual('categoryDetails', {
  ref: 'Category',
  localField: 'category',
  foreignField: '_id',
  justOne: true
});

CourseSchema.virtual('instructorDetails', {
  ref: 'User',
  localField: 'instructor',
  foreignField: '_id',
  justOne: true
});

CourseSchema.virtual('studentDetails', {
  ref: 'User',
  localField: 'students',
  foreignField: '_id'
});

// Generate slug
CourseSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

// Calculate average rating
CourseSchema.pre('save', function (next) {
  if (this.reviews && this.reviews.length > 0) {
    this.averageRating =
      this.reviews.reduce((acc, review) => acc + review.rating, 0) / this.reviews.length;
  } else {
    this.averageRating = 0;
  }

  // Auto detect free course
  this.isFree = this.price === 0;

  next();
});

const Course = mongoose.model('Course', CourseSchema);
module.exports = Course;
