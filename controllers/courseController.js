const asyncHandler = require('../middleware/asyncHandler'); // We'll create this
const courseService = require('../services/courseService');
const imageService = require('../services/imageService');
const CourseUtils = require('../utils/courseUtils');

class CourseController {
  // Create new course
  createCourse = asyncHandler(async (req, res) => {
    const { title, description, category, price, modules, instructor, promoVideo, level, language, requirements, whatYouWillLearn, tags } = req.body;

    // Check for duplicate
    const duplicate = await courseService.checkDuplicateTitle(title);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "A course with this title already exists"
      });
    }

    // Upload images
    const uploadedImages = await imageService.uploadCourseImages(req.files);

    // Process modules
    const parsedModules = CourseUtils.parseModules(modules);
    const processedModules = CourseUtils.processModules(parsedModules, uploadedImages);
    const totalDuration = CourseUtils.calculateTotalDuration(parsedModules);

    // Create course
    const courseData = {
      title,
      description,
      category,
      price: Number(price),
      instructor,
      image: uploadedImages[0] || null,
      promoVideo,
      level,
      language,
      requirements,
      whatYouWillLearn,
      tags,
      modules: processedModules,
      totalDuration
    };

    const course = await courseService.createCourse(courseData);

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      course
    });
  });

  // Get all courses
  getAllCourses = asyncHandler(async (req, res) => {
    const courses = await courseService.getAllCourses(req.query);

    if (!courses || courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No courses found",
        courses: []
      });
    }

    res.status(200).json({
      success: true,
      count: courses.length,
      courses
    });
  });

  // Get courses by IDs
  getCoursesByIds = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    const courses = await courseService.getCoursesByIds(ids);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No courses found for the provided IDs',
        requestedIds: ids
      });
    }

    const notFoundIds = CourseUtils.findMissingIds(ids, courses);

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
      ...(notFoundIds.length > 0 && {
        warning: 'Some course IDs were not found',
        notFoundIds
      })
    });
  });

  // Get single course
  getSingleCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    const course = await courseService.getCourseById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      course
    });
  });

  // Update course
  updateCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const { title, modules, ...otherData } = req.body;

    // Get existing course
    const existingCourse = await courseService.getCourseById(courseId);
    if (!existingCourse) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    // Check duplicate title
    if (title && title !== existingCourse.title) {
      const duplicate = await courseService.checkDuplicateTitle(title, courseId);
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "A course with this title already exists"
        });
      }
    }

    // Handle images
    let uploadedImages = [];
    if (req.files && req.files.length > 0) {
      await imageService.deleteCourseImages(existingCourse);
      uploadedImages = await imageService.uploadCourseImages(req.files);
    }

    // Process modules
    const parsedModules = modules ? CourseUtils.parseModules(modules) : existingCourse.modules;
    const processedModules = CourseUtils.processModules(parsedModules, uploadedImages, existingCourse);
    const totalDuration = CourseUtils.calculateTotalDuration(parsedModules);

    // Update data
    const updateData = {
      title: title || existingCourse.title,
      modules: processedModules,
      totalDuration,
      image: uploadedImages[0] || existingCourse.image,
      ...otherData
    };

    const updatedCourse = await courseService.updateCourse(courseId, updateData);

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      course: updatedCourse
    });
  });

  // Delete course
  deleteCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    const course = await courseService.deleteCourse(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    await imageService.deleteCourseImages(course);

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
      deletedCourse: {
        id: course._id,
        title: course.title
      }
    });
  });

  // Get course preview (for browsing before purchase)
  getCoursePreviewById = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    const course = await courseService.getCoursePreviewById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      course
    });
  });

  // Search courses
  searchCourses = asyncHandler(async (req, res) => {
    const { query, category, level, priceRange, rating, sortBy, page = 1, limit = 10 } = req.query;

    const searchResults = await courseService.searchCourses({
      query,
      category,
      level,
      priceRange,
      rating,
      sortBy,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      ...searchResults
    });
  });

  // Filter courses
  filterCourses = asyncHandler(async (req, res) => {
    const filters = req.query;
    
    const courses = await courseService.filterCourses(filters);

    res.status(200).json({
      success: true,
      count: courses.length,
      courses
    });
  });

  // Get courses for cart (minimal data)
  getCoursesForCart = asyncHandler(async (req, res) => {
    console.log(req.body)
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Course IDs array is required'
      });
    }

    const courses = await courseService.getCoursesForCart(ids);

    res.status(200).json({
      success: true,
      count: courses.length,
      courses
    });
  });

  // Get courses for wishlist (minimal data)
  getCoursesForWishlist = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Course IDs array is required'
      });
    }

    const courses = await courseService.getCoursesForWishlist(ids);

    res.status(200).json({
      success: true,
      count: courses.length,
      courses
    });
  });

  // 🔹 PURCHASED COURSES CONTROLLERS
  // Get full course content (for enrolled students)
  getFullCourseById = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const { userId } = req.user; // Assuming user is authenticated and enrolled

    // You might want to add enrollment verification here
    const isEnrolled = await courseService.verifyEnrollment(courseId, userId);
    
    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        message: 'You are not enrolled in this course'
      });
    }

    const course = await courseService.getFullCourseById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      course
    });
  });

}

module.exports = new CourseController();


 