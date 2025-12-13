const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
// const { protect, authorizeInstructor, authorizeAdmin } = require('../middleware/auth');

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

// Get all published courses
router.get(
  '/',
  courseController.getAllCourses
);

// Search courses with filters
router.get(
  '/search',
  courseController.searchCourses
);

// Filter courses
router.get(
  '/filter',
  courseController.filterCourses
);

// Get course preview (public view before purchase)
router.get(
  '/preview/:courseId',
  courseController.getCoursePreviewById
);

// Get single course details
router.get(
  '/:courseId',
  courseController.getSingleCourse
);

// ============================================
// AUTHENTICATED USER ROUTES
// ============================================

// Get courses for cart (minimal data)
router.post(
  '/cart/bulk',
  // protect,
  courseController.getCoursesForCart
);

// Get courses for wishlist (minimal data)
router.post(
  '/wishlist/bulk',
  // protect,
  courseController.getCoursesForWishlist
);

// Get courses by IDs (bulk fetch)
router.post(
  '/bulk',
  // protect,
  courseController.getCoursesByIds
);

// Get full course content (for enrolled students)
router.get(
  '/enrolled/:courseId',
  // protect,
  courseController.getFullCourseById
);

// ============================================
// INSTRUCTOR ROUTES (Course Management)
// ============================================

// Create new course
router.post(
  '/',
  // protect,
  // authorizeInstructor,
  courseController.createCourse
);

// Update course
router.put(
  '/:courseId',
  // protect,
  // authorizeInstructor,
  courseController.updateCourse
);

// Get courses by instructor ID with optional status filter
// Query params: ?status=draft|published|archived
router.get(
  '/instructor/:instructorId',
  // protect,
  // authorizeInstructor,
  courseController.getCoursesByInstructorId
);

// ============================================
// COURSE STATUS MANAGEMENT ROUTES
// ============================================

// Publish course
router.patch(
  '/:courseId/publish',
  // protect,
  // authorizeInstructor,
  courseController.publishCourse
);

// Unpublish course
router.patch(
  '/:courseId/unpublish',
  // protect,
  // authorizeInstructor,
  courseController.unpublishCourse
);

// Archive course
router.patch(
  '/:courseId/archive',
  // protect,
  // authorizeInstructor,
  courseController.archiveCourse
);

// Unarchive course
router.patch(
  '/:courseId/unarchive',
  // protect,
  // authorizeInstructor,
  courseController.unarchiveCourse
);

// Soft delete course
router.delete(
  '/:courseId',
  // protect,
  // authorizeInstructor,
  courseController.deleteCourse
);

module.exports = router;