const Contact = require('../models/Contact');
const emailService = require('../utils/emailService');
const mongoose = require('mongoose'); // Add this import

const submitContact = async (req, res) => {
  console.log('Starting contact submission process...');
  
  try {
    const { name, email, subject, message, honeypot, timestamp } = req.body;

    console.log('Received data:', { name, email, subject, message: message?.substring(0, 50) + '...' });

    // Basic validation
    if (!name || !email || !subject || !message) {
      console.log('Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Honeypot check
    if (honeypot && honeypot.length > 0) {
      console.log('Honeypot triggered');
      return res.status(200).json({
        success: true,
        message: 'Thank you for your message!'
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'Unknown';

    console.log('Checking submission limits...');
    // Check submission limits
    const submissionCheck = await Contact.checkSubmissionLimit(email, ipAddress);
    
    if (submissionCheck.isOverLimit) {
      console.log('Submission limit reached');
      return res.status(429).json({
        success: false,
        message: 'You have reached the submission limit. Please try again in 24 hours.'
      });
    }

    console.log('Calculating spam score...');
    // Calculate spam score
    const spamScore = Contact.calculateSpamScore({ name, email, subject, message });
    const isSpam = spamScore >= 5;

    console.log('Creating contact entry...');
    // Create contact entry
    const contactData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      subject: subject.trim(),
      message: message.trim(),
      ipAddress,
      userAgent,
      spamScore,
      isSpam
    };

    const contact = new Contact(contactData);
    await contact.save();
    console.log('Contact saved to database with ID:', contact._id);

    // Send emails if not spam - MAKE SURE THIS CODE IS EXECUTING
    if (!isSpam) {
      console.log('Sending emails...');
      try {
        // Send confirmation email
        const confirmationResult = await emailService.sendConfirmationEmail(email, name, { subject, message });
        console.log('Confirmation email result:', confirmationResult);

        // Send admin notification
        const adminResult = await emailService.sendAdminNotification({ name, email, subject, message }, ipAddress);
        console.log('Admin notification result:', adminResult);
      } catch (emailError) {
        console.error('Email sending error:', emailError.message);
      }
    } else {
      console.log('Message marked as spam, skipping emails. Spam score:', spamScore);
    }

    res.status(200).json({
      success: true,
      message: 'Thank you for your message! I\'ll get back to you as soon as possible.',
      isSpam
    });

  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(500).json({
      success: false,
      message: 'There was an error submitting your message. Please try again later.'
    });
  }
};

const getSubmissionStats = async (req, res) => {
  try {
    const { email, ipAddress } = req.query;
    
    if (!email || !ipAddress) {
      return res.status(400).json({
        success: false,
        message: 'Email and IP address are required'
      });
    }

    const stats = await Contact.checkSubmissionLimit(email, ipAddress);
    
    res.json({
      success: true,
      emailCount: stats.emailCount,
      ipCount: stats.ipCount,
      remaining: Math.max(0, 3 - stats.emailCount)
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get submission stats' 
    });
  }
};

const getContactHealth = async (req, res) => {
  try {
    // Test database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Test email service
    const emailStatus = emailService.isReady ? emailService.isReady() : false;
    
    res.json({
      success: true,
      service: 'contact',
      database: dbStatus,
      emailService: emailStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Contact health check error:', error.message);
    res.status(503).json({
      success: false,
      service: 'contact',
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
};

// Make sure all functions are exported
module.exports = {
  submitContact,
  getSubmissionStats,
  getContactHealth
};