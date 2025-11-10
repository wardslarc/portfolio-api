const mongoose = require('mongoose');

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.connection = null;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;
  }

  async connect() {
    if (this.isConnected && this.connection) {
      console.log('Using existing database connection');
      return this.connection;
    }

    if (!process.env.MONGODB_URI) {
      throw new Error('MongoDB URI not configured');
    }

    try {
      const options = {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        retryWrites: true,
        retryReads: true,
      };

      console.log('Connecting to MongoDB...');
      await mongoose.connect(process.env.MONGODB_URI, options);
      
      this.connection = mongoose.connection;
      this.isConnected = true;
      this.retryCount = 0;

      this.setupEventHandlers();
      console.log('MongoDB connected successfully');
      
      return this.connection;
    } catch (error) {
      this.retryCount++;
      
      if (this.retryCount <= this.maxRetries) {
        console.error(`Connection attempt ${this.retryCount} failed:`, error.message);
        console.log(`Retrying in ${this.retryDelay / 1000} seconds...`);
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect(); // Retry connection
      } else {
        console.error('All connection attempts failed');
        throw error;
      }
    }
  }

  setupEventHandlers() {
    if (!this.connection) return;

    this.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err.message);
      this.isConnected = false;
    });

    this.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
      this.isConnected = false;
    });

    this.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
      this.isConnected = true;
    });

    this.connection.on('connected', () => {
      console.log('MongoDB connected');
      this.isConnected = true;
    });
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      this.isConnected = false;
      this.connection = null;
      console.log('MongoDB disconnected gracefully');
    }
  }

  getConnection() {
    return this.connection;
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: this.connection ? this.connection.readyState : 0,
      retryCount: this.retryCount
    };
  }

  async healthCheck() {
    if (!this.isConnected || !this.connection) {
      return { status: 'disconnected', details: 'No active connection' };
    }

    try {
      // Simple ping to check database responsiveness
      await this.connection.db.admin().ping();
      return { 
        status: 'connected', 
        readyState: this.connection.readyState,
        database: this.connection.db.databaseName
      };
    } catch (error) {
      this.isConnected = false;
      return { 
        status: 'error', 
        details: error.message 
      };
    }
  }
}

// Create singleton instance
const database = new DatabaseConnection();

module.exports = database;