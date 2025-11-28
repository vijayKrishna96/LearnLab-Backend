const express = require("express");
const router = express.Router();
const multer = require("multer");
const courseController = require("../controllers/courseController");
const {
  courseValidators,
  handleValidationErrors,
} = require("../validators/courseValidator");

const upload = multer({ dest: "uploads/" });

/* --------------------------------------
   PUBLIC ROUTES (available without auth)
--------------------------------------- */

// Public course list
router.get("/public", courseController.getAllCourses);

// Search
router.get("/search", courseController.searchCourses);

// Filter
router.get("/filter", courseController.filterCourses);

// Preview (before purchase)
router.get("/preview/:courseId", courseController.getCoursePreviewById);

// Cart / Wishlist
router.post("/cart", courseController.getCoursesForCart);
router.post("/wishlist", courseController.getCoursesForWishlist);

/* --------------------------------------
   PROTECTED ROUTES (enrolled students)
--------------------------------------- */

router.get("/learning/:courseId", courseController.getFullCourseById);

/* --------------------------------------
   ADMIN / INSTRUCTOR ROUTES
--------------------------------------- */

router.post(
  "/",
  upload.array("images", 20),
  courseValidators.createCourse,
  handleValidationErrors,
  courseController.createCourse
);

router.put(
  "/:courseId",
  upload.array("images", 20),
  courseValidators.validateCourseId,
  handleValidationErrors,
  courseController.updateCourse
);

router.delete(
  "/:courseId",
  courseValidators.validateCourseId,
  handleValidationErrors,
  courseController.deleteCourse
);

/* --------------------------------------
   SHARED ROUTES
--------------------------------------- */

router.post(
  "/by-ids",
  courseValidators.validateCourseIds,
  handleValidationErrors,
  courseController.getCoursesByIds
);

router.get(
  "/:courseId",
  courseValidators.validateCourseId,
  handleValidationErrors,
  courseController.getSingleCourse
);

module.exports = router;
