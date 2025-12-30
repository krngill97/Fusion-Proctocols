// ===========================================
// Fusion - MongoDB Database Configuration
// ===========================================

import mongoose from 'mongoose';
import { logger } from '../shared/utils/logger.js';

// ------------------------------------
// Connection Options
// ------------------------------------
const connectionOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4
  retryWrites: true,
  w: 'majority'
};

// ------------------------------------
// Connection State
// ------------------------------------
let isConnected = false;

// ------------------------------------
// Connect to MongoDB
// ------------------------------------
export const connectDatabase = async () => {
  if (isConnected) {
    logger.info('Using existing MongoDB connection');
    return;
  }

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    // Set strictQuery to avoid deprecation warning
    mongoose.set('strictQuery', true);

    // Connect to MongoDB
    const connection = await mongoose.connect(mongoUri, connectionOptions);

    isConnected = true;
    logger.info(`MongoDB connected: ${connection.connection.host}`);

    // Log database name
    logger.info(`Database: ${connection.connection.name}`);

  } catch (error) {
    logger.error('MongoDB connection error:', error.message);
    throw error;
  }
};

// ------------------------------------
// Disconnect from MongoDB
// ------------------------------------
export const disconnectDatabase = async () => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('MongoDB disconnection error:', error.message);
    throw error;
  }
};

// ------------------------------------
// Connection Event Handlers
// ------------------------------------
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (error) => {
  logger.error('Mongoose connection error:', error.message);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from MongoDB');
  isConnected = false;
});

// ------------------------------------
// Graceful Shutdown
// ------------------------------------
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    logger.error('Error during MongoDB shutdown:', error.message);
    process.exit(1);
  }
});

// ------------------------------------
// Health Check
// ------------------------------------
export const isDatabaseHealthy = () => {
  return mongoose.connection.readyState === 1;
};

// ------------------------------------
// Get Connection Status
// ------------------------------------
export const getConnectionStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
    readyState: mongoose.connection.readyState
  };
};

export default {
  connectDatabase,
  disconnectDatabase,
  isDatabaseHealthy,
  getConnectionStatus
};
