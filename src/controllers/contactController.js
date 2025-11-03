const Contact = require('../models/Contact');
const emailService = require('../utils/emailService');
const mongoose = require('mongoose');

const submitContact = async (req, res) => {
  console.log('🚀 Starting contact submission process...');
  
  try {
    const { name, email, subject, message, honeypot } = req.body;

    console.log('📨 Received data:', { 
      name: name?.substring(0, 10), 
      email: email?.substring(0, 10), 
      subject: subject?.substring(0, 10), 
      messageLength: message?.length 
    });

    // Basic validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Honeypot check
    if (honeypot && honeypot.length > 0) {
      console.log('🤖 Honeypot triggered');
      return res.status(200).json({
        success: true,
        message: 'Thank you for your message!'
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'Unknown';

    // Calculate spam score
    const spamScore = Contact.calculateSpamScore ? Contact.calculateSpamScore({ name, email, subject, message }) : 0;
    const isSpam = spamScore >= 5;

    // Try to save to database with timeout
    let dbSuccess = false;
    if (mongoose.connection.readyState === 1) {
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
        const savedContact = await Promise.race([
          contact.save(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database save timeout')), 3000)
          )
        ]);
        console.log('✅ Contact saved to database with ID:', savedContact._id);
        dbSuccess = true;
      } catch (saveError) {
        console.log('⚠️ Database save failed:', saveError.message);
      }
    } else {
      console.log('⚠️ MongoDB not connected, skipping database save');
    }

    // Send emails if not spam
    if (!isSpam) {
      console.log('📧 Sending emails...');
      try {
        const confirmationResult = await emailService.sendConfirmationEmail(email, name, { subject, message });
        console.log('✅ Confirmation email:', confirmationResult.success ? 'Sent' : 'Failed');

        const adminResult = await emailService.sendAdminNotification({ name, email, subject, message }, ipAddress);
        console.log('✅ Admin notification:', adminResult.success ? 'Sent' : 'Failed');
      } catch (emailError) {
        console.error('❌ Email sending error:', emailError.message);
      }
    } else {
      console.log('🚫 Message marked as spam, skipping emails');
    }

    res.status(200).json({
      success: true,
      message: 'Thank you for your message! I\'ll get back to you as soon as possible.',
      savedToDatabase: dbSuccess,
      isSpam
    });

  } catch (error) {
    console.error('💥 Contact submission error:', error.message);
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
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
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

module.exports = {
  submitContact,
  getSubmissionStats,
  getContactHealth
};