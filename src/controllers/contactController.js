const Contact = require('../models/Contact');
const emailService = require('../utils/emailService');

const submitContact = async (req, res) => {
  let contactData = null;
  
  try {
    const { name, email, subject, message, honeypot, timestamp } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Honeypot check - silent success for bots
    if (honeypot && honeypot.length > 0) {
      console.log('Honeypot triggered:', { 
        email: email.substring(0, 3) + '***', // Partial email for logging
        ip: req.ip ? req.ip.substring(0, 7) + '***' : 'unknown'
      });
      return res.status(200).json({
        success: true,
        message: 'Thank you for your message!'
      });
    }

    // Timing check - prevent automated submissions
    const formFillTime = Date.now() - parseInt(timestamp);
    if (formFillTime < 3000) { // Reduced to 3 seconds for better UX
      console.log('Form filled too quickly:', { 
        time: formFillTime + 'ms',
        ip: req.ip ? req.ip.substring(0, 7) + '***' : 'unknown'
      });
      return res.status(200).json({ // Return 200 to not reveal anti-spam measures
        success: true,
        message: 'Thank you for your message!'
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';

    // Check submission limits
    const submissionCheck = await Contact.checkSubmissionLimit(email, ipAddress);
    
    if (submissionCheck.isOverLimit) {
      console.log('Submission limit reached:', { 
        email: email.substring(0, 3) + '***',
        ip: ipAddress ? ipAddress.substring(0, 7) + '***' : 'unknown'
      });
      return res.status(429).json({
        success: false,
        message: 'You have reached the submission limit. Please try again in 24 hours.'
      });
    }

    // Calculate spam score
    const spamScore = Contact.calculateSpamScore({ name, email, subject, message });
    const isSpam = spamScore >= 5;

    // Create contact entry
    contactData = {
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

    let emailResults = { confirmation: false, notification: false };

    // Send emails (don't await to avoid blocking response)
    if (!isSpam) {
      try {
        // Send confirmation email to user
        const confirmationPromise = emailService.sendConfirmationEmail(email, name, { subject, message })
          .then(result => {
            if (result.success) {
              console.log('Confirmation email sent successfully to:', email.substring(0, 3) + '***');
              emailResults.confirmation = true;
            } else {
              console.error('Failed to send confirmation email to:', email.substring(0, 3) + '***');
            }
            return result;
          })
          .catch(error => {
            console.error('Error sending confirmation email:', error.message);
            return { success: false, error: error.message };
          });

        // Send notification email to admin
        const notificationPromise = emailService.sendAdminNotification({ name, email, subject, message }, ipAddress)
          .then(result => {
            if (result.success) {
              console.log('Admin notification sent successfully');
              emailResults.notification = true;
            } else {
              console.error('Failed to send admin notification');
            }
            return result;
          })
          .catch(error => {
            console.error('Error sending admin notification:', error.message);
            return { success: false, error: error.message };
          });

        // Wait for both emails but don't block response
        Promise.allSettled([confirmationPromise, notificationPromise])
          .then(results => {
            console.log('Email sending completed:', {
              confirmation: results[0].status,
              notification: results[1].status
            });
          });

      } catch (emailError) {
        console.error('Email setup error:', emailError.message);
      }
    }

    // Log submission for monitoring (sanitized)
    console.log(`Contact form submitted:`, {
      email: email.substring(0, 3) + '***',
      ip: ipAddress ? ipAddress.substring(0, 7) + '***' : 'unknown',
      spamScore,
      isSpam,
      timestamp: new Date().toISOString()
    });

    // Always return same success message regardless of spam status
    res.status(200).json({
      success: true,
      message: 'Thank you for your message! I\'ll get back to you as soon as possible.'
    });

  } catch (error) {
    console.error('Contact submission error:', {
      message: error.message,
      name: error.name,
      timestamp: new Date().toISOString(),
      contactData: contactData ? {
        email: contactData.email ? contactData.email.substring(0, 3) + '***' : 'unknown',
        name: contactData.name ? contactData.name.substring(0, 2) + '***' : 'unknown'
      } : null
    });

    // Generic error response - never reveal internal details
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
        message: 'Required parameters missing'
      });
    }

    // Basic validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
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
    console.error('Stats error:', {
      message: error.message,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to get submission stats' 
    });
  }
};

// Optional: Add a health check for the contact service
const getContactHealth = async (req, res) => {
  try {
    // Test database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      success: true,
      service: 'contact',
      database: dbStatus,
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