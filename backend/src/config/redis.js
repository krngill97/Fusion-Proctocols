// ===========================================
// Fusion - Redis & Queue Configuration
// ===========================================

import Redis from 'ioredis';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { logger } from '../shared/utils/logger.js';

// ------------------------------------
// Redis Connection
// ------------------------------------
let redisClient = null;
let redisSubscriber = null;

// ------------------------------------
// Redis Connection Options
// ------------------------------------
const getRedisOptions = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  return {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error('Redis: Max retry attempts reached');
        return null;
      }
      const delay = Math.min(times * 200, 2000);
      logger.warn(`Redis: Retrying connection in ${delay}ms (attempt ${times})`);
      return delay;
    },
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      if (targetErrors.some(e => err.message.includes(e))) {
        return true;
      }
      return false;
    }
  };
};

// ------------------------------------
// Create Redis Client
// ------------------------------------
export const createRedisClient = () => {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redisClient = new Redis(redisUrl, getRedisOptions());

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('error', (error) => {
    logger.error('Redis client error:', error.message);
  });

  redisClient.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  return redisClient;
};

// ------------------------------------
// Create Redis Subscriber (for Pub/Sub)
// ------------------------------------
export const createRedisSubscriber = () => {
  if (redisSubscriber) {
    return redisSubscriber;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redisSubscriber = new Redis(redisUrl, getRedisOptions());

  redisSubscriber.on('connect', () => {
    logger.info('Redis subscriber connected');
  });

  redisSubscriber.on('error', (error) => {
    logger.error('Redis subscriber error:', error.message);
  });

  return redisSubscriber;
};

// ------------------------------------
// Get Redis Client
// ------------------------------------
export const getRedisClient = () => {
  if (!redisClient) {
    return createRedisClient();
  }
  return redisClient;
};

// ------------------------------------
// Queue Definitions
// ------------------------------------
const QUEUE_NAMES = {
  TRANSFER_PROCESSING: 'fusion_transfer_processing',
  SUBWALLET_ANALYSIS: 'fusion_subwallet_analysis',
  TRADE_EXECUTION: 'fusion_trade_execution',
  VOLUME_GENERATION: 'fusion_volume_generation',
  DATA_CLEANUP: 'fusion_data_cleanup'
};

// ------------------------------------
// Queue Instances
// ------------------------------------
const queues = {};
const workers = {};
const queueEvents = {};

// ------------------------------------
// Queue Options
// ------------------------------------
const queueOptions = {
  [QUEUE_NAMES.TRANSFER_PROCESSING]: {
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    }
  },
  [QUEUE_NAMES.SUBWALLET_ANALYSIS]: {
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  },
  [QUEUE_NAMES.TRADE_EXECUTION]: {
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 100,
      attempts: 1, // Don't retry trades
      timeout: 30000
    }
  },
  [QUEUE_NAMES.VOLUME_GENERATION]: {
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 5000
      }
    }
  },
  [QUEUE_NAMES.DATA_CLEANUP]: {
    defaultJobOptions: {
      removeOnComplete: 10,
      removeOnFail: 10,
      attempts: 3
    }
  }
};

// ------------------------------------
// Initialize Queues
// ------------------------------------
export const initializeQueues = () => {
  const connection = getRedisClient();

  Object.entries(QUEUE_NAMES).forEach(([key, name]) => {
    queues[key] = new Queue(name, {
      connection,
      ...queueOptions[name]
    });

    queueEvents[key] = new QueueEvents(name, { connection });

    // Log queue events
    queueEvents[key].on('completed', ({ jobId }) => {
      logger.debug(`Queue ${name}: Job ${jobId} completed`);
    });

    queueEvents[key].on('failed', ({ jobId, failedReason }) => {
      logger.error(`Queue ${name}: Job ${jobId} failed - ${failedReason}`);
    });

    logger.info(`Queue initialized: ${name}`);
  });

  return queues;
};

// ------------------------------------
// Get Queue
// ------------------------------------
export const getQueue = (queueKey) => {
  if (!queues[queueKey]) {
    throw new Error(`Queue ${queueKey} not initialized`);
  }
  return queues[queueKey];
};

// ------------------------------------
// Create Worker
// ------------------------------------
export const createWorker = (queueKey, processor, options = {}) => {
  const queueName = QUEUE_NAMES[queueKey];
  
  if (!queueName) {
    throw new Error(`Invalid queue key: ${queueKey}`);
  }

  const connection = getRedisClient();

  const worker = new Worker(queueName, processor, {
    connection,
    concurrency: options.concurrency || 1,
    limiter: options.limiter || null,
    ...options
  });

  worker.on('completed', (job) => {
    logger.debug(`Worker ${queueName}: Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    logger.error(`Worker ${queueName}: Job ${job?.id} failed - ${error.message}`);
  });

  worker.on('error', (error) => {
    logger.error(`Worker ${queueName} error: ${error.message}`);
  });

  workers[queueKey] = worker;
  logger.info(`Worker created for queue: ${queueName}`);

  return worker;
};

// ------------------------------------
// Add Job to Queue
// ------------------------------------
export const addJob = async (queueKey, jobName, data, options = {}) => {
  const queue = getQueue(queueKey);
  
  const job = await queue.add(jobName, data, options);
  
  logger.debug(`Job added to ${queueKey}: ${job.id}`);
  
  return job;
};

// ------------------------------------
// Cache Operations
// ------------------------------------
export const cache = {
  async get(key) {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  },

  async set(key, value, ttlSeconds = 300) {
    const client = getRedisClient();
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  },

  async del(key) {
    const client = getRedisClient();
    await client.del(key);
  },

  async exists(key) {
    const client = getRedisClient();
    return await client.exists(key);
  },

  async incr(key) {
    const client = getRedisClient();
    return await client.incr(key);
  },

  async expire(key, ttlSeconds) {
    const client = getRedisClient();
    await client.expire(key, ttlSeconds);
  },

  // Get multiple keys
  async mget(keys) {
    const client = getRedisClient();
    const values = await client.mget(keys);
    return values.map(v => v ? JSON.parse(v) : null);
  },

  // Set with hash
  async hset(key, field, value) {
    const client = getRedisClient();
    await client.hset(key, field, JSON.stringify(value));
  },

  async hget(key, field) {
    const client = getRedisClient();
    const value = await client.hget(key, field);
    return value ? JSON.parse(value) : null;
  },

  async hgetall(key) {
    const client = getRedisClient();
    const values = await client.hgetall(key);
    const result = {};
    for (const [k, v] of Object.entries(values)) {
      result[k] = JSON.parse(v);
    }
    return result;
  }
};

// ------------------------------------
// Close Connections
// ------------------------------------
export const closeRedis = async () => {
  // Close workers
  for (const worker of Object.values(workers)) {
    await worker.close();
  }

  // Close queue events
  for (const event of Object.values(queueEvents)) {
    await event.close();
  }

  // Close queues
  for (const queue of Object.values(queues)) {
    await queue.close();
  }

  // Close Redis clients
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }

  if (redisSubscriber) {
    await redisSubscriber.quit();
    redisSubscriber = null;
  }

  logger.info('Redis connections closed');
};

// ------------------------------------
// Health Check
// ------------------------------------
export const isRedisHealthy = async () => {
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch (error) {
    return false;
  }
};

// ------------------------------------
// Export Queue Names
// ------------------------------------
export { QUEUE_NAMES };

export default {
  createRedisClient,
  getRedisClient,
  createRedisSubscriber,
  initializeQueues,
  getQueue,
  createWorker,
  addJob,
  cache,
  closeRedis,
  isRedisHealthy,
  QUEUE_NAMES
};
