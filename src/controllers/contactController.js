const Contact = require('../models/Contact');
const emailService = require('../utils/emailService');
const mongoose = require('mongoose');

// Database connection helper for serverless environment
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    console.log('📊 MongoDB already connected');
    return true;
  }

  console.log('🔄 MongoDB disconnected, attempting to reconnect...');
  
  try {
    // Close any existing connection that might be in a bad state
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    
    // Reconnect with simple options
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
    });
    
    console.log('✅ MongoDB reconnected successfully');
    console.log('📊 New connection state:', mongoose.connection.readyState);
    return true;
  } catch (error) {
    console.error('❌ MongoDB reconnection failed:', error.message);
    return false;
  }
};

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
    
    // Ensure database connection before proceeding
    const isDbConnected = await ensureDBConnection();
    console.log('📊 Database connection result:', isDbConnected);

    // Calculate spam score
    const spamScore = Contact.calculateSpamScore ? Contact.calculateSpamScore({ name, email, subject, message }) : 0;
    const isSpam = spamScore >= 5;
    console.log('🎯 SPAM SCORE:', spamScore, 'IS SPAM:', isSpam);

    // Try to save to database
    let dbSuccess = false;
    let savedContactId = null;

    if (isDbConnected) {
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
        
        // If it's a connection error, try one more reconnection
        if (saveError.name === 'MongoNetworkError' || saveError.message.includes('connection')) {
          console.log('🔄 Retrying database connection after save error...');
          const retryConnected = await ensureDBConnection();
          if (retryConnected) {
            try {
              const contact = new Contact(contactData);
              const savedContact = await contact.save();
              savedContactId = savedContact._id;
              dbSuccess = true;
              console.log('✅ SUCCESS: Contact saved on retry with ID:', savedContactId);
            } catch (retryError) {
              console.log('❌ Database save failed on retry:', retryError.message);
            }
          }
        }
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

    // Ensure database connection first
    await ensureDBConnection();
    
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
    console.log('🔍 RUNNING HEALTH CHECK...');
    
    // Check MongoDB connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    console.log('📊 MongoDB readyState:', mongoose.connection.readyState, 'Status:', dbStatus);
    
    // Check email service
    let emailStatus = false;
    let emailError = null;
    try {
      emailStatus = emailService.isReady ? emailService.isReady() : false;
      console.log('📧 Email service status:', emailStatus);
    } catch (emailHealthError) {
      emailError = emailHealthError.message;
      console.log('❌ Email service health check error:', emailError);
    }
    
    // Test database connection with a simple query
    let dbTest = false;
    let dbError = null;
    if (dbStatus === 'connected') {
      try {
        // Try a simple count query to test database responsiveness
        const testCount = await Contact.countDocuments().limit(1).maxTimeMS(5000);
        dbTest = true;
        console.log('✅ Database test query successful');
      } catch (dbTestError) {
        dbError = dbTestError.message;
        console.log('❌ Database test query failed:', dbError);
      }
    }
    
    const overallHealth = dbStatus === 'connected' && emailStatus;
    
    console.log('🏥 HEALTH CHECK COMPLETE:', {
      overall: overallHealth ? 'healthy' : 'unhealthy',
      database: dbStatus,
      databaseTest: dbTest,
      emailService: emailStatus
    });
    
    if (overallHealth) {
      res.json({
        success: true,
        service: 'contact',
        status: 'healthy',
        database: dbStatus,
        databaseTest: dbTest,
        emailService: emailStatus,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        success: false,
        service: 'contact',
        status: 'unhealthy',
        database: dbStatus,
        databaseTest: dbTest,
        databaseError: dbError,
        emailService: emailStatus,
        emailError: emailError,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('💥 HEALTH CHECK ERROR:', error.message);
    res.status(503).json({
      success: false,
      service: 'contact',
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  submitContact,
  getSubmissionStats,
  getContactHealth
};