const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.isConfigured = false;
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Check if email configuration exists
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('⚠️  Email configuration missing. Email service will be disabled.');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        // Connection pool settings
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        // Timeout settings
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 30000, // 30 seconds
      });

      this.isConfigured = true;
      console.log('✅ Email transporter initialized');
    } catch (error) {
      console.error('❌ Email transporter initialization error:', error.message);
      this.isConfigured = false;
    }
  }

  async verifyTransporter() {
    if (!this.isConfigured) {
      console.warn('⚠️  Email service not configured - skipping verification');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      await this.transporter.verify();
      console.log('✅ Email transporter verified and ready');
      return { success: true };
    } catch (error) {
      console.error('❌ Email transporter verification failed:', error.message);
      this.isConfigured = false;
      return { 
        success: false, 
        error: error.message,
        code: 'TRANSPORTER_VERIFICATION_FAILED'
      };
    }
  }

  async sendConfirmationEmail(userEmail, userName, formData) {
    // Check if email service is configured
    if (!this.isConfigured) {
      console.warn('⚠️  Email service not configured - skipping confirmation email');
      return { 
        success: false, 
        error: 'Email service not configured',
        code: 'SERVICE_DISABLED'
      };
    }

    // Validate input parameters
    if (!userEmail || !userName || !formData) {
      return {
        success: false,
        error: 'Missing required parameters for confirmation email',
        code: 'MISSING_PARAMETERS'
      };
    }

    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Website Contact'}" <${process.env.FROM_EMAIL || process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Thank you for contacting us!',
      html: this.generateConfirmationTemplate(userName, formData),
      // Text fallback for email clients that don't support HTML
      text: this.generateConfirmationText(userName, formData),
      // Email headers for better deliverability
      headers: {
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Importance': 'Normal'
      }
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Confirmation email sent:', {
        messageId: info.messageId,
        to: userEmail.substring(0, 3) + '***', // Partial email for logging
        response: info.response?.substring(0, 100) // Truncated response
      });
      
      return { 
        success: true, 
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      };
    } catch (error) {
      console.error('❌ Error sending confirmation email:', {
        error: error.message,
        to: userEmail.substring(0, 3) + '***',
        code: error.code
      });
      
      return { 
        success: false, 
        error: error.message,
        code: error.code || 'SEND_FAILED'
      };
    }
  }

  async sendAdminNotification(formData, ipAddress) {
    if (!this.isConfigured) {
      console.warn('⚠️  Email service not configured - skipping admin notification');
      return { 
        success: false, 
        error: 'Email service not configured',
        code: 'SERVICE_DISABLED'
      };
    }

    if (!formData || !formData.email) {
      return {
        success: false,
        error: 'Missing form data for admin notification',
        code: 'MISSING_FORM_DATA'
      };
    }

    const adminEmail = process.env.ADMIN_EMAIL || process.env.FROM_EMAIL || process.env.EMAIL_USER;
    if (!adminEmail) {
      return {
        success: false,
        error: 'No admin email configured',
        code: 'NO_ADMIN_EMAIL'
      };
    }

    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Website Contact Form'}" <${process.env.FROM_EMAIL || process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `New Contact: ${formData.subject || 'No Subject'}`,
      html: this.generateAdminNotificationTemplate(formData, ipAddress),
      text: this.generateAdminNotificationText(formData, ipAddress),
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'High'
      }
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Admin notification sent:', {
        messageId: info.messageId,
        from: formData.email.substring(0, 3) + '***'
      });
      
      return { 
        success: true, 
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      };
    } catch (error) {
      console.error('❌ Error sending admin notification:', {
        error: error.message,
        code: error.code
      });
      
      return { 
        success: false, 
        error: error.message,
        code: error.code || 'SEND_FAILED'
      };
    }
  }

  generateConfirmationTemplate(userName, formData) {
    const safeUserName = this.escapeHtml(userName || '');
    const safeSubject = this.escapeHtml(formData.subject || '');
    const safeMessage = this.escapeHtml(formData.message || '');
    const fromName = process.env.FROM_NAME || 'Our Team';
    const fromEmail = process.env.FROM_EMAIL || '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .content { 
            padding: 30px; 
        }
        .message-box { 
            background: #f8f9fa; 
            padding: 20px; 
            border-left: 4px solid #667eea; 
            margin: 20px 0; 
            border-radius: 4px;
        }
        .footer { 
            text-align: center; 
            margin-top: 30px; 
            color: #666; 
            font-size: 14px;
            border-top: 1px solid #eee;
            padding-top: 20px;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
        }
        @media only screen and (max-width: 600px) {
            .content { padding: 20px; }
            .header { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Thank You for Reaching Out!</h1>
        </div>
        <div class="content">
            <p>Dear <strong>${safeUserName}</strong>,</p>
            
            <p>Thank you for getting in touch with us. We have received your message and appreciate you taking the time to contact us.</p>
            
            <div class="message-box">
                <h3 style="margin-top: 0;">Your Message Details:</h3>
                <p><strong>Subject:</strong> ${safeSubject}</p>
                <p><strong>Message:</strong></p>
                <p>${safeMessage.replace(/\n/g, '<br>')}</p>
            </div>
            
            <p>Our team will review your message and get back to you as soon as possible. We typically respond within 24-48 hours during business days.</p>
            
            ${fromEmail ? `<p>If you have any urgent inquiries, please don't hesitate to contact us directly at <a href="mailto:${fromEmail}">${fromEmail}</a>.</p>` : ''}
            
            <p>Best regards,<br>
            <strong>The ${fromName} Team</strong></p>
        </div>
        <div class="footer">
            <p>This is an automated confirmation email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} ${fromName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  generateConfirmationText(userName, formData) {
    return `
Thank You for Reaching Out!

Dear ${userName},

Thank you for getting in touch with us. We have received your message and appreciate you taking the time to contact us.

Your Message Details:
Subject: ${formData.subject}
Message: ${formData.message}

Our team will review your message and get back to you as soon as possible. We typically respond within 24-48 hours during business days.

Best regards,
The ${process.env.FROM_NAME || 'Our Team'} Team

This is an automated confirmation email. Please do not reply to this message.
    `.trim();
  }

  generateAdminNotificationTemplate(formData, ipAddress) {
    const safeName = this.escapeHtml(formData.name || '');
    const safeEmail = this.escapeHtml(formData.email || '');
    const safeSubject = this.escapeHtml(formData.subject || '');
    const safeMessage = this.escapeHtml(formData.message || '');
    const safeIp = this.escapeHtml(ipAddress || 'Unknown');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
            background: #dc3545; 
            color: white; 
            padding: 20px; 
            text-align: center; 
        }
        .content { 
            padding: 20px; 
        }
        .info-box { 
            background: #f8f9fa; 
            padding: 15px; 
            border-left: 4px solid #dc3545; 
            margin: 15px 0; 
            border-radius: 4px;
        }
        .message-box { 
            background: #fff3cd; 
            padding: 15px; 
            border: 1px solid #ffeaa7; 
            border-radius: 4px; 
            margin: 15px 0;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            background: #dc3545;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
        }
        @media only screen and (max-width: 600px) {
            .content { padding: 15px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 New Contact Form Submission</h1>
        </div>
        <div class="content">
            <div class="info-box">
                <h3 style="margin-top: 0;">Contact Information</h3>
                <p><strong>Name:</strong> ${safeName}</p>
                <p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
                <p><strong>Subject:</strong> ${safeSubject}</p>
                <p><strong>IP Address:</strong> ${safeIp}</p>
                <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <div class="message-box">
                <h3 style="margin-top: 0;">Message Content</h3>
                <p>${safeMessage.replace(/\n/g, '<br>')}</p>
            </div>
            
            <p><a class="button" href="mailto:${safeEmail}?subject=Re: ${safeSubject}">Reply to ${safeName}</a></p>
        </div>
    </div>
</body>
</html>
    `;
  }

  generateAdminNotificationText(formData, ipAddress) {
    return `
NEW CONTACT FORM SUBMISSION

Contact Information:
Name: ${formData.name}
Email: ${formData.email}
Subject: ${formData.subject}
IP Address: ${ipAddress}
Submitted: ${new Date().toLocaleString()}

Message:
${formData.message}

Reply to: ${formData.email}
    `.trim();
  }

  // Utility function to escape HTML for security
  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  // Method to check if email service is ready
  isReady() {
    return this.isConfigured && this.transporter;
  }

  // Method to get service status
  getStatus() {
    return {
      isConfigured: this.isConfigured,
      isReady: this.isReady(),
      hasTransporter: !!this.transporter
    };
  }
}

module.exports = new EmailService();