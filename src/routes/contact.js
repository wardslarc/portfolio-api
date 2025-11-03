const express = require('express');
const { submitContact, getSubmissionStats, getContactHealth } = require('../controllers/contactController');
const { validateContact, validateStats } = require('../middleware/validation');

const router = express.Router();

// Rate limiting configuration (in-memory for simplicity)
const rateLimitMap = new Map();

// Simple rate limiting middleware for contact routes
const contactRateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 10; // More restrictive for contact endpoints

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, startTime: now });
    return next();
  }

  const ipData = rateLimitMap.get(ip);

  // Reset if window has passed
  if (now - ipData.startTime > windowMs) {
    ipData.count = 1;
    ipData.startTime = now;
    return next();
  }

  // Check if over limit
  if (ipData.count >= maxRequests) {
    console.log('Rate limit exceeded:', {
      ip: ip ? ip.substring(0, 7) + '***' : 'unknown',
      count: ipData.count,
      path: req.path
    });
    
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.'
    });
  }

  // Increment count
  ipData.count++;
  next();
};

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now - data.startTime > windowMs) {
      rateLimitMap.delete(ip);
    }
  }
}, 60 * 1000); // Clean every minute

// Apply rate limiting to all contact routes
router.use(contactRateLimit);

// Main contact submission endpoint
router.post('/submit', validateContact, submitContact);

// Stats endpoint with validation
router.get('/stats', validateStats, getSubmissionStats);

// Health check endpoint
router.get('/health', getContactHealth);

// Optional: Preview endpoint (if you want to validate without submitting)
router.post('/preview', validateContact, (req, res) => {
  // Just validate and return success without saving
  res.json({
    success: true,
    message: 'Form validation successful'
  });
});

// Export the router
module.exports = router;