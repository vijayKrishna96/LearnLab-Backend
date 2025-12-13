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
  video: { publicId: String, url: String },
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
  // Basic Information
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  description: { type: String, required: true },

  // Relationships
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ type: Schema.Types.ObjectId, ref: "User" }],

  // Pricing
  price: { type: Number, required: true },
  isFree: { type: Boolean, default: false },

  // Media
  image: { publicId: String, url: String },
  promoVideo: { publicId: String, url: String },

  // Course Details
  level: {
    type: String,
    enum: ["beginner", "intermediate", "advanced"],
    default: "beginner"
  },
  language: { type: String, default: "English" },

  // Course Content
  requirements: [String],
  whatYouWillLearn: [String],
  tags: [String],
  modules: [ModuleSchema],
  reviews: [ReviewSchema],

  // Statistics
  averageRating: { type: Number, default: 0 },
  totalDuration: { type: Number, default: 0 }, // in minutes
  enrollmentCount: { type: Number, default: 0 },

  // ============ STATUS MANAGEMENT ============
  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "draft",
    required: true,
    index: true
  },

  isPublished: {
    type: Boolean,
    default: false,
    index: true
  },

  // ============ TIMESTAMP TRACKING ============
  publishedAt: {
    type: Date,
    default: null
  },

  unpublishedAt: {
    type: Date,
    default: null
  },

  archivedAt: {
    type: Date,
    default: null
  },

  archivedReason: {
    type: String,
    default: null
  },

  lastEditedAt: {
    type: Date,
    default: Date.now
  },

  // ============ SOFT DELETE ============
  isDeleted: {
    type: Boolean,
    default: false,
    select: false // Hide by default in queries
  },

  deletedAt: {
    type: Date,
    default: null,
    select: false
  },

  // ============ METADATA ============
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Legacy field (keeping for backward compatibility)
  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true, // Creates createdAt and updatedAt automatically
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============ INDEXES FOR PERFORMANCE ============
CourseSchema.index({ instructor: 1, status: 1 });
CourseSchema.index({ status: 1, isPublished: 1 });
CourseSchema.index({ isDeleted: 1 });
CourseSchema.index({ category: 1, status: 1 });
CourseSchema.index({ slug: 1 });

// ============ VIRTUAL POPULATIONS ============
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

// ============ PRE-SAVE MIDDLEWARE ============

// Generate slug from title
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
  next();
});

// Auto-detect free course
CourseSchema.pre('save', function (next) {
  this.isFree = this.price === 0;
  next();
});

// Update lastEditedAt on any modification
CourseSchema.pre('save', function (next) {
  if (this.isModified() && !this.isNew) {
    this.lastEditedAt = new Date();
    this.lastUpdated = new Date(); // Keep for backward compatibility
  }
  next();
});

// Calculate completion percentage
CourseSchema.pre('save', function (next) {
  const requiredFields = [
    this.title,
    this.description,
    this.category,
    this.price !== undefined,
    this.image?.url,
    this.modules?.length > 0,
    this.whatYouWillLearn?.length > 0,
    this.level
  ];

  const completedFields = requiredFields.filter(Boolean).length;
  this.completionPercentage = Math.round((completedFields / requiredFields.length) * 100);
  
  next();
});

// ============ INSTANCE METHODS ============

// Publish course
CourseSchema.methods.publish = function() {
  // Validation: Check completion percentage
  if (this.completionPercentage < 80) {
    throw new Error(`Course must be at least 80% complete to publish. Current: ${this.completionPercentage}%`);
  }

  // Validation: Check required fields
  const missingFields = [];
  if (!this.title) missingFields.push('title');
  if (!this.description) missingFields.push('description');
  if (!this.category) missingFields.push('category');
  if (this.price === undefined) missingFields.push('price');
  if (!this.image?.url) missingFields.push('image');
  if (!this.modules || this.modules.length === 0) missingFields.push('modules');

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Update status
  this.status = 'published';
  this.isPublished = true;
  this.publishedAt = new Date();
  
  return this.save();
};

// Unpublish course
CourseSchema.methods.unpublish = function() {
  if (this.status !== 'published') {
    throw new Error('Course is not published');
  }

  this.status = 'draft';
  this.isPublished = false;
  this.unpublishedAt = new Date();
  
  return this.save();
};

