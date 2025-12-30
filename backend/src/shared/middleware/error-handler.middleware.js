// ===========================================
// Fusion - Error Handler Middleware
// ===========================================

import { logger } from '../utils/logger.js';

// ------------------------------------
// Custom Error Classes
// ------------------------------------

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Permission denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class SolanaError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, 'SOLANA_ERROR');
    this.originalError = originalError;
  }
}

export class TradeError extends AppError {
  constructor(message, originalError = null) {
    super(message, 400, 'TRADE_ERROR');
    this.originalError = originalError;
  }
}

// ------------------------------------
// Error Handler Middleware
// ------------------------------------

export const errorHandler = (err, req, res, next) => {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';
  let errors = err.errors || null;

  // Log error
  if (statusCode >= 500) {
    logger.error('Server error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query
    });
  } else {
    logger.warn('Client error:', {
      message: err.message,
      code,
      path: req.path,
      method: req.method
    });
  }

  // Handle specific error types
  if (err.name === 'CastError') {
    // MongoDB cast error (invalid ObjectId)
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
  }

  if (err.name === 'ValidationError' && err.errors) {
    // Mongoose validation error
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
  }

  if (err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    message = 'Duplicate entry';
    code = 'DUPLICATE_ERROR';
    const field = Object.keys(err.keyValue || {})[0];
    if (field) {
      message = `${field} already exists`;
    }
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }

  // Solana-specific errors
  if (err.message?.includes('Transaction simulation failed')) {
    statusCode = 400;
    code = 'TRANSACTION_SIMULATION_FAILED';
  }

  if (err.message?.includes('insufficient funds')) {
    statusCode = 400;
    message = 'Insufficient SOL balance';
    code = 'INSUFFICIENT_FUNDS';
  }

  // Build response
  const response = {
    success: false,
    error: {
      code,
      message
    }
  };

  // Include errors array if present
  if (errors) {
    response.error.errors = errors;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// ------------------------------------
// Not Found Handler
// ------------------------------------

export const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

// ------------------------------------
// Async Handler Wrapper
// ------------------------------------

export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ------------------------------------
// Uncaught Exception Handler
// ------------------------------------

export const setupUncaughtHandlers = () => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack
    });

    // Exit after logging
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', {
      reason: reason?.message || reason,
      stack: reason?.stack
    });
  });
};

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  SolanaError,
  TradeError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  setupUncaughtHandlers
};
