const Contact = require('../models/Contact');
const emailService = require('../utils/emailService');
const mongoose = require('mongoose');

const submitContact = async (req, res) => {
  console.log('🚀 STARTING CONTACT SUBMISSION PROCESS...');
  
  try {
    const { name, email, subject, message, honeypot } = req.body;

    console.log('📨 RECEIVED FORM DATA:', { 
      name, 
      email, 
      subject, 
      messageLength: message?.length,
      honeypot 
    });

    // Basic validation
    if (!name || !email || !subject || !message) {
      console.log('❌ MISSING REQUIRED FIELDS');
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Honeypot check
    if (honeypot && honeypot.length > 0) {
      console.log('🤖 HONEYPOT TRIGGERED');
      return res.status(200).json({
        success: true,
        message: 'Thank you for your message!'
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'Unknown';

    console.log('🔍 CHECKING MONGODB CONNECTION...');
    console.log('📊 MongoDB readyState:', mongoose.connection.readyState);
    
    // Calculate spam score
    const spamScore = Contact.calculateSpamScore ? Contact.calculateSpamScore({ name, email, subject, message }) : 0;
    const isSpam = spamScore >= 5;
    console.log('🎯 SPAM SCORE:', spamScore, 'IS SPAM:', isSpam);

    // Try to save to database
    let dbSuccess = false;
    let savedContactId = null;
    
    if (mongoose.connection.readyState === 1) {
      console.log('💾 ATTEMPTING TO SAVE TO DATABASE...');
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

        console.log('📝 CONTACT DATA TO SAVE:', contactData);
        
        const contact = new Contact(contactData);
        const savedContact = await contact.save();
        savedContactId = savedContact._id;
        dbSuccess = true;
        console.log('✅ SUCCESS: Contact saved to database with ID:', savedContactId);
      } catch (saveError) {
        console.log('❌ DATABASE SAVE ERROR:', saveError.message);
        console.log('💾 ERROR DETAILS:', saveError);
      }
    } else {
      console.log('⚠️ MONGODB NOT CONNECTED, SKIPPING DATABASE SAVE');
    }

    // Send emails if not spam
    if (!isSpam) {
      console.log('📧 ATTEMPTING TO SEND EMAILS...');
      
      // Send confirmation email to user
      try {
        console.log('👤 SENDING CONFIRMATION EMAIL TO:', email);
        const confirmationResult = await emailService.sendConfirmationEmail(email, name, { subject, message });
        console.log('📩 CONFIRMATION EMAIL RESULT:', confirmationResult);
        
        if (confirmationResult.success) {
          console.log('✅ CONFIRMATION EMAIL SENT SUCCESSFULLY');
        } else {
          console.log('❌ CONFIRMATION EMAIL FAILED:', confirmationResult.error);
        }
      } catch (emailError) {
        console.log('💥 CONFIRMATION EMAIL ERROR:', emailError.message);
      }

      // Send admin notification
      try {
        console.log('👨‍💼 SENDING ADMIN NOTIFICATION...');
        const adminResult = await emailService.sendAdminNotification({ name, email, subject, message }, ipAddress);
        console.log('📨 ADMIN NOTIFICATION RESULT:', adminResult);
        
        if (adminResult.success) {
          console.log('✅ ADMIN NOTIFICATION SENT SUCCESSFULLY');
        } else {
          console.log('❌ ADMIN NOTIFICATION FAILED:', adminResult.error);
        }
      } catch (adminError) {
        console.log('💥 ADMIN NOTIFICATION ERROR:', adminError.message);
      }
    } else {
      console.log('🚫 MESSAGE MARKED AS SPAM, SKIPPING EMAILS');
    }

    console.log('🎉 FORM SUBMISSION COMPLETE');
    res.status(200).json({
      success: true,
      message: 'Thank you for your message! I\'ll get back to you as soon as possible.',
      savedToDatabase: dbSuccess,
      contactId: savedContactId,
      isSpam
    });

  } catch (error) {
    console.error('💥 CONTACT SUBMISSION ERROR:', error.message);
    console.error('🔍 ERROR STACK:', error.stack);
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