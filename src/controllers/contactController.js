const Contact = require('../models/Contact');
const emailService = require('../utils/emailService');
const mongoose = require('mongoose');

// Database connection helper for serverless environment
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;

  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
    });
    
    return true;
  } catch (error) {
    console.error('Database reconnection failed');
    return false;
  }
};

const submitContact = async (req, res) => {
  try {
    const { name, email, subject, message, honeypot } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Honeypot check
    if (honeypot && honeypot.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Thank you for your message!'
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'Unknown';

    // Ensure database connection
    const isDbConnected = await ensureDBConnection();

    // Spam detection
    const spamScore = Contact.calculateSpamScore ? 
      Contact.calculateSpamScore({ name, email, subject, message }) : 0;
    const isSpam = spamScore >= 5;

    // Save to database
    let dbSuccess = false;
    let savedContactId = null;

    if (isDbConnected) {
      try {
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
        const savedContact = await contact.save();
        savedContactId = savedContact._id;
        dbSuccess = true;
      } catch (saveError) {
        console.error('Database save error:', saveError.message);
      }
    }

    // Send emails if not spam
    if (!isSpam) {
      try {
        await emailService.sendConfirmationEmail(email, name, { subject, message });
        await emailService.sendAdminNotification({ name, email, subject, message }, ipAddress);
      } catch (emailError) {
        console.error('Email sending error:', emailError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Thank you for your message! I\'ll get back to you as soon as possible.',
      savedToDatabase: dbSuccess,
      isSpam
    });

  } catch (error) {
    console.error('Contact submission error:', error.message);
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

    await ensureDBConnection();
    const stats = await Contact.checkSubmissionLimit(email, ipAddress);
    
    res.json({
      success: true,
      emailCount: stats.emailCount,
      ipCount: stats.ipCount,
      remaining: Math.max(0, 3 - stats.emailCount)
    });
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get submission stats' 
    });
  }
};

const getContactHealth = async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const emailStatus = emailService.isReady ? emailService.isReady() : false;
    
    const overallHealth = dbStatus === 'connected' && emailStatus;
    
    if (overallHealth) {
      res.json({
        success: true,
        service: 'contact',
        status: 'healthy',
        database: dbStatus,
        emailService: emailStatus,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        success: false,
        service: 'contact',
        status: 'unhealthy',
        database: dbStatus,
        emailService: emailStatus,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Health check error:', error.message);
    res.status(503).json({
      success: false,
      service: 'contact',
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  submitContact,
  getSubmissionStats,
  getContactHealth
};