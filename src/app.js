const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const contactRoutes = require('./routes/contact');
const emailService = require('./utils/emailService');

const app = express();

// Initialize email service when app starts
emailService.verifyTransporter();

// Enhanced CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'https://carlsdaleescalo.com',
  'http://localhost:5173'
];

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-site" },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Simple rate limiting without external package
const rateLimit = new Map();

app.use('/api/', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;
  
  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { count: 1, startTime: now });
    return next();
  }
  
  const ipData = rateLimit.get(ip);
  
  // Reset if window has passed
  if (now - ipData.startTime > windowMs) {
    ipData.count = 1;
    ipData.startTime = now;
    return next();
  }
  
  // Check if over limit
  if (ipData.count >= maxRequests) {
    return res.status(429).json({
      error: 'Too many requests from this IP, please try again later.'
    });
  }
  
  // Increment count
  ipData.count++;
  next();
});

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  
  for (const [ip, data] of rateLimit.entries()) {
    if (now - data.startTime > windowMs) {
      rateLimit.delete(ip);
    }
  }
}, 60 * 1000); // Clean every minute

// CORS middleware - apply to all routes
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Data sanitization
app.use(mongoSanitize());

// Remove Express header
app.disable('x-powered-by');

// Routes
app.use('/api/contact', contactRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
    // Removed allowedOrigins from response to avoid info leak
  });
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', {
    message: err.message,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // CORS error handling
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      error: 'Access forbidden' 
    });
  }
  
  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed'
    });
  }
  
  // Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid resource identifier'
    });
  }
  
  // MongoDB duplicate key errors
  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Resource already exists'
    });
  }
  
  // Generic error response - never expose internal details
  res.status(500).json({ 
    error: 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Resource not found' 
  });
});

// Database connection with better error handling
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1); // Exit if no database connection
} else {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
      console.error('❌ MongoDB connection error:', err.message);
      process.exit(1); // Exit on connection failure
    });
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🛑 Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🛑 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Export the app for Vercel
module.exports = app;

// Only listen locally, not in Vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}