const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const contactRoutes = require('./routes/contact');
const emailService = require('./utils/emailService');

const app = express();

// Initialize email service when app starts
emailService.verifyTransporter();

// Basic CORS - simple for testing
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://www.carlsdaleescalo.com',
    'https://carlsdaleescalo.com',
    'http://localhost:5173'
  ],
  credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple MongoDB Connection for Vercel
const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    return false;
  }

  try {
    console.log('🔗 Connecting to MongoDB...');
    
    // Remove all deprecated options, keep it simple
    const mongooseOptions = {
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
    };

    await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
    
    console.log('✅ MongoDB connected successfully');
    console.log('📊 MongoDB connection state:', mongoose.connection.readyState);
    return true;
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    return false;
  }
};

// Connect to MongoDB when app starts
connectDB();

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected event');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

// Routes
app.use('/api/contact', contactRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mongodb: dbStates[dbState] || 'unknown',
    readyState: dbState
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}