// Archive course
CourseSchema.methods.archive = function(reason = null) {
  if (this.status === 'archived') {
    throw new Error('Course is already archived');
  }

  this.status = 'archived';
  this.isPublished = false;
  this.archivedAt = new Date();
  this.archivedReason = reason;
  
  return this.save();
};

// Unarchive course
CourseSchema.methods.unarchive = function() {
  if (this.status !== 'archived') {
    throw new Error('Course is not archived');
  }

  this.status = 'draft';
  this.isPublished = false;
  this.archivedAt = null;
  this.archivedReason = null;
  
  return this.save();
};

// Soft delete course
CourseSchema.methods.softDelete = function() {
  // Prevent deletion if course has students
  if (this.students && this.students.length > 0) {
    throw new Error('Cannot delete course with enrolled students. Please archive it instead.');
  }

  this.isDeleted = true;
  this.deletedAt = new Date();
  
  return this.save();
};

// Restore soft-deleted course
CourseSchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = null;
  
  return this.save();
};

// Check if course is ready to publish
CourseSchema.methods.isReadyToPublish = function() {
  return this.completionPercentage >= 80 &&
         this.title &&
         this.description &&
         this.category &&
         this.price !== undefined &&
         this.image?.url &&
         this.modules?.length > 0;
};

// Get publish checklist
CourseSchema.methods.getPublishChecklist = function() {
  return {
    hasTitle: !!this.title,
    hasDescription: !!this.description,
    hasCategory: !!this.category,
    hasPrice: this.price !== undefined,
    hasImage: !!this.image?.url,
    hasModules: this.modules?.length > 0,
    hasLearningOutcomes: this.whatYouWillLearn?.length > 0,
    hasLevel: !!this.level,
    completionPercentage: this.completionPercentage,
    isReady: this.isReadyToPublish()
  };
};

// Add student to course
CourseSchema.methods.enrollStudent = function(studentId) {
  if (this.status !== 'published') {
    throw new Error('Cannot enroll in unpublished course');
  }

  if (!this.students.includes(studentId)) {
    this.students.push(studentId);
    this.enrollmentCount = this.students.length;
  }
  
  return this.save();
};

// Remove student from course
CourseSchema.methods.unenrollStudent = function(studentId) {
  this.students = this.students.filter(id => !id.equals(studentId));
  this.enrollmentCount = this.students.length;
  
  return this.save();
};

// ============ STATIC METHODS ============

// Find courses by instructor
CourseSchema.statics.findByInstructor = function(instructorId, status = null) {
  let query = this.find({ 
    instructor: instructorId,
    isDeleted: { $ne: true }
  });

  if (status) {
    query = query.where({ status });
  }

  return query
    .populate('category', 'name')
    .sort({ lastEditedAt: -1 });
};

// Find published courses
CourseSchema.statics.findPublished = function() {
  return this.find({ 
    status: 'published',
    isPublished: true,
    isDeleted: { $ne: true }
  })
  .populate('category', 'name')
  .populate('instructor', 'name email');
};

// Find courses by category
CourseSchema.statics.findByCategory = function(categoryId, publishedOnly = true) {
  let query = this.find({ 
    category: categoryId,
    isDeleted: { $ne: true }
  });

  if (publishedOnly) {
    query = query.where({ status: 'published', isPublished: true });
  }

  return query.populate('instructor', 'name email');
};

// Search courses
CourseSchema.statics.search = function(searchTerm) {
  return this.find({
    status: 'published',
    isPublished: true,
    isDeleted: { $ne: true },
    $or: [
      { title: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { tags: { $in: [new RegExp(searchTerm, 'i')] } }
    ]
  })
  .populate('category', 'name')
  .populate('instructor', 'name email');
};

// ============ QUERY HELPERS ============

// Exclude soft-deleted courses
CourseSchema.query.notDeleted = function() {
  return this.where({ isDeleted: { $ne: true } });
};

// Only published courses
CourseSchema.query.published = function() {
  return this.where({ status: 'published', isPublished: true });
};

// Only draft courses
CourseSchema.query.drafts = function() {
  return this.where({ status: 'draft' });
};

// Only archived courses
CourseSchema.query.archived = function() {
  return this.where({ status: 'archived' });
};

// Filter by instructor
CourseSchema.query.byInstructor = function(instructorId) {
  return this.where({ instructor: instructorId });
};

// Filter by category
CourseSchema.query.byCategory = function(categoryId) {
  return this.where({ category: categoryId });
};

// ============ MODEL EXPORT ============
const Course = mongoose.model('Course', CourseSchema);
module.exports = Course;