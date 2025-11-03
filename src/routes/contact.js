const express = require('express');
const { submitContact, getSubmissionStats } = require('../controllers/contactController');
const { validateContact } = require('../middleware/validation'); // lowercase

const router = express.Router();

router.post('/submit', validateContact, submitContact);
router.get('/stats', getSubmissionStats);

module.exports = router;