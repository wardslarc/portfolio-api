const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // Verify transporter configuration
  async verifyTransporter() {
    try {
      await this.transporter.verify();
      console.log('Email transporter is ready');
    } catch (error) {
      console.error('Email transporter error:', error);
    }
  }

  // Send confirmation email to the user who submitted the form
  async sendConfirmationEmail(userEmail, userName, formData) {
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: userEmail,
      subject: 'Thank you for contacting us!',
      html: this.generateConfirmationTemplate(userName, formData),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Confirmation email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification email to admin
  async sendAdminNotification(formData, ipAddress) {
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: process.env.FROM_EMAIL, // Send to yourself/admin
      subject: `New Contact Form Submission from ${formData.name}`,
      html: this.generateAdminNotificationTemplate(formData, ipAddress),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Admin notification sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending admin notification:', error);
      return { success: false, error: error.message };
    }
  }

  generateConfirmationTemplate(userName, formData) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 10px 10px 0 0;
        }
        .content { 
            background: #f9f9f9; 
            padding: 30px; 
            border-radius: 0 0 10px 10px;
        }
        .message-box { 
            background: white; 
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
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Thank You for Reaching Out!</h1>
    </div>
    <div class="content">
        <p>Dear <strong>${userName}</strong>,</p>
        
        <p>Thank you for getting in touch with us. We have received your message and appreciate you taking the time to contact us.</p>
        
        <div class="message-box">
            <h3>Your Message Details:</h3>
            <p><strong>Subject:</strong> ${formData.subject}</p>
            <p><strong>Message:</strong></p>
            <p>${formData.message}</p>
        </div>
        
        <p>Our team will review your message and get back to you as soon as possible. We typically respond within 24-48 hours during business days.</p>
        
        <p>If you have any urgent inquiries, please don't hesitate to contact us directly at <a href="mailto:${process.env.FROM_EMAIL}">${process.env.FROM_EMAIL}</a>.</p>
        
        <p>Best regards,<br>
        <strong>The ${process.env.FROM_NAME} Team</strong></p>
        
        <div class="footer">
            <p>This is an automated confirmation email. Please do not reply to this message.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  generateAdminNotificationTemplate(formData, ipAddress) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
        }
        .header { 
            background: #dc3545; 
            color: white; 
            padding: 20px; 
            text-align: center; 
            border-radius: 10px 10px 0 0;
        }
        .content { 
            background: #f9f9f9; 
            padding: 20px; 
            border-radius: 0 0 10px 10px;
        }
        .info-box { 
            background: white; 
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
    </style>
</head>
<body>
    <div class="header">
        <h1>New Contact Form Submission</h1>
    </div>
    <div class="content">
        <div class="info-box">
            <h3>Contact Information:</h3>
            <p><strong>Name:</strong> ${formData.name}</p>
            <p><strong>Email:</strong> <a href="mailto:${formData.email}">${formData.email}</a></p>
            <p><strong>Subject:</strong> ${formData.subject}</p>
            <p><strong>IP Address:</strong> ${ipAddress}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="message-box">
            <h3>Message:</h3>
            <p>${formData.message}</p>
        </div>
        
        <p><a href="mailto:${formData.email}">Click here to reply</a></p>
    </div>
</body>
</html>
    `;
  }
}

module.exports = new EmailService();