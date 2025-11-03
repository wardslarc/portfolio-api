const express = require('express');
const { submitContact, getSubmissionStats, getContactHealth } = require('../controllers/contactController');
const { validateContact, validateStats } = require('../middleware/validation');

const router = express.Router();

console.log('Setting up contact routes...');

// Main routes
router.post('/submit', validateContact, submitContact);
router.get('/stats', validateStats, getSubmissionStats);
router.get('/health', getContactHealth);

console.log('Contact routes setup complete');
module.exports = router;