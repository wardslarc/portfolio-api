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
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    index: true
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
    index: true
  },
  userAgent: {
    type: String,
    maxlength: 500
  },
  isSpam: {
    type: Boolean,
    default: false,
    index: true
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
    default: 'pending',
    index: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for better query performance
contactSchema.index({ email: 1, createdAt: -1 });
contactSchema.index({ ipAddress: 1, createdAt: -1 });
contactSchema.index({ isSpam: 1, createdAt: -1 });
contactSchema.index({ status: 1, createdAt: -1 });
contactSchema.index({ createdAt: -1 });

// Text search index for message and subject
contactSchema.index({ 
  subject: 'text', 
  message: 'text' 
});

// Check submission limits with enhanced logic
contactSchema.statics.checkSubmissionLimit = async function(email, ipAddress, timeWindow = 24 * 60 * 60 * 1000) {
  if (mongoose.connection.readyState !== 1) {
    return {
      emailCount: 0,
      ipCount: 0,
      isOverLimit: false,
      limits: { email: 3, ip: 5 }
    };
  }

  const timeAgo = new Date(Date.now() - timeWindow);
  
  try {
    const [emailCount, ipCount, recentSpamCount] = await Promise.all([
      this.countDocuments({
        email: email.toLowerCase(),
        createdAt: { $gte: timeAgo },
        isSpam: false
      }).maxTimeMS(3000), // Faster timeout for better UX
      
      this.countDocuments({
        ipAddress: ipAddress,
        createdAt: { $gte: timeAgo },
        isSpam: false
      }).maxTimeMS(3000),
      
      this.countDocuments({
        $or: [
          { email: email.toLowerCase() },
          { ipAddress: ipAddress }
        ],
        createdAt: { $gte: timeAgo },
        isSpam: true
      }).maxTimeMS(3000)
    ]);

    const isOverLimit = emailCount >= 3 || ipCount >= 5;
    const hasRecentSpam = recentSpamCount > 2;

    return {
      emailCount,
      ipCount,
      recentSpamCount,
      isOverLimit: isOverLimit || hasRecentSpam,
      limits: { email: 3, ip: 5 },
      hasRecentSpam
    };
  } catch (error) {
    console.error('Error checking submission limits:', error.message);
    return {
      emailCount: 0,
      ipCount: 0,
      recentSpamCount: 0,
      isOverLimit: false,
      limits: { email: 3, ip: 5 },
      hasRecentSpam: false,
      error: 'Unable to verify submission limits'
    };
  }
};

// Enhanced spam detection
contactSchema.statics.calculateSpamScore = function(data) {
  let score = 0;
  const { name, email, subject, message } = data;
  
  const combinedText = (message + ' ' + subject).toLowerCase();
  
  // Suspicious keywords with weights
  const suspiciousPatterns = [
    { pattern: /\b(urgent|asap|immediately)\b/i, weight: 2 },
    { pattern: /\b(money|cash|price|payment|loan)\b/i, weight: 3 },
    { pattern: /\b(free|winner|prize|lottery|bonus)\b/i, weight: 3 },
    { pattern: /\b(click here|visit now|limited time)\b/i, weight: 2 },
    { pattern: /\b(guarantee|risk-free|satisfaction)\b/i, weight: 2 },
    { pattern: /\b(dear (friend|user)|hello)\b/i, weight: 1 },
    { pattern: /\b(viagra|cialis|pharmacy)\b/i, weight: 5 }
  ];

  // Check for suspicious patterns
  suspiciousPatterns.forEach(({ pattern, weight }) => {
    const matches = combinedText.match(pattern);
    if (matches) {
      score += weight * matches.length;
    }
  });

  // URL detection
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urlCount = (combinedText.match(urlRegex) || []).length;
  score += urlCount * 3;

  // Email domain suspicion
  const suspiciousDomains = ['ru', 'cn', 'tk', 'ml', 'ga', 'cf'];
  const emailDomain = email.split('.').pop();
  if (suspiciousDomains.includes(emailDomain)) {
    score += 2;
  }

  // Excessive capitalization
  const capitalRatio = (message.match(/[A-Z]/g) || []).length / Math.max(message.length, 1);
  if (capitalRatio > 0.6) score += 2;

  // Repeated characters
  const repeatedChars = message.match(/(.)\1{4,}/g);
  if (repeatedChars) score += repeatedChars.length;

  // Message length extremes
  if (message.length < 20) score += 1;
  if (message.length > 800) score += 1;

  // Name-email mismatch (basic check)
  const nameParts = name.toLowerCase().split(' ');
  const emailUser = email.split('@')[0].toLowerCase();
  const nameInEmail = nameParts.some(part => emailUser.includes(part));
  if (!nameInEmail && nameParts.length > 0) score += 1;

  return Math.min(Math.max(score, 0), 10); // Clamp between 0-10
};

// Instance method to mark as spam
contactSchema.methods.markAsSpam = function(reason = 'automated detection') {
  this.isSpam = true;
  this.status = 'archived';
  return this.save();
};

// Static method to clean old records (for maintenance)
contactSchema.statics.cleanOldRecords = async function(daysOld = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  try {
    const result = await this.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: { $in: ['replied', 'archived'] }
    });
    
    console.log(`Cleaned ${result.deletedCount} old contact records`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning old records:', error.message);
    return 0;
  }
};

// Query helper for common queries
contactSchema.query.byTimeRange = function(startDate, endDate) {
  return this.where('createdAt').gte(startDate).lte(endDate || new Date());
};

contactSchema.query.nonSpam = function() {
  return this.where('isSpam').equals(false);
};

contactSchema.query.pending = function() {
  return this.where('status').equals('pending');
};

// Virtual for display name
contactSchema.virtual('displayName').get(function() {
  return this.name.split(' ').map(part => 
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join(' ');
});

// Pre-save middleware to auto-detect spam
contactSchema.pre('save', function(next) {
  if (this.isModified('message') || this.isModified('subject') || this.isNew) {
    this.spamScore = this.constructor.calculateSpamScore({
      name: this.name,
      email: this.email,
      subject: this.subject,
      message: this.message
    });
    
    // Auto-mark as spam if score is high
    if (this.spamScore >= 7 && !this.isModified('isSpam')) {
      this.isSpam = true;
      this.status = 'archived';
    }
  }
  next();
});

module.exports = mongoose.model('Contact', contactSchema);