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

// Indexes for performance
contactSchema.index({ email: 1, createdAt: -1 });
contactSchema.index({ ipAddress: 1, createdAt: -1 });
contactSchema.index({ isSpam: 1 });

// Check submission limits
contactSchema.statics.checkSubmissionLimit = async function(email, ipAddress, timeWindow = 24 * 60 * 60 * 1000) {
  if (mongoose.connection.readyState !== 1) {
    return {
      emailCount: 0,
      ipCount: 0,
      isOverLimit: false
    };
  }

  const twentyFourHoursAgo = new Date(Date.now() - timeWindow);
  
  try {
    const [emailCount, ipCount] = await Promise.all([
      this.countDocuments({
        email: email.toLowerCase(),
        createdAt: { $gte: twentyFourHoursAgo },
        isSpam: false
      }).maxTimeMS(5000),
      this.countDocuments({
        ipAddress: ipAddress,
        createdAt: { $gte: twentyFourHoursAgo },
        isSpam: false
      }).maxTimeMS(5000)
    ]);

    return {
      emailCount,
      ipCount,
      isOverLimit: emailCount >= 3 || ipCount >= 5
    };
  } catch (error) {
    console.error('Error checking submission limits:', error.message);
    return {
      emailCount: 0,
      ipCount: 0,
      isOverLimit: false
    };
  }
};

// Spam detection
contactSchema.statics.calculateSpamScore = function(data) {
  let score = 0;
  
  const suspiciousKeywords = ['urgent', 'money', 'free', 'winner', 'prize', 'click here'];
  const message = (data.message + ' ' + data.subject).toLowerCase();
  
  suspiciousKeywords.forEach(keyword => {
    if (message.includes(keyword)) score += 1;
  });
  
  const capitalRatio = (data.message.match(/[A-Z]/g) || []).length / data.message.length;
  if (capitalRatio > 0.5) score += 2;
  
  const urlCount = (data.message.match(/https?:\/\/[^\s]+/g) || []).length;
  score += urlCount * 2;
  
  return score;
};

module.exports = mongoose.model('Contact', contactSchema);