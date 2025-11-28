const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const courseValidators = {
  // Validation rules for creating a course
  createCourse: [
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required')
      .isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    
    body('description')
      .trim()
      .notEmpty().withMessage('Description is required')
      .isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    
    body('category')
      .notEmpty().withMessage('Category is required')
      .custom((value) => mongoose.Types.ObjectId.isValid(value))
      .withMessage('Invalid category ID'),
    
    body('price')
      .isNumeric().withMessage('Price must be a number')
      .isFloat({ min: 0 }).withMessage('Price cannot be negative'),
    
    body('instructor')
      .notEmpty().withMessage('Instructor is required')
      .custom((value) => mongoose.Types.ObjectId.isValid(value))
      .withMessage('Invalid instructor ID'),
    
    body('modules')
      .notEmpty().withMessage('At least one module is required'),
    
    body('level')
      .optional()
      .isIn(['beginner', 'intermediate', 'advanced'])
      .withMessage('Invalid level'),
  ],

  // Validation for course ID parameter
  validateCourseId: [
    param('courseId')
      .custom((value) => mongoose.Types.ObjectId.isValid(value))
      .withMessage('Invalid course ID')
  ],

  // Validation for fetching by IDs
  validateCourseIds: [
    body('ids')
      .isArray({ min: 1 }).withMessage('IDs must be a non-empty array')
      .custom((ids) => ids.every(id => mongoose.Types.ObjectId.isValid(id)))
      .withMessage('All IDs must be valid MongoDB ObjectIds')
  ]
};

// Middleware to handle validation results
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

module.exports = { courseValidators, handleValidationErrors };
