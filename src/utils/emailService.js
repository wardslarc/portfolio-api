const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.isConfigured = false;
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('Email configuration missing. Email service disabled.');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_PORT == 465,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 30000,
      });

      this.isConfigured = true;
    } catch (error) {
      console.error('Email transporter initialization error:', error.message);
      this.isConfigured = false;
    }
  }

  async verifyTransporter() {
    if (!this.isConfigured) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      console.error('Email transporter verification failed:', error.message);
      this.isConfigured = false;
      return { 
        success: false, 
        error: error.message
      };
    }
  }

  async sendConfirmationEmail(userEmail, userName, formData) {
    if (!this.isConfigured) {
      return { 
        success: false, 
        error: 'Email service not configured'
      };
    }

    if (!userEmail || !userName || !formData) {
      return {
        success: false,
        error: 'Missing required parameters'
      };
    }

    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Website Contact'}" <${process.env.FROM_EMAIL || process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Thank you for contacting us!',
      html: this.generateConfirmationTemplate(userName, formData),
      text: this.generateConfirmationText(userName, formData),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      return { 
        success: true, 
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Error sending confirmation email:', error.message);
      return { 
        success: false, 
        error: error.message
      };
    }
  }

  async sendAdminNotification(formData, ipAddress) {
    if (!this.isConfigured) {
      return { 
        success: false, 
        error: 'Email service not configured'
      };
    }

    if (!formData || !formData.email) {
      return {
        success: false,
        error: 'Missing form data'
      };
    }

    const adminEmail = process.env.ADMIN_EMAIL || process.env.FROM_EMAIL || process.env.EMAIL_USER;
    if (!adminEmail) {
      return {
        success: false,
        error: 'No admin email configured'
      };
    }

    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Website Contact Form'}" <${process.env.FROM_EMAIL || process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `New Contact: ${formData.subject || 'No Subject'}`,
      html: this.generateAdminNotificationTemplate(formData, ipAddress),
      text: this.generateAdminNotificationText(formData, ipAddress),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      return { 
        success: true, 
        messageId: info.messageId
      };
    } catch (error) {
      console.error('Error sending admin notification:', error.message);
      return { 
        success: false, 
        error: error.message
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
        @media only screen and (max-width: 600px) {
            .content { padding: 15px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Contact Form Submission</h1>
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
            
            <p><a href="mailto:${safeEmail}?subject=Re: ${safeSubject}">Reply to ${safeName}</a></p>
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

  isReady() {
    return this.isConfigured && this.transporter;
  }
}

module.exports = new EmailService();