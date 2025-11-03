const express = require('express');
const { submitContact, getSubmissionStats, getContactHealth } = require('../controllers/contactController');
const { validateContact, validateStats } = require('../middleware/validation');

const router = express.Router();

// Contact form routes
router.post('/submit', validateContact, submitContact);
router.get('/stats', validateStats, getSubmissionStats);
router.get('/health', getContactHealth);

module.exports = router;