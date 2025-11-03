const { body, validationResult } = require('express-validator');

const validateContact = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .escape(),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email must not exceed 100 characters'),
  
  body('subject')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Subject must be between 5 and 100 characters')
    .escape(),
  
  body('message')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Message must be between 10 and 1000 characters')
    .escape(),
  
  body('honeypot')
    .optional()
    .isLength({ max: 0 })
    .withMessage('Honeypot field should be empty'),
  
  body('timestamp')
    .isNumeric()
    .custom((value) => {
      const timeDiff = Date.now() - value;
      return timeDiff > 0 && timeDiff < 10000;
    })
    .withMessage('Invalid submission timing'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateContact
};