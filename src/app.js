const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const contactRoutes = require('./routes/contact');
const emailService = require('./utils/emailService');
const database = require('./config/database');

const app = express();


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
  maxAge: 86400
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Contact form rate limiting
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many contact form submissions. Please try again later.' },
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

// Database connection middleware
app.use(async (req, res, next) => {
  try {
    if (!database.isConnected) {
      await database.connect();
    }
    next();
  } catch (error) {
    console.error('Database connection middleware error:', error.message);
    next();
  }
});

// Initialize services
const initializeServices = async () => {
  try {
    await emailService.verifyTransporter();
    console.log('Email service initialized');
  } catch (error) {
    console.error('Email service initialization failed:', error.message);
  }
};

// Routes
app.use('/api/contact', contactRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await database.healthCheck();
    const uptime = process.uptime();
    
    const healthCheck = {
      status: dbHealth.status === 'connected' ? 'OK' : 'Degraded',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      database: dbHealth,
      environment: 'production',
    };

    res.status(dbHealth.status === 'connected' ? 200 : 503).json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: 'Error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Portfolio API',
    version: '1.0.0',
    description: 'API for Carls Dale Escalo Portfolio',
    endpoints: {
      contact: '/api/contact',
      health: '/api/health'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Portfolio API Server',
    status: 'running',
    timestamp: new Date().toISOString()
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

  if (err.name === 'MongoNetworkError') {
    return res.status(503).json({
      error: 'Service temporarily unavailable'
    });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'Origin not allowed'
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: 'Internal server error'
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received, starting graceful shutdown`);
  await database.disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize application
const startServer = async () => {
  try {
    await database.connect();
    await initializeServices();
    
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Environment: production');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;