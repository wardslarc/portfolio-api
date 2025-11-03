const express = require('express');
const { submitContact, getSubmissionStats, getContactHealth } = require('../controllers/contactController');
const { validateContact, validateStats } = require('../middleware/validation');

const router = express.Router();

console.log('Setting up contact routes...');

// Main routes
router.post('/submit', validateContact, submitContact);
router.get('/stats', validateStats, getSubmissionStats);
router.get('/health', getContactHealth);
// Add this test route to debug email issues
router.get('/test-email', async (req, res) => {
  try {
    console.log('🧪 TESTING EMAIL SERVICE...');
    
    // Test configuration
    const config = {
      EMAIL_HOST: process.env.EMAIL_HOST ? 'set' : 'missing',
      EMAIL_USER: process.env.EMAIL_USER ? 'set' : 'missing',
      EMAIL_PASS: process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-3) : 'missing',
      FROM_EMAIL: process.env.FROM_EMAIL ? 'set' : 'missing',
      FROM_NAME: process.env.FROM_NAME ? 'set' : 'missing'
    };
    
    console.log('📧 Configuration:', config);
    
    // Test email service readiness
    const emailReady = emailService.isReady();
    console.log('✅ Email service ready:', emailReady);
    
    // If email service is ready, try to send a test email
    let testResult = null;
    if (emailReady) {
      console.log('🔄 Attempting to send test email...');
      testResult = await emailService.sendConfirmationEmail(
        process.env.EMAIL_USER, // Send to yourself
        'Test User',
        { subject: 'Test Email', message: 'This is a test email from your contact form API.' }
      );
      console.log('📩 Test email result:', testResult);
    }
    
    res.json({
      success: true,
      emailConfiguration: config,
      emailServiceReady: emailReady,
      testEmailResult: testResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Email test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

console.log('Contact routes setup complete');
module.exports = router;