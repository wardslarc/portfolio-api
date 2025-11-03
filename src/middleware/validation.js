const { body, validationResult } = require('express-validator');

const validateContact = [
  // Add debug logging to see what's being received
  (req, res, next) => {
    console.log('Received contact form data:', {
      body: req.body,
      headers: req.headers['content-type'],
      method: req.method,
      timestamp: new Date().toISOString()
    });
    next();
  },
  
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
  
  body('timestamp')
    .isNumeric()
    .withMessage('Invalid form data')
    .custom((value, { req }) => {
      const submissionTime = parseInt(value);
      const currentTime = Date.now();
      const timeDiff = currentTime - submissionTime;
      
      if (timeDiff < 0) {
        throw new Error('Invalid submission timing');
      }
      
      if (timeDiff < 2000) {
        throw new Error('Please take more time to fill out the form');
      }
      
      if (timeDiff > 3600000) {
        throw new Error('Form session expired. Please refresh and try again.');
      }
      
      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      console.log('Validation errors:', {
        errors: errors.array(),
        receivedData: {
          name: req.body.name?.substring(0, 10) + '...',
          email: req.body.email?.substring(0, 5) + '...',
          subject: req.body.subject?.substring(0, 10) + '...',
          messageLength: req.body.message?.length,
          honeypot: req.body.honeypot,
          timestamp: req.body.timestamp
        }
      });

      const firstError = errors.array()[0];
      return res.status(400).json({
        success: false,
        message: firstError.msg
      });
    }
    
    console.log('Validation passed for contact form');
    next();
  }
];