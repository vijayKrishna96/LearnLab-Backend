const Course = require("../models/courseModel");

class CourseService {
  // Check if course with title exists
  async checkDuplicateTitle(title, excludeId = null) {
    const query = {
      title: { $regex: new RegExp(`^${title}$`, "i") },
      isDeleted: { $ne: true }, // Exclude soft-deleted courses
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
    // Add isDeleted filter
    query.isDeleted = { $ne: true };

    return await Course.find(query)
      .populate("category", "name")
      .populate("instructor", "name email profilePicture")
      .select(
        "title description price image.url averageRating status isFree level language enrollmentCount totalDuration slug"
      )
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  // Get courses by array of IDs
  async getCoursesByIds(ids) {
    return await Course.find({ 
      _id: { $in: ids },
      isDeleted: { $ne: true }
    })
      .populate("instructor", "name profilePicture")
      .select("title image.url totalDuration instructor")
      .exec();
  }

  // Get single course by ID
  async getCourseById(id) {
    return await Course.findOne({ 
      _id: id,
      isDeleted: { $ne: true }
    })
      .populate("category", "name description")
      .populate("instructor", "name email profilePicture bio")
      .populate("students", "name email profilePicture")
      .populate("reviews.userId", "name profilePicture")
      .exec();
  }

  // Get course preview (public view)
  async getCoursePreviewById(id) {
    return await Course.findOne({ 
      _id: id,
      isDeleted: { $ne: true },
      status: "published" // Only show published courses in preview
    })
      .populate("category", "name description")
      .populate(
        "instructor",
        "name email profilePicture bio"
      )
      .select(
        "title description price image.url averageRating enrollmentCount totalDuration level language requirements whatYouWillLearn tags promoVideo modules.moduleNumber modules.title modules.lessons.title modules.lessons.duration modules.lessons.isPreview slug status createdAt"
      )
      .exec();
  }

  // Search courses with advanced filtering
  async searchCourses({
    query,
    category,
    level,
    priceRange,
    rating,
    sortBy = "relevance",
    page = 1,
    limit = 10,
  }) {
    const searchQuery = this.buildSearchQuery({
      query,
      category,
      level,
      priceRange,
      rating,
    });

    const skip = (page - 1) * limit;

    // Build sort object
    const sortOptions = this.buildSortOptions(sortBy);

    const [courses, total] = await Promise.all([
      Course.find(searchQuery)
        .populate("category", "name")
        .populate("instructor", "name profilePicture")
        .select(
          "title description price image.url averageRating enrollmentCount totalDuration level language slug isFree"
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),

      Course.countDocuments(searchQuery),
    ]);

    return {
      courses,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalCourses: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
      filters: {
        query,
        category,
        level,
        priceRange,
        rating,
      },
    };
  }

  // Filter courses
  async filterCourses(filters = {}) {
    const query = this.buildQuery(filters);
    // Add isDeleted filter
    query.isDeleted = { $ne: true };

    return await Course.find(query)
      .populate("category", "name")
      .populate("instructor", "name profilePicture")
      .select(
        "title description price image.url averageRating enrollmentCount totalDuration level language slug isFree"
      )
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  // Get courses for cart (minimal data)
  async getCoursesForCart(ids) {
    return await Course.find({ 
      _id: { $in: ids },
      isDeleted: { $ne: true },
      status: "published" // Only published courses in cart
    })
      .populate("instructor", "name profilePicture")
      .select("title image.url price instructor isFree slug")
      .lean()
      .exec();
  }

  // Get courses for wishlist (minimal data)
  async getCoursesForWishlist(ids) {
    return await Course.find({ 
      _id: { $in: ids },
      isDeleted: { $ne: true },
      status: "published" // Only published courses in wishlist
    })
      .populate("instructor", "name profilePicture")
      .select(
        "title image.url price averageRating enrollmentCount totalDuration instructor slug isFree"
      )
      .lean()
      .exec();
  }

  // 🔹 PURCHASED COURSES SERVICES

  // Get full course content (for enrolled students)
  async getFullCourseById(id) {
    return await Course.findOne({ 
      _id: id,
      isDeleted: { $ne: true }
    })
      .populate("category", "name description")
      .populate(
        "instructor",
        "name email profilePicture bio"
      )
      .populate("reviews.userId", "name profilePicture")
      .select("-__v")
      .exec();
  }

  // Verify user enrollment
  async verifyEnrollment(courseId, userId) {
    const course = await Course.findOne({ 
      _id: courseId,
      isDeleted: { $ne: true }
    })
      .select("students")
      .exec();

    return course && course.students.some(studentId => studentId.equals(userId));
  }

  // 🔹 HELPER METHODS

  // Build search query with advanced filters
  buildSearchQuery({ query, category, level, priceRange, rating }) {
    const searchQuery = { 
      status: "published",
      isDeleted: { $ne: true }
    };

    // Text search
    if (query) {
      searchQuery.$or = [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { tags: { $in: [new RegExp(query, "i")] } },
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
        free: { isFree: true },
        paid: { isFree: false },
        "under-50": { price: { $lt: 50 }, isFree: false },
        "50-100": { price: { $gte: 50, $lte: 100 }, isFree: false },
        "over-100": { price: { $gt: 100 }, isFree: false },
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
      relevance: { averageRating: -1, enrollmentCount: -1 },
      popular: { enrollmentCount: -1, averageRating: -1 },
      rating: { averageRating: -1, enrollmentCount: -1 },
      newest: { createdAt: -1 },
      "price-low": { price: 1 },
      "price-high": { price: -1 },
      duration: { totalDuration: -1 },
    };

    return sortOptions[sortBy] || sortOptions.relevance;
  }

  // Update course
  async updateCourse(id, updateData) {
    const course = await Course.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate([
      { path: "category", select: "name" },
      { path: "instructor", select: "name email profilePicture" },
    ]);

    return course;
  }

  // Helper: Build query from filters
  buildQuery(filters) {
    const {
      category,
      level,
      language,
      status,
      isFree,
      minPrice,
      maxPrice,
      instructor,
      search,
    } = filters;
    const query = {};

    if (category) query.category = category;
    if (level) query.level = level;
    if (language) query.language = language;
    if (status) query.status = status;
    if (isFree !== undefined) query.isFree = isFree === "true";
    if (instructor) query.instructor = instructor;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    return query;
  }

  // Get courses by instructor with optional status filter
  getCoursesByInstructorId = async (instructorId, status = null) => {
    let query = Course.find({
      instructor: instructorId,
      isDeleted: { $ne: true },
    });

    // Apply status filter if provided
    if (status) {
      query = query.where({ status });
    }

    const courses = await query
      .populate("category", "name")
      .sort({ lastEditedAt: -1 })
      .lean();

    return courses;
  };

  // Publish course
  publishCourse = async (courseId) => {
    const course = await Course.findOne({ 
      _id: courseId,
      isDeleted: { $ne: true }
    });

    if (!course) {
      return {
        success: false,
        message: "Course not found",
      };
    }

    // Use the model's instance method
    try {
      await course.publish();
      return {
        success: true,
        course,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  };

  // Unpublish course
  unpublishCourse = async (courseId) => {
    const course = await Course.findOne({ 
      _id: courseId,
      isDeleted: { $ne: true }
    });

    if (!course) {
      return {
        success: false,
        message: "Course not found",
      };
    }

    // Use the model's instance method
    try {
      await course.unpublish();
      return {
        success: true,
        course,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  };

  // Archive course
  archiveCourse = async (courseId, reason = null) => {
    const course = await Course.findOne({ 
      _id: courseId,
      isDeleted: { $ne: true }
    });

    if (!course) {
      return {
        success: false,
        message: "Course not found",
      };
    }

    // Use the model's instance method
    try {
      await course.archive(reason);
      return {
        success: true,
        course,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  };

  // Unarchive course
  unarchiveCourse = async (courseId) => {
    const course = await Course.findOne({ 
      _id: courseId,
      isDeleted: { $ne: true }
    });

    if (!course) {
      return {
        success: false,
        message: "Course not found",
      };
    }

    // Use the model's instance method
    try {
      await course.unarchive();
      return {
        success: true,
        course,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  };

  // Soft delete course
  deleteCourse = async (courseId) => {
    const course = await Course.findOne({ 
      _id: courseId,
      isDeleted: { $ne: true }
    });

    if (!course) {
      return {
        success: false,
        message: "Course not found",
      };
    }

    // Use the model's instance method
    try {
      await course.softDelete();
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  };
}

module.exports = new CourseService();