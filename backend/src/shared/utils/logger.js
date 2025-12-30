// ===========================================
// Fusion - Logger Utility (Winston)
// ===========================================

import winston from 'winston';

// ------------------------------------
// Log Levels
// ------------------------------------
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// ------------------------------------
// Log Colors
// ------------------------------------
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan'
};

winston.addColors(colors);

// ------------------------------------
// Log Format
// ------------------------------------
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// ------------------------------------
// Console Format (with colors)
// ------------------------------------
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    let log = `${timestamp} ${level}: ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

// ------------------------------------
// Determine Log Level
// ------------------------------------
const getLogLevel = () => {
  const env = process.env.NODE_ENV || 'development';
  const configuredLevel = process.env.LOG_LEVEL;
  
  if (configuredLevel) {
    return configuredLevel;
  }
  
  return env === 'development' ? 'debug' : 'info';
};

// ------------------------------------
// Create Logger Instance
// ------------------------------------
const logger = winston.createLogger({
  level: getLogLevel(),
  levels,
  format,
  defaultMeta: { service: 'fusion' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  // Don't exit on handled exceptions
  exitOnError: false
});

// ------------------------------------
// Add File Transport in Production
// ------------------------------------
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

// ------------------------------------
// Stream for Morgan HTTP Logger
// ------------------------------------
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// ------------------------------------
// Helper Methods
// ------------------------------------

// Log with context
logger.withContext = (context) => {
  return {
    error: (message, ...args) => logger.error(`[${context}] ${message}`, ...args),
    warn: (message, ...args) => logger.warn(`[${context}] ${message}`, ...args),
    info: (message, ...args) => logger.info(`[${context}] ${message}`, ...args),
    http: (message, ...args) => logger.http(`[${context}] ${message}`, ...args),
    debug: (message, ...args) => logger.debug(`[${context}] ${message}`, ...args)
  };
};

// Log execution time
logger.time = async (label, fn) => {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.debug(`${label} completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`${label} failed after ${duration}ms: ${error.message}`);
    throw error;
  }
};

export { logger };
export default logger;
