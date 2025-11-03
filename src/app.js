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
  'https://www.carlsdaleescalo.com',
  'https://carlsdaleescalo.com',
  'http://localhost:5173'
];

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Changed for Vercel
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Enhanced CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, server-to-server, or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list or is a subdomain of allowed domains
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      return origin === allowedOrigin || 
             origin === allowedOrigin.replace('https://', 'https://www.') ||
             origin === allowedOrigin.replace('https://www.', 'https://');
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range'
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests globally
app.options('*', cors());

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
  process.exit(1);
} else {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
      console.error('❌ MongoDB connection error:', err.message);
      process.exit(1);
    });
}

// Export the app for Vercel
module.exports = app;