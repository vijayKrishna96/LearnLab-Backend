const Course = require("../models/courseModel");


class CourseService {
  // Check if course with title exists
  async checkDuplicateTitle(title, excludeId = null) {
    const query = {
      title: { $regex: new RegExp(`^${title}$`, 'i') }
    };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    return await Course.findOne(query);
  }

  // Create a new course
  async createCourse(courseData) {
    const course = new Course(courseData);
    await course.save();
    return await this.getCourseById(course._id);
  }

  // Get all courses with filters
  async getAllCourses(filters = {}) {
    const query = this.buildQuery(filters);
    
    return await Course.find(query)
      .populate('categoryDetails', 'name')
      .populate('instructorDetails', 'name email profileImage')
      .select('title description price image.url averageRating status isFree level language enrollmentCount totalDuration slug')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  // Get courses by array of IDs
  async getCoursesByIds(ids) {
    return await Course.find({ '_id': { $in: ids } })
      .populate('categoryDetails', 'name')
      .populate('instructorDetails', 'name email profileImage')
      .populate('studentDetails', 'name email profileImage')
      .lean()
      .exec();
  }

  // Get single course by ID
  async getCourseById(id) {
    return await Course.findById(id)
      .populate('categoryDetails', 'name description')
      .populate('instructorDetails', 'name email profileImage bio')
      .populate('studentDetails', 'name email profileImage')
      .populate('reviews.userId', 'name profileImage')
      .exec();
  }

  // Get course preview (public view)
  async getCoursePreviewById(id) {
    return await Course.findById(id)
      .populate('categoryDetails', 'name description')
      .populate('instructorDetails', 'name email profileImage bio rating totalStudents')
      .select('title description price image.url averageRating totalRatings enrollmentCount totalDuration level language requirements whatYouWillLearn tags promoVideo modules.title modules.duration modules.lessons.title modules.lessons.duration slug status createdAt')
      .exec();
  }

  // Search courses with advanced filtering
  async searchCourses({
    query,
    category,
    level,
    priceRange,
    rating,
    sortBy = 'relevance',
    page = 1,
    limit = 10
  }) {
    const searchQuery = this.buildSearchQuery({
      query,
      category,
      level,
      priceRange,
      rating
    });

    const skip = (page - 1) * limit;
    
    // Build sort object
    const sortOptions = this.buildSortOptions(sortBy);

    const [courses, total] = await Promise.all([
      Course.find(searchQuery)
        .populate('categoryDetails', 'name')
        .populate('instructorDetails', 'name profileImage')
        .select('title description price image.url averageRating totalRatings enrollmentCount totalDuration level language slug isFree')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      
      Course.countDocuments(searchQuery)
    ]);

    return {
      courses,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalCourses: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      filters: {
        query,
        category,
        level,
        priceRange,
        rating
      }
    };
  }

  // Filter courses
  async filterCourses(filters = {}) {
    const query = this.buildQuery(filters);
    
    return await Course.find(query)
      .populate('categoryDetails', 'name')
      .populate('instructorDetails', 'name profileImage')
      .select('title description price image.url averageRating enrollmentCount totalDuration level language slug isFree')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  // Get courses for cart (minimal data)
  async getCoursesForCart(ids) {
    return await Course.find({ '_id': { $in: ids } })
      .populate('instructorDetails', 'name')
      .select('title image.url price isFree slug')
      .lean()
      .exec();
  }

  // Get courses for wishlist (minimal data)
  async getCoursesForWishlist(ids) {
    return await Course.find({ '_id': { $in: ids }, status: 'published' })
      .populate('instructorDetails', 'name profileImage')
      .select('title image.url price averageRating totalRatings enrollmentCount totalDuration modulesCount instructor slug isFree')
      .lean()
      .exec();
  }

  // 🔹 PURCHASED COURSES SERVICES

  // Get full course content (for enrolled students)
  async getFullCourseById(id) {
    return await Course.findById(id)
      .populate('categoryDetails', 'name description')
      .populate('instructorDetails', 'name email profileImage bio socialLinks')
      .populate({
        path: 'modules.lessons',
        select: 'title duration videoUrl content resources order isPreview',
        options: { sort: { order: 1 } }
      })
      .populate('reviews.userId', 'name profileImage')
      .select('-__v')
      .exec();
  }

  // Verify user enrollment
  async verifyEnrollment(courseId, userId) {
    const course = await Course.findById(courseId)
      .select('students')
      .exec();
    
    return course && course.students.includes(userId);
  }

  // 🔹 HELPER METHODS

  // Build search query with advanced filters
  buildSearchQuery({ query, category, level, priceRange, rating }) {
    const searchQuery = { status: 'published' };

    // Text search
    if (query) {
      searchQuery.$or = [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } },
        { 'instructorDetails.name': { $regex: query, $options: 'i' } }
      ];
    }

    // Category filter
    if (category) {
      if (Array.isArray(category)) {
        searchQuery.category = { $in: category };
      } else {
        searchQuery.category = category;
      }
    }

    // Level filter
    if (level) {
      if (Array.isArray(level)) {
        searchQuery.level = { $in: level };
      } else {
        searchQuery.level = level;
      }
    }

    // Price range filter
    if (priceRange) {
      const priceRanges = {
        'free': { isFree: true },
        'paid': { isFree: false },
        'under-50': { price: { $lt: 50 }, isFree: false },
        '50-100': { price: { $gte: 50, $lte: 100 }, isFree: false },
        'over-100': { price: { $gt: 100 }, isFree: false }
      };
      
      if (priceRanges[priceRange]) {
        Object.assign(searchQuery, priceRanges[priceRange]);
      }
    }

    // Rating filter
    if (rating) {
      const minRating = parseFloat(rating);
      searchQuery.averageRating = { $gte: minRating };
    }

    return searchQuery;
  }

  // Build sort options
  buildSortOptions(sortBy) {
    const sortOptions = {
      'relevance': { score: { $meta: 'textScore' }, averageRating: -1, enrollmentCount: -1 },
      'popular': { enrollmentCount: -1, averageRating: -1 },
      'rating': { averageRating: -1, enrollmentCount: -1 },
      'newest': { createdAt: -1 },
      'price-low': { price: 1 },
      'price-high': { price: -1 },
      'duration': { totalDuration: -1 }
    };

    return sortOptions[sortBy] || sortOptions.relevance;
  }


  // Update course
  async updateCourse(id, updateData) {
    const course = await Course.findByIdAndUpdate(
      id,
      { $set: { ...updateData, lastUpdated: Date.now() } },
      { new: true, runValidators: true }
    ).populate([
      { path: 'categoryDetails', select: 'name' },
      { path: 'instructorDetails', select: 'name email profileImage' }
    ]);
    
    return course;
  }

  // Delete course
  async deleteCourse(id) {
    return await Course.findByIdAndDelete(id).exec();
  }

  // Helper: Build query from filters
  buildQuery(filters) {
    const { category, level, language, status, isFree, minPrice, maxPrice, instructor, search } = filters;
    const query = {};

    if (category) query.category = category;
    if (level) query.level = level;
    if (language) query.language = language;
    if (status) query.status = status;
    if (isFree !== undefined) query.isFree = isFree === 'true';
    if (instructor) query.instructor = instructor;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    return query;
  }
}

module.exports = new CourseService();
