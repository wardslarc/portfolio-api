const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 100
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  isSpam: {
    type: Boolean,
    default: false
  },
  spamScore: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
contactSchema.index({ email: 1, createdAt: -1 });
contactSchema.index({ ipAddress: 1, createdAt: -1 });
contactSchema.index({ isSpam: 1 });

// Static method to check submission limits
contactSchema.statics.checkSubmissionLimit = async function(email, ipAddress, timeWindow = 24 * 60 * 60 * 1000) {
  const twentyFourHoursAgo = new Date(Date.now() - timeWindow);
  
  const [emailCount, ipCount] = await Promise.all([
    this.countDocuments({
      email: email.toLowerCase(),
      createdAt: { $gte: twentyFourHoursAgo },
      isSpam: false
    }),
    this.countDocuments({
      ipAddress: ipAddress,
      createdAt: { $gte: twentyFourHoursAgo },
      isSpam: false
    })
  ]);

  return {
    emailCount,
    ipCount,
    isOverLimit: emailCount >= 3 || ipCount >= 5
  };
};

// Method to detect spam
contactSchema.statics.calculateSpamScore = function(data) {
  let score = 0;
  
  // Check for suspicious patterns
  const suspiciousKeywords = ['urgent', 'money', 'free', 'winner', 'prize', 'click here'];
  const message = (data.message + ' ' + data.subject).toLowerCase();
  
  suspiciousKeywords.forEach(keyword => {
    if (message.includes(keyword)) score += 1;
  });
  
  // Check for excessive capitals
  const capitalRatio = (data.message.match(/[A-Z]/g) || []).length / data.message.length;
  if (capitalRatio > 0.5) score += 2;
  
  // Check for URLs
  const urlCount = (data.message.match(/https?:\/\/[^\s]+/g) || []).length;
  score += urlCount * 2;
  
  return score;
};

module.exports = mongoose.model('Contact', contactSchema);