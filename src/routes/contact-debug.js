const express = require('express');
const router = express.Router();

console.log('=== DEBUG: Starting contact routes ===');

// Test if controllers exist
try {
  const controllers = require('../controllers/contactController');
  console.log('Controllers loaded:', Object.keys(controllers));
  console.log('submitContact type:', typeof controllers.submitContact);
  console.log('getSubmissionStats type:', typeof controllers.getSubmissionStats);
  console.log('getContactHealth type:', typeof controllers.getContactHealth);
} catch (error) {
  console.error('Error loading controllers:', error);
}

// Test if middleware exists
try {
  const validation = require('../middleware/validation');
  console.log('Validation loaded:', Object.keys(validation));
  console.log('validateContact type:', typeof validation.validateContact);
} catch (error) {
  console.error('Error loading validation:', error);
}

// Simple test route
router.post('/submit', (req, res) => {
  console.log('DEBUG: Submit route hit');
  res.json({ success: true, message: 'Debug route working' });
});

console.log('=== DEBUG: Contact routes loaded ===');
module.exports = router;