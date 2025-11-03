const { body, validationResult } = require('express-validator');

const validateContact = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email is too long')
    .custom((email) => {
      // Check for disposable/temporary emails
      const disposableDomains = [
        'tempmail.com', 'guerrillamail.com', 'mailinator.com', 
        '10minutemail.com', 'yopmail.com', 'throwaway.com'
      ];
      const domain = email.split('@')[1];
      if (disposableDomains.some(disposable => domain.includes(disposable))) {
        throw new Error('Please use a permanent email address');
      }
      return true;
    }),
  
  body('subject')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Subject must be between 5 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,!?()]+$/)
    .withMessage('Subject contains invalid characters')
    .escape(),
  
  body('message')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Message must be between 10 and 1000 characters')
    .custom((message) => {
      // Check for excessive capital letters (potential spam)
      const capitalRatio = (message.match(/[A-Z]/g) || []).length / message.length;
      if (capitalRatio > 0.7) {
        throw new Error('Message contains too many capital letters');
      }
      
      // Check for excessive links
      const linkCount = (message.match(/https?:\/\/[^\s]+/g) || []).length;
      if (linkCount > 3) {
        throw new Error('Message contains too many links');
      }
      
      return true;
    })
    .escape(),
  
  body('honeypot')
    .optional()
    .isLength({ max: 0 })
    .withMessage('Form submission error'), // Generic message
  
  body('timestamp')
    .isNumeric()
    .withMessage('Invalid form data')
    .custom((value, { req }) => {
      const submissionTime = parseInt(value);
      const currentTime = Date.now();
      const timeDiff = currentTime - submissionTime;
      
      // Check if timestamp is in the future (potential tampering)
      if (timeDiff < 0) {
        throw new Error('Invalid submission timing');
      }
      
      // Check if form was filled too quickly (bot) or too slowly (potential issues)
      if (timeDiff < 2000) { // Less than 2 seconds
        throw new Error('Please take more time to fill out the form');
      }
      
      if (timeDiff > 3600000) { // More than 1 hour
        throw new Error('Form session expired. Please refresh and try again.');
      }
      
      return true;
    }),

  // Custom validation for overall request
  body().custom((value, { req }) => {
    // Check for excessive field lengths overall
    const totalLength = JSON.stringify(req.body).length;
    if (totalLength > 5000) {
      throw new Error('Form data too large');
    }
    return true;
  }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Log validation errors for monitoring (but don't expose to client)
      console.log('Form validation failed:', {
        path: req.path,
        ip: req.ip ? req.ip.substring(0, 7) + '***' : 'unknown',
        errors: errors.array().map(err => ({
          field: err.path,
          type: err.type
        })),
        timestamp: new Date().toISOString()
      });

      // Return generic error message to client
      const firstError = errors.array()[0];
      return res.status(400).json({
        success: false,
        message: firstError.msg // Only return the first error message
      });
    }
    
    // Log successful validation for monitoring
    console.log('Form validation passed:', {
      path: req.path,
      ip: req.ip ? req.ip.substring(0, 7) + '***' : 'unknown',
      timestamp: new Date().toISOString()
    });
    
    next();
  }
];

// Optional: Separate validation for the stats endpoint
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
      console.log('Stats validation failed:', {
        errors: errors.array().map(err => err.path),
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters'
      });
    }
    next();
  }
];

// Health check validation (if needed)
const validateHealth = [
  // Add any health check parameters validation here
  (req, res, next) => {
    next();
  }
];

module.exports = {
  validateContact,
  validateStats,
  validateHealth
};