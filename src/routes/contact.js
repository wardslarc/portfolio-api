const express = require('express');
const { submitContact, getSubmissionStats, getContactHealth, getContactMetrics } = require('../controllers/contactController');
const { validateContact, validateStats, securityHeaders, validateRateLimit } = require('../middleware/validation');

const router = express.Router();

// Apply security headers to all contact routes
router.use(securityHeaders);

// Request logging middleware for contact routes
router.use((req, res, next) => {
  console.log('Contact API request:', {
    method: req.method,
    path: req.path,
    ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')?.substring(0, 100) || 'Unknown',
    timestamp: new Date().toISOString()
  });
  
  // Store start time for request timing
  req._startTime = Date.now();
  next();
});

// Contact form submission with comprehensive protection
router.post('/submit', 
  validateRateLimit,                    // Additional rate limiting
  enforceHoneypot,                      // Honeypot enforcement
  validateContact,                      // Input validation (express-validator)
  checkSubmissionEligibility,           // Pre-submission checks
  submitContact                         // Main controller
);

// Submission stats with IP validation
router.get('/stats',
  validateStats,                        // Query validation
  getSubmissionStats                    // Stats controller
);

// Health check with additional diagnostics
router.get('/health', 
  getContactHealth                      // Health check
);

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await getContactMetrics();
    
    res.json({
      success: true,
      service: 'contact-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      metrics: metrics || { message: 'Metrics temporarily unavailable' },
      endpoints: {
        submit: 'POST /api/contact/submit',
        stats: 'GET /api/contact/stats',
        health: 'GET /api/contact/health',
        metrics: 'GET /api/contact/metrics'
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'contact-api',
      message: 'Unable to retrieve metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler for contact routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Contact endpoint not found',
    availableEndpoints: [
      'POST /api/contact/submit',
      'GET /api/contact/stats', 
      'GET /api/contact/health',
      'GET /api/contact/metrics'
    ]
  });
});

// Error handler for contact routes
router.use((error, req, res, next) => {
  console.error('Contact route error:', error);
  
  // Database connection errors
  if (error.name === 'MongoNetworkError' || error.name === 'MongooseServerSelectionError') {
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Please try again later.'
    });
  }
  
  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: Object.values(error.errors).map(e => e.message)
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    message: 'Internal server error in contact API'
  });
});

// Middleware functions

/**
 * Honeypot enforcement middleware
 * Detects and blocks spam bots that fill hidden form fields
 */
function enforceHoneypot(req, res, next) {
  // Check for common honeypot field names
  const honeypotFields = ['honeypot', 'website', 'url', 'phone', 'company', 'confirm_email'];
  const hasHoneypotData = honeypotFields.some(field => 
    req.body[field] && req.body[field].toString().trim().length > 0
  );

  // Additional check for timing-based spam detection (quick form submission)
  const submissionTime = Date.now();
  const requestStartTime = req._startTime || submissionTime;
  const timeToSubmit = submissionTime - requestStartTime;

  // If form was submitted too quickly (less than 1 second), likely spam
  const tooQuick = timeToSubmit < 1000;

  if (hasHoneypotData || tooQuick) {
    console.log('Honeypot triggered:', { 
      hasHoneypotData, 
      tooQuick, 
      timeToSubmit,
      ip: req.ip 
    });
    
    // Return success to spam bots but don't process
    return res.status(200).json({
      success: true,
      message: 'Thank you for your message!'
    });
  }
  
  next();
}

/**
 * Pre-submission eligibility check middleware
 * Performs additional validation before main processing
 */
async function checkSubmissionEligibility(req, res, next) {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const email = req.body.email;

    // Quick validation double-check (redundant but safe)
    if (!email || !ipAddress || ipAddress === 'unknown') {
      return res.status(400).json({
        success: false,
        message: 'Missing required information for submission'
      });
    }

    // Store IP address for controller use
    req.clientIp = ipAddress.split(',')[0].trim(); // Handle X-Forwarded-For format
    
    next();
  } catch (error) {
    console.error('Eligibility check error:', error);
    // Continue anyway, don't block legitimate users due to middleware errors
    next();
  }
}

module.exports = router;