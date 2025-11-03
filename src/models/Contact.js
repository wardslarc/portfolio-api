const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
    match: [/^[a-zA-Z\s\-'.]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    maxlength: [100, 'Email cannot exceed 100 characters'],
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    validate: {
      validator: function(email) {
        // Block disposable email domains
        const disposableDomains = [
          'tempmail.com', 'guerrillamail.com', 'mailinator.com', 
          '10minutemail.com', 'yopmail.com', 'throwaway.com',
          'fakeinbox.com', 'trashmail.com', 'disposable.com',
          'temp-mail.org', 'getairmail.com'
        ];
        const domain = email.split('@')[1];
        return !disposableDomains.some(disposable => 
          domain.includes(disposable) || disposable.includes(domain)
        );
      },
      message: 'Please use a permanent email address'
    }
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    minlength: [5, 'Subject must be at least 5 characters'],
    maxlength: [100, 'Subject cannot exceed 100 characters'],
    match: [/^[a-zA-Z0-9\s\-_.,!?()]+$/, 'Subject contains invalid characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    minlength: [10, 'Message must be at least 10 characters'],
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  ipAddress: {
    type: String,
    required: true,
    match: [/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, 'Invalid IP address format']
  },
  userAgent: {
    type: String,
    maxlength: [500, 'User agent too long']
  },
  isSpam: {
    type: Boolean,
    default: false
  },
  spamScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'replied', 'archived'],
    default: 'pending'
  },
  submissionType: {
    type: String,
    enum: ['normal', 'suspicious', 'blocked'],
    default: 'normal'
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
contactSchema.index({ email: 1, createdAt: -1 });
contactSchema.index({ ipAddress: 1, createdAt: -1 });
contactSchema.index({ isSpam: 1, createdAt: -1 });
contactSchema.index({ spamScore: -1, createdAt: -1 });
contactSchema.index({ status: 1, createdAt: -1 });
contactSchema.index({ submissionType: 1 });

// Static method to check submission limits with enhanced security
contactSchema.statics.checkSubmissionLimit = async function(email, ipAddress, timeWindow = 24 * 60 * 60 * 1000) {
  const twentyFourHoursAgo = new Date(Date.now() - timeWindow);
  
  try {
    const [emailCount, ipCount, recentSpamCount] = await Promise.all([
      this.countDocuments({
        email: email.toLowerCase(),
        createdAt: { $gte: twentyFourHoursAgo },
        submissionType: { $ne: 'blocked' }
      }),
      this.countDocuments({
        ipAddress: ipAddress,
        createdAt: { $gte: twentyFourHoursAgo },
        submissionType: { $ne: 'blocked' }
      }),
      this.countDocuments({
        $or: [
          { email: email.toLowerCase() },
          { ipAddress: ipAddress }
        ],
        createdAt: { $gte: twentyFourHoursAgo },
        isSpam: true
      })
    ]);

    const isOverLimit = emailCount >= 3 || ipCount >= 5 || recentSpamCount >= 2;

    return {
      emailCount,
      ipCount,
      recentSpamCount,
      isOverLimit,
      limits: {
        maxPerEmail: 3,
        maxPerIP: 5,
        maxSpam: 2
      }
    };
  } catch (error) {
    console.error('Error checking submission limits:', error.message);
    // In case of database error, be conservative and block submission
    return {
      emailCount: 0,
      ipCount: 0,
      recentSpamCount: 0,
      isOverLimit: true,
      error: 'System temporarily unavailable'
    };
  }
};

// Enhanced spam detection with multiple factors
contactSchema.statics.calculateSpamScore = function(data) {
  let score = 0;
  const { name, email, subject, message } = data;
  
  const fullText = (message + ' ' + subject + ' ' + name).toLowerCase();
  
  // 1. Keyword analysis
  const spamKeywords = [
    'urgent', 'money', 'free', 'winner', 'prize', 'click here', 'buy now',
    'limited time', 'act now', 'special promotion', 'cash', 'profit',
    'make money', 'work from home', 'get rich', 'viagra', 'casino',
    'lottery', 'credit card', 'loan', 'mortgage', 'insurance'
  ];
  
  const suspiciousKeywords = spamKeywords.filter(keyword => 
    fullText.includes(keyword)
  );
  score += Math.min(suspiciousKeywords.length * 2, 6); // Max 6 points
  
  // 2. Text pattern analysis
  // Excessive capital letters
  const capitalRatio = (message.replace(/[^A-Z]/g, '').length) / message.length;
  if (capitalRatio > 0.6) score += 3;
  else if (capitalRatio > 0.4) score += 1;
  
  // 3. URL/Link analysis
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urlCount = (message.match(urlRegex) || []).length;
  score += Math.min(urlCount * 3, 6); // Max 6 points for URLs
  
  // 4. Email pattern analysis
  const emailLocalPart = email.split('@')[0];
  if (emailLocalPart.length > 30) score += 1; // Very long local part
  if (/^\d+$/.test(emailLocalPart)) score += 2; // Numeric local part
  if (emailLocalPart.includes('..')) score += 1; // Double dots
  
  // 5. Name pattern analysis
  if (name.length < 3) score += 1;
  if (/^\d+$/.test(name)) score += 2; // Numeric name
  if (name === emailLocalPart) score += 1; // Name matches email local part
  
  // 6. Message structure analysis
  const messageWords = message.split(/\s+/);
  if (messageWords.length < 5) score += 1; // Very short message
  if (messageWords.length > 200) score += 1; // Very long message
  
  // 7. Repetitive characters
  const repetitiveChars = message.match(/(.)\1{4,}/g); // 5 or more repeated chars
  if (repetitiveChars) score += repetitiveChars.length;
  
  return Math.min(score, 10); // Cap at 10
};

// Instance method to determine submission type
contactSchema.methods.determineSubmissionType = function() {
  if (this.spamScore >= 8) {
    return 'blocked';
  } else if (this.spamScore >= 5) {
    return 'suspicious';
  }
  return 'normal';
};

// Pre-save middleware to auto-calculate spam score and type
contactSchema.pre('save', function(next) {
  if (this.isModified('name') || this.isModified('email') || 
      this.isModified('subject') || this.isModified('message')) {
    
    this.spamScore = this.constructor.calculateSpamScore({
      name: this.name,
      email: this.email,
      subject: this.subject,
      message: this.message
    });
    
    this.isSpam = this.spamScore >= 5;
    this.submissionType = this.determineSubmissionType();
  }
  next();
});

// Static method for admin analytics
contactSchema.statics.getSubmissionStats = async function(timePeriod = 24 * 60 * 60 * 1000) {
  const timeAgo = new Date(Date.now() - timePeriod);
  
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: timeAgo }
      }
    },
    {
      $group: {
        _id: null,
        totalSubmissions: { $sum: 1 },
        spamSubmissions: { $sum: { $cond: [{ $eq: ['$isSpam', true] }, 1, 0] } },
        blockedSubmissions: { $sum: { $cond: [{ $eq: ['$submissionType', 'blocked'] }, 1, 0] } },
        uniqueEmails: { $addToSet: '$email' },
        uniqueIPs: { $addToSet: '$ipAddress' }
      }
    },
    {
      $project: {
        totalSubmissions: 1,
        spamSubmissions: 1,
        blockedSubmissions: 1,
        spamRate: { $round: [{ $divide: ['$spamSubmissions', '$totalSubmissions'] }, 2] },
        uniqueEmails: { $size: '$uniqueEmails' },
        uniqueIPs: { $size: '$uniqueIPs' }
      }
    }
  ]);
  
  return stats[0] || {
    totalSubmissions: 0,
    spamSubmissions: 0,
    blockedSubmissions: 0,
    spamRate: 0,
    uniqueEmails: 0,
    uniqueIPs: 0
  };
};

// Virtual for safe data exposure (if needed for admin panel)
contactSchema.virtual('safeData').get(function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email ? this.email.substring(0, 3) + '***' : null,
    subject: this.subject,
    message: this.message.substring(0, 100) + '...',
    isSpam: this.isSpam,
    spamScore: this.spamScore,
    status: this.status,
    submissionType: this.submissionType,
    createdAt: this.createdAt
  };
});

module.exports = mongoose.model('Contact', contactSchema);