const express = require('express');
const { submitContact, getSubmissionStats } = require('../controllers/contactController');
const { validateContact } = require('../middleware/validation');

const router = express.Router();

// Helper function to set CORS headers for OPTIONS
const setCorsOptionsHeaders = (req, res) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://carlsdaleescalo.com',
    'http://localhost:5173'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(204).end(); // No content for OPTIONS
};

// Handle preflight OPTIONS requests
router.options('/submit', setCorsOptionsHeaders);
router.options('/stats', setCorsOptionsHeaders);

// Your existing routes
router.post('/submit', validateContact, submitContact);
router.get('/stats', getSubmissionStats);

module.exports = router;