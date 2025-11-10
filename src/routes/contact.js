const express = require('express');
const { submitContact, getSubmissionStats, getContactHealth } = require('../controllers/contactController');
const { validateContact, validateStats, securityHeaders, validateRateLimit } = require('../middleware/validation');

const router = express.Router();

// Apply security headers to all contact routes
router.use(securityHeaders);

// Request logging middleware for contact routes
router.use((req, res, next) => {
  console.log('Contact API request:', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  next();
});

// Contact form submission with comprehensive protection
router.post('/submit', 
  validateRateLimit,                    // Rate limiting
  enforceHoneypot,                      // Honeypot enforcement
  validateContact,                      // Input validation
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
router.get('/metrics', (req, res) => {
  res.json({
    service: 'contact-api',
    version: '1.0.0',
    endpoints: {
      submit: 'POST /api/contact/submit',
      stats: 'GET /api/contact/stats',
      health: 'GET /api/contact/health',
      metrics: 'GET /api/contact/metrics'
    },
    timestamp: new Date().toISOString()
  });
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
  res.status(500).json({
    success: false,
    message: 'Internal server error in contact API'
  });
});

// Additional middleware functions

// Honeypot enforcement
function enforceHoneypot(req, res, next) {
  // Check for common honeypot field names
  const honeypotFields = ['honeypot', 'website', 'url', 'phone', 'company'];
  const hasHoneypotData = honeypotFields.some(field => 
    req.body[field] && req.body[field].length > 0
  );

  if (hasHoneypotData) {
    return res.status(200).json({
      success: true,
      message: 'Thank you for your message!'
    });
  }
  next();
}

// Pre-submission eligibility check
async function checkSubmissionEligibility(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const email = req.body.email;

    // Quick client-side validation double-check
    if (!email || !ipAddress) {
      return res.status(400).json({
        success: false,
        message: 'Missing required information'
      });
    }

    next();
  } catch (error) {
    console.error('Eligibility check error:', error);
    next(); // Continue anyway, don't block legitimate users
  }
}

module.exports = router;