const express = require('express');
const router = express.Router();

// Simple test route
router.post('/submit', (req, res) => {
  console.log('Received contact form submission');
  res.json({
    success: true,
    message: 'Form submitted successfully (test version)'
  });
});

// Simple stats route
router.get('/stats', (req, res) => {
  res.json({
    emailCount: 0,
    ipCount: 0,
    remaining: 3
  });
});

// Simple health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'contact',
    timestamp: new Date().toISOString()
  });
});

console.log('Contact routes loaded successfully');
module.exports = router;