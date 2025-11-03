const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    maxlength: [100, 'Email cannot exceed 100 characters'],
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [100, 'Subject cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
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

// Index for spam detection and querying
contactSchema.index({ email: 1, createdAt: -1 });
contactSchema.index({ ipAddress: 1, createdAt: -1 });
contactSchema.index({ isSpam: 1 });

// Static method to check submission limits
contactSchema.statics.checkSubmissionLimit = async function(email, ipAddress, timeWindow = 24 * 60 * 60 * 1000) {
  const twentyFourHoursAgo = new Date(Date.now() - timeWindow);
  
  const [emailCount, ipCount] = await Promise.all([
    this.countDocuments({
      email: email,
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