const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const contactRoutes = require('./routes/contact');
const emailService = require('./utils/emailService');

const app = express();

// Vercel proxy configuration
app.set('trust proxy', true); // Trust all Vercel proxies

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  }
}));

// CORS configuration
const corsOptions = {
  origin: [
    'https://www.carlsdaleescalo.com',
    'https://carlsdaleescalo.com'
  ],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Rate limiting with proper IPv6 handling
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Use the built-in ipKeyGenerator for proper IPv6 handling
    const { ipKeyGenerator } = require('express-rate-limit');
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    return ipKeyGenerator(req, res, ip);
  }
});
app.use('/api/', limiter);

// Strict rate limiting for contact form
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 contact submissions per hour
  message: {
    error: 'Too many contact form submissions. Please try again later.'
  },
  keyGenerator: (req, res) => {
    const { ipKeyGenerator } = require('express-rate-limit');
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    return ipKeyGenerator(req, res, ip);
  }
});
app.use('/api/contact', contactLimiter);

// Compression
app.use(compression());

// Body parsing with security limits
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '1mb',
  parameterLimit: 10
}));

// Database connection
const connectDB = async (retries = 5, delay = 5000) => {
  if (!process.env.MONGODB_URI) {
    console.error('MongoDB URI not configured');
    process.exit(1);
  }

  for (let i = 0; i < retries; i++) {
    try {
      const options = {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
      };

      await mongoose.connect(process.env.MONGODB_URI, options);
      console.log('MongoDB connected successfully');
      return true;
    } catch (error) {
      console.error(`MongoDB connection attempt ${i + 1} failed:`, error.message);
      
      if (i === retries - 1) {
        console.error('All MongoDB connection attempts failed');
        process.exit(1);
      }
      
      console.log(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Initialize services
const initializeServices = async () => {
  try {
    await emailService.verifyTransporter();
    console.log('Email service initialized');
  } catch (error) {
    console.error('Email service initialization failed:', error.message);
  }
};

// Connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

// Routes
app.use('/api/contact', contactRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const status = dbState === 1 ? 'connected' : 'disconnected';
  const uptime = process.uptime();
  
  const healthCheck = {
    status: dbState === 1 ? 'OK' : 'Degraded',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    database: status,
    environment: 'production'
  };

  res.status(dbState === 1 ? 200 : 503).json(healthCheck);
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Portfolio API',
    version: '1.0.0',
    description: 'API for Carlsdale Escalo Portfolio',
    endpoints: {
      contact: '/api/contact',
      health: '/api/health'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Resource not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'Origin not allowed'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: 'Internal server error'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, starting graceful shutdown');
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, starting graceful shutdown');
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

// Initialize application
const startServer = async () => {
  try {
    await connectDB();
    await initializeServices();
    
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: production`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
      } else {
        console.error('Server error:', error.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;