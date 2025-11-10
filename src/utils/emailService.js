const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.isConfigured = false;
    this.transporter = null;
    this.brandName = process.env.FROM_NAME || 'Carls Dale Escalo';
    this.brandEmail = process.env.FROM_EMAIL || process.env.EMAIL_USER;
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
      console.log('Email service initialized successfully');
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
      console.log('Email transporter verified successfully');
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
      from: `"${this.brandName}" <${this.brandEmail}>`,
      to: userEmail,
      subject: `Thank you for reaching out, ${userName}!`,
      html: this.generateConfirmationTemplate(userName, formData),
      text: this.generateConfirmationText(userName, formData),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Confirmation email sent to ${userEmail}`);
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

    const adminEmail = process.env.ADMIN_EMAIL || this.brandEmail;
    if (!adminEmail) {
      return {
        success: false,
        error: 'No admin email configured'
      };
    }

    const mailOptions = {
      from: `"${this.brandName} - Contact Form" <${this.brandEmail}>`,
      to: adminEmail,
      subject: `New Portfolio Contact: ${formData.subject}`,
      html: this.generateAdminNotificationTemplate(formData, ipAddress),
      text: this.generateAdminNotificationText(formData, ipAddress),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Admin notification sent for contact from ${formData.email}`);
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

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thank You for Contacting ${this.brandName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #2d3748; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 600px; 
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
        }
        .header h1 {
            font-size: 2.5rem;
            font-weight: 300;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
            font-size: 1.1rem;
        }
        .content { 
            padding: 40px 30px; 
        }
        .greeting {
            font-size: 1.2rem;
            margin-bottom: 25px;
            color: #4a5568;
        }
        .message-box { 
            background: #f7fafc; 
            padding: 25px; 
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            margin: 25px 0; 
        }
        .message-box h3 {
            color: #2d3748;
            margin-bottom: 15px;
            font-size: 1.3rem;
        }
        .message-detail {
            margin: 12px 0;
            padding: 8px 0;
            border-bottom: 1px solid #edf2f7;
        }
        .message-detail:last-child {
            border-bottom: none;
        }
        .message-content {
            background: white;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            margin-top: 15px;
        }
        .next-steps {
            background: #fff9ed;
            border: 1px solid #fed7aa;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
        }
        .next-steps h3 {
            color: #c05621;
            margin-bottom: 15px;
        }
        .footer { 
            text-align: center; 
            margin-top: 40px; 
            color: #718096; 
            font-size: 14px;
            border-top: 1px solid #e2e8f0;
            padding-top: 30px;
        }
        .social-links {
            margin: 20px 0;
        }
        .social-links a {
            color: #667eea;
            text-decoration: none;
            margin: 0 10px;
        }
        @media only screen and (max-width: 600px) {
            .content { padding: 25px 20px; }
            .header { padding: 30px 20px; }
            .header h1 { font-size: 2rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Message Received!</h1>
            <p>Thank you for contacting ${this.brandName}</p>
        </div>
        <div class="content">
            <div class="greeting">
                <p>Hi <strong>${safeUserName}</strong>,</p>
            </div>
            
            <p>I've successfully received your message and truly appreciate you taking the time to reach out. I'm excited to learn more about your project or answer any questions you may have.</p>
            
            <div class="message-box">
                <h3>📬 Your Message Details</h3>
                <div class="message-detail">
                    <strong>Subject:</strong> ${safeSubject}
                </div>
                <div class="message-detail">
                    <strong>Message:</strong>
                    <div class="message-content">
                        ${safeMessage.replace(/\n/g, '<br>')}
                    </div>
                </div>
            </div>
            
            <div class="next-steps">
                <h3>What Happens Next?</h3>
                <p><strong>📅 Quick Response:</strong> I typically respond to all messages within 24 hours during weekdays.</p>
                <p><strong>💬 Detailed Discussion:</strong> I'll review your message carefully and provide a thoughtful response addressing your specific needs.</p>
                <p><strong>🚀 Project Kickoff:</strong> If you're interested in working together, we can schedule a call to discuss your project in more detail.</p>
            </div>
            
            <p>In the meantime, feel free to explore more of my work or connect with me on other platforms:</p>
            
            <div class="social-links">
                <a href="https://www.linkedin.com/in/carls-dale-escalo-797701366/">LinkedIn</a> • 
                <a href="https://github.com/wardslarc">GitHub</a> • 
                <a href="https://www.carlsdaleescalo.com/">Portfolio</a>
            </div>
            
            <p>Looking forward to connecting with you!</p>
            
            <p>Warm regards,<br>
            <strong>${this.brandName}</strong><br>
            <em>Full Stack Developer</em></p>
        </div>
        <div class="footer">
            <p>This is an automated confirmation email. Please do not reply to this message.</p>
            <p>If you have urgent inquiries, please contact me directly at <a href="mailto:${this.brandEmail}">${this.brandEmail}</a></p>
            <p>&copy; ${new Date().getFullYear()} ${this.brandName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  generateConfirmationText(userName, formData) {
    return `
MESSAGE RECEIVED!
Thank you for contacting ${this.brandName}

Hi ${userName},

I've successfully received your message and truly appreciate you taking the time to reach out. I'm excited to learn more about your project or answer any questions you may have.

📬 YOUR MESSAGE DETAILS
Subject: ${formData.subject}
Message: ${formData.message}

📅 WHAT HAPPENS NEXT?
• Quick Response: I typically respond to all messages within 24 hours during weekdays
• Detailed Discussion: I'll review your message carefully and provide a thoughtful response
• Project Kickoff: If you're interested in working together, we can schedule a call

Looking forward to connecting with you!

Warm regards,
${this.brandName}
Full Stack Developer

---
This is an automated confirmation email. 
For urgent inquiries, contact: ${this.brandEmail}
© ${new Date().getFullYear()} ${this.brandName}. All rights reserved.
    `.trim();
  }

  generateAdminNotificationTemplate(formData, ipAddress) {
    const safeName = this.escapeHtml(formData.name || '');
    const safeEmail = this.escapeHtml(formData.email || '');
    const safeSubject = this.escapeHtml(formData.subject || '');
    const safeMessage = this.escapeHtml(formData.message || '');
    const safeIp = this.escapeHtml(ipAddress || 'Unknown');
    const timestamp = new Date().toLocaleString();

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #2d3748; 
            background: #f7fafc;
            padding: 20px;
        }
        .container {
            max-width: 700px; 
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .header { 
            background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .header h1 {
            font-size: 1.8rem;
            margin: 0;
        }
        .content { 
            padding: 30px; 
        }
        .alert-badge {
            background: #fed7d7;
            color: #c53030;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
            display: inline-block;
            margin-bottom: 20px;
        }
        .contact-card {
            background: #f7fafc;
            border-radius: 12px;
            padding: 25px;
            margin: 20px 0;
            border: 1px solid #e2e8f0;
        }
        .contact-detail {
            display: flex;
            margin: 12px 0;
            padding: 8px 0;
        }
        .contact-label {
            font-weight: 600;
            color: #4a5568;
            min-width: 120px;
        }
        .message-box { 
            background: #fffaf0; 
            padding: 25px; 
            border-radius: 12px;
            border: 1px solid #feebc8;
            margin: 25px 0;
        }
        .message-content {
            background: white;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #dd6b20;
            margin-top: 15px;
            white-space: pre-wrap;
            font-family: inherit;
        }
        .action-buttons {
            margin: 30px 0;
            text-align: center;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: #3182ce;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            margin: 0 10px;
            font-weight: 600;
        }
        .btn-reply {
            background: #38a169;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #718096;
            font-size: 14px;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 New Portfolio Contact</h1>
        </div>
        <div class="content">
            <div class="alert-badge">
                ⚡ Immediate Attention Required
            </div>
            
            <div class="contact-card">
                <h3 style="margin-top: 0; color: #2d3748;">👤 Contact Information</h3>
                <div class="contact-detail">
                    <span class="contact-label">Name:</span>
                    <span>${safeName}</span>
                </div>
                <div class="contact-detail">
                    <span class="contact-label">Email:</span>
                    <span><a href="mailto:${safeEmail}">${safeEmail}</a></span>
                </div>
                <div class="contact-detail">
                    <span class="contact-label">Subject:</span>
                    <span><strong>${safeSubject}</strong></span>
                </div>
                <div class="contact-detail">
                    <span class="contact-label">IP Address:</span>
                    <span>${safeIp}</span>
                </div>
                <div class="contact-detail">
                    <span class="contact-label">Submitted:</span>
                    <span>${timestamp}</span>
                </div>
            </div>
            
            <div class="message-box">
                <h3 style="margin-top: 0; color: #dd6b20;">💬 Message Content</h3>
                <div class="message-content">
${safeMessage.replace(/\n/g, '<br>')}
                </div>
            </div>
            
            <div class="action-buttons">
                <a href="mailto:${safeEmail}?subject=Re: ${safeSubject}&body=Hi ${safeName},%0A%0AThank you for reaching out! " class="btn btn-reply">
                    ✉️ Reply to ${safeName}
                </a>
                <a href="https://mail.google.com/mail/?view=cm&to=${safeEmail}&su=Re: ${safeSubject}" class="btn">
                    📝 Open in Gmail
                </a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated notification from your portfolio contact form.</p>
            <p>Please respond within 24 hours for best engagement.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  generateAdminNotificationText(formData, ipAddress) {
    return `
🎯 NEW PORTFOLIO CONTACT - IMMEDIATE ATTENTION REQUIRED

👤 CONTACT INFORMATION
Name: ${formData.name}
Email: ${formData.email}
Subject: ${formData.subject}
IP Address: ${ipAddress}
Submitted: ${new Date().toLocaleString()}

💬 MESSAGE CONTENT
${formData.message}

⚡ QUICK ACTIONS:
• Reply to: ${formData.email}
• Subject: Re: ${formData.subject}

Please respond within 24 hours for best engagement.

This is an automated notification from your portfolio contact form.
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