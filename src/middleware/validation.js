const { body, validationResult, query } = require('express-validator');
const validateContact = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email must be less than 100 characters'),
  
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 5, max: 100 })
    .withMessage('Subject must be between 5 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,!?()]+$/)
    .withMessage('Subject contains invalid characters')
    .escape(),
  
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Message must be between 10 and 1000 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,!?()@#$%^&*+=<>[\]{}:;'"\\|/`~]+$/)
    .withMessage('Message contains invalid characters')
    .escape(),
  
  body('honeypot')
    .optional()
    .isLength({ max: 0 })
    .withMessage('Form submission error'),

  // Remove timestamp validation entirely
  // Remove form submission timing validation

  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      
      // Log validation failures for monitoring
      console.warn('Contact form validation failed:', {
        ip: req.ip,
        errors: errors.array().map(e => e.msg),
        fields: Object.keys(req.body)
      });
      
      return res.status(400).json({
        success: false,
        message: firstError.msg,
        ...(process.env.NODE_ENV !== 'production' && {
          details: errors.array()
        })
      });
    }
    
    next();
  }
];

const validateStats = [
  query('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email is too long'),
  
  query('ipAddress')
    .notEmpty()
    .withMessage('IP address is required')
    .isIP()
    .withMessage('Valid IP address is required')
    .custom((value) => {
      // Check for private IP ranges
      if (value.startsWith('192.168.') || 
          value.startsWith('10.') || 
          value.startsWith('172.') ||
          value === '127.0.0.1' ||
          value === '::1') {
        throw new Error('Invalid IP address range');
      }
      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('Stats validation failed:', {
        ip: req.ip,
        errors: errors.array().map(e => e.msg),
        query: req.query
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters'
      });
    }
    next();
  }
];

// Additional middleware for security headers
const securityHeaders = (req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'DENY');
  
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy for API endpoints
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  
  next();
};

// Rate limiting helper (complementary to main rate limiting)
const validateRateLimit = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 10;
  
  // Simple in-memory rate limiting as additional protection
  if (!req.rateLimit) {
    req.rateLimit = {
      [ip]: []
    };
  }
  
  const requests = req.rateLimit[ip] || [];
  const recentRequests = requests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.'
    });
  }
  
  recentRequests.push(now);
  req.rateLimit[ip] = recentRequests;
  next();
};

module.exports = {
  validateContact,
  validateStats,
  securityHeaders,
  validateRateLimit
};