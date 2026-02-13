const { default: mongoose } = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler").default;
const courseService = require("../services/courseService");
const imageService = require("../services/imageService");
const CourseUtils = require("../utils/courseUtils");
const { cleanupLocalFiles } = require("../utils/uploadCloudinary");

class CourseController {
  // Create new course
  createCourse = asyncHandler(async (req, res) => {
    try {
      const {
        title,
        description,
        category,
        price,
        modules,
        instructor,
        promoVideo,
        level,
        language,
        requirements,
        whatYouWillLearn,
        tags,
      } = req.body;

      if (!title || !description || !category) {
        cleanupLocalFiles(req.files);
        return res.status(400).json({
          success: false,
          message: "Title, description, and category are required",
        });
      }

      const duplicate = await courseService.checkDuplicateTitle(title);
      if (duplicate) {
        cleanupLocalFiles(req.files);
        return res.status(409).json({
          success: false,
          message: "Course title already exists",
        });
      }

      const parsedModules = CourseUtils.parseModules(modules || []);

      const uploadedImages = req.files?.length
        ? await imageService.uploadCourseImages(req.files)
        : [];

      const courseImage = uploadedImages[0] || null;
      const lessonImages = uploadedImages.slice(1);

      const processedModules = CourseUtils.processModulesWithImages(
        parsedModules,
        lessonImages
      );

      const totalDuration = CourseUtils.calculateTotalDuration(parsedModules);

      const course = await courseService.createCourse({
        title,
        description,
        category,
        price: Number(price) || 0,
        instructor,
        image: courseImage,
        promoVideo,
        level,
        language,
        requirements: requirements ? JSON.parse(requirements) : [],
        whatYouWillLearn: whatYouWillLearn ? JSON.parse(whatYouWillLearn) : [],
        tags: tags ? JSON.parse(tags) : [],
        modules: processedModules,
        totalDuration,
      });

      res.status(201).json({ success: true, course });
    } catch (error) {
      cleanupLocalFiles(req.files);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });

  // Get all courses
  getAllCourses = asyncHandler(async (req, res) => {
    const courses = await courseService.getAllCourses(req.query);

    if (!courses || courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No courses found",
        courses: [],
      });
    }

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
    });
  });

  // Get courses by IDs
  getCoursesByIds = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    const courses = await courseService.getCoursesByIds(ids);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No courses found for the provided IDs",
        requestedIds: ids,
      });
    }

    const notFoundIds = CourseUtils.findMissingIds(ids, courses);

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
      ...(notFoundIds.length > 0 && {
        warning: "Some course IDs were not found",
        notFoundIds,
      }),
    });
  });

  // Get single course
  getSingleCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    const course = await courseService.getCourseById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.status(200).json({
      success: true,
      course,
    });
  });

  // Update course
 updateCourse = asyncHandler(async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, modules, ...rest } = req.body;

    const course = await courseService.getCourseById(courseId);
    if (!course) {
      cleanupLocalFiles(req.files);
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    if (title && title !== course.title) {
      const duplicate = await courseService.checkDuplicateTitle(title, courseId);
      if (duplicate) {
        cleanupLocalFiles(req.files);
        return res.status(409).json({ success: false, message: "Duplicate title" });
      }
    }

    let updatedImage = course.image;
    let updatedModules = course.modules;
    let totalDuration = course.totalDuration;

    if (modules) {
      const parsedModules = CourseUtils.parseModules(modules);
      totalDuration = CourseUtils.calculateTotalDuration(parsedModules);

      if (req.files?.length) {
        const uploadedImages = await imageService.uploadCourseImages(req.files);
        updatedImage = uploadedImages[0] || course.image;

        updatedModules = CourseUtils.processModulesWithImages(
          parsedModules,
          uploadedImages.slice(1),
          course.modules
        );
      } else {
        updatedModules = CourseUtils.processModulesWithImages(
          parsedModules,
          [],
          course.modules
        );
      }
    }

    const updatedCourse = await courseService.updateCourse(courseId, {
      title: title || course.title,
      image: updatedImage,
      modules: updatedModules,
      totalDuration,
      requirements: rest.requirements ? JSON.parse(rest.requirements) : course.requirements,
      whatYouWillLearn: rest.whatYouWillLearn
        ? JSON.parse(rest.whatYouWillLearn)
        : course.whatYouWillLearn,
      tags: rest.tags ? JSON.parse(rest.tags) : course.tags,
      ...rest
    });

    res.json({ success: true, course: updatedCourse });
  } catch (error) {
    cleanupLocalFiles(req.files);
    res.status(500).json({ success: false, message: error.message });
  }
});


  // Get course preview (for browsing before purchase)
  getCoursePreviewById = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    const course = await courseService.getCoursePreviewById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.status(200).json({
      success: true,
      course,
    });
  });

  // Search courses
  searchCourses = asyncHandler(async (req, res) => {
    const {
      query,
      category,
      level,
      priceRange,
      rating,
      sortBy,
      page = 1,
      limit = 10,
    } = req.query;

    const searchResults = await courseService.searchCourses({
      query,
      category,
      level,
      priceRange,
      rating,
      sortBy,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.status(200).json({
      success: true,
      ...searchResults,
    });
  });

  // Filter courses
  filterCourses = asyncHandler(async (req, res) => {
    const filters = req.query;

    const courses = await courseService.filterCourses(filters);

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
    });
  });

  // Get courses for cart (minimal data)
  getCoursesForCart = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Course IDs array is required",
      });
    }

    const courses = await courseService.getCoursesForCart(ids);

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
    });
  });

  // Get courses for wishlist (minimal data)
  getCoursesForWishlist = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Course IDs array is required",
      });
    }

    const courses = await courseService.getCoursesForWishlist(ids);

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
    });
  });

  // 🔹 PURCHASED COURSES CONTROLLERS
  // Get full course content (for enrolled students)
  getFullCourseById = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const { userId } = req.user; // Assuming user is authenticated and enrolled

    // Verify enrollment
    const isEnrolled = await courseService.verifyEnrollment(courseId, userId);

    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        message: "You are not enrolled in this course",
      });
    }

    const course = await courseService.getFullCourseById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.status(200).json({
      success: true,
      course,
    });
  });

  // Get instructor's courses with optional status filter
  getCoursesByInstructorId = asyncHandler(async (req, res) => {
    const { instructorId } = req.params;
    const { status } = req.query; // Optional: 'draft', 'published', 'archived'

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(instructorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid instructor ID format",
      });
    }

    // Validate status if provided
    if (status && !["draft", "published", "archived"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be: draft, published, or archived",
      });
    }

    // Call service
    const courses = await courseService.getCoursesByInstructorId(
      instructorId,
      status
    );

    // No courses found
    if (!courses || courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: status
          ? `No ${status} courses found for this instructor`
          : "No courses found for this instructor",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  });

  // Publish a course
  publishCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    // Call service
    const result = await courseService.publishCourse(courseId);

    // Check for validation errors
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Course published successfully",
      data: result.course,
    });
  });

  // Unpublish a course
  unpublishCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    // Call service
    const result = await courseService.unpublishCourse(courseId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Course unpublished successfully",
      data: result.course,
    });
  });

  // Archive a course
  archiveCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const { reason } = req.body; // Optional reason for archiving

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    // Call service
    const result = await courseService.archiveCourse(courseId, reason);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Course archived successfully",
      data: result.course,
    });
  });

  // Unarchive a course
  unarchiveCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    // Call service
    const result = await courseService.unarchiveCourse(courseId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Course unarchived successfully. It is now in draft status.",
      data: result.course,
    });
  });

  // Soft delete a course
  deleteCourse = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID format",
      });
    }

    // Call service
    const result = await courseService.deleteCourse(courseId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
      data: null,
    });
  });
}

module.exports = new CourseController();
