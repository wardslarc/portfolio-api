const { body, validationResult } = require('express-validator');

const validateContact = [
  // Add debug logging to see what's being received
  (req, res, next) => {
    console.log('Validation middleware - received data:', {
      name: req.body.name?.substring(0, 10),
      email: req.body.email?.substring(0, 10),
      subject: req.body.subject?.substring(0, 10),
      messageLength: req.body.message?.length,
      honeypot: req.body.honeypot,
      timestamp: req.body.timestamp
    });
    next();
  },
  
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .escape(),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email is too long'),
  
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
    .withMessage('Form submission error'),
  
  // Removed timestamp validation - just log it
  body('timestamp')
    .optional()
    .isNumeric()
    .withMessage('Invalid form data'),

  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      
      const firstError = errors.array()[0];
      return res.status(400).json({
        success: false,
        message: firstError.msg
      });
    }
    
    console.log('Validation passed');
    next();
  }
];

const validateStats = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  
  body('ipAddress')
    .isIP()
    .withMessage('Valid IP address is required'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Stats validation failed:', errors.array());
      
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters'
      });
    }
    next();
  }
];

module.exports = {
  validateContact,
  validateStats
};