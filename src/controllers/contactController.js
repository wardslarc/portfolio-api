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
      maxPoolSize: 5,
      minPoolSize: 1
    });
    
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
};

// Input validation and sanitization
const validateContactInput = (data) => {
  const { name, email, subject, message, honeypot } = data;
  const errors = [];

  // Required fields
  if (!name?.trim()) errors.push('Name is required');
  if (!email?.trim()) errors.push('Email is required');
  if (!subject?.trim()) errors.push('Subject is required');
  if (!message?.trim()) errors.push('Message is required');

  // Field length validation
  if (name && name.length > 100) errors.push('Name must be less than 100 characters');
  if (email && email.length > 255) errors.push('Email must be less than 255 characters');
  if (subject && subject.length > 200) errors.push('Subject must be less than 200 characters');
  if (message && message.length > 2000) errors.push('Message must be less than 2000 characters');

  // Email format validation
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Please provide a valid email address');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      name: name?.trim() || '',
      email: email?.toLowerCase().trim() || '',
      subject: subject?.trim() || '',
      message: message?.trim() || '',
      honeypot: honeypot?.trim() || ''
    }
  };
};

const submitContact = async (req, res) => {
  // Early honeypot check
  if (req.body.honeypot && req.body.honeypot.length > 0) {
    return res.status(200).json({
      success: true,
      message: 'Thank you for your message!'
    });
  }

  // Input validation
  const validation = validateContactInput(req.body);
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: validation.errors
    });
  }

  const { name, email, subject, message } = validation.sanitizedData;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'Unknown';

  try {
    // Ensure database connection
    const isDbConnected = await ensureDBConnection();

    // Spam detection
    const spamScore = Contact.calculateSpamScore ? 
      Contact.calculateSpamScore({ name, email, subject, message }) : 0;
    const isSpam = spamScore >= 5;

    // Save to database
    let dbSuccess = false;
    let savedContactId = null;

    if (isDbConnected && !isSpam) {
      try {
        const contactData = {
          name,
          email,
          subject,
          message,
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
        // Continue without database save - don't fail the entire request
      }
    }

    // Send emails if not spam
    let emailSuccess = false;
    if (!isSpam) {
      try {
        await emailService.sendConfirmationEmail(email, name, { subject, message });
        await emailService.sendAdminNotification({ name, email, subject, message }, ipAddress);
        emailSuccess = true;
      } catch (emailError) {
        console.error('Email sending error:', emailError.message);
        // Continue even if emails fail
      }
    }

    // Success response
    res.status(200).json({
      success: true,
      message: 'Thank you for your message! I\'ll get back to you as soon as possible.',
      savedToDatabase: dbSuccess,
      emailSent: emailSuccess,
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
  const { email, ipAddress } = req.query;
  
  // Input validation
  if (!email || !ipAddress) {
    return res.status(400).json({
      success: false,
      message: 'Email and IP address are required'
    });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address'
    });
  }

  try {
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
    
    const healthResponse = {
      success: overallHealth,
      service: 'contact',
      status: overallHealth ? 'healthy' : 'unhealthy',
      database: dbStatus,
      emailService: emailStatus,
      timestamp: new Date().toISOString()
    };

    res.status(overallHealth ? 200 : 503).json(healthResponse);
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