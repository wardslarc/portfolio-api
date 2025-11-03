const Contact = require('../models/Contact');
const emailService = require('../utils/emailService');

// Helper function to set CORS headers
const setCorsHeaders = (req, res) => {
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
};

const submitContact = async (req, res) => {
  // Set CORS headers for the response
  setCorsHeaders(req, res);

  try {
    const { name, email, subject, message, honeypot, timestamp } = req.body;

    // Honeypot check
    if (honeypot && honeypot.length > 0) {
      console.log('Honeypot triggered:', { email, ip: req.ip });
      return res.status(200).json({
        success: true,
        message: 'Thank you for your message!'
      });
    }

    // Timing check
    const formFillTime = Date.now() - timestamp;
    if (formFillTime < 5000) {
      return res.status(429).json({
        error: 'Please take more time to fill out the form.'
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Check submission limits
    const submissionCheck = await Contact.checkSubmissionLimit(email, ipAddress);
    
    if (submissionCheck.isOverLimit) {
      return res.status(429).json({
        error: 'You have reached the submission limit. Please try again in 24 hours.'
      });
    }

    // Calculate spam score
    const spamScore = Contact.calculateSpamScore({ name, email, subject, message });
    const isSpam = spamScore >= 5;

    // Create contact entry
    const contact = new Contact({
      name,
      email,
      subject,
      message,
      ipAddress,
      userAgent,
      spamScore,
      isSpam
    });

    await contact.save();

    // Send emails (don't await to avoid blocking response)
    if (!isSpam) {
      // Send confirmation email to user
      emailService.sendConfirmationEmail(email, name, { subject, message })
        .then(result => {
          if (result.success) {
            console.log('Confirmation email sent successfully to:', email);
          } else {
            console.error('Failed to send confirmation email:', result.error);
          }
        })
        .catch(error => {
          console.error('Error in email sending process:', error);
        });

      // Send notification email to admin
      emailService.sendAdminNotification({ name, email, subject, message }, ipAddress)
        .then(result => {
          if (result.success) {
            console.log('Admin notification sent successfully');
          } else {
            console.error('Failed to send admin notification:', result.error);
          }
        })
        .catch(error => {
          console.error('Error in admin notification process:', error);
        });
    }

    // Log submission for monitoring
    console.log(`Contact form submitted:`, {
      email,
      ip: ipAddress,
      spamScore,
      isSpam,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: 'Thank you for your message! I\'ll get back to you as soon as possible.',
      isSpam,
      emailSent: !isSpam // Indicate if confirmation email was sent
    });

  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(500).json({
      error: 'There was an error submitting your message. Please try again later.'
    });
  }
};

const getSubmissionStats = async (req, res) => {
  // Set CORS headers for the response
  setCorsHeaders(req, res);

  try {
    const { email, ipAddress } = req.query;
    
    if (!email || !ipAddress) {
      return res.status(400).json({
        error: 'Email and IP address are required'
      });
    }

    const stats = await Contact.checkSubmissionLimit(email, ipAddress);
    
    res.json({
      emailCount: stats.emailCount,
      ipCount: stats.ipCount,
      remaining: Math.max(0, 3 - stats.emailCount)
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get submission stats' });
  }
};

module.exports = {
  submitContact,
  getSubmissionStats
};