// ===========================================
// Fusion - Database Seeder
// ===========================================

import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { EXCHANGE_HOT_WALLETS } from '../config/constants.js';
import HotWallet from '../modules/hot-wallet-tracker/hot-wallet.model.js';
import { logger } from '../shared/utils/logger.js';

const log = logger.withContext('Seeder');

// ------------------------------------
// Seed Hot Wallets
// ------------------------------------

const seedHotWallets = async (useDevWallets = true) => {
  log.info('Seeding hot wallets...');
  
  const wallets = useDevWallets 
    ? EXCHANGE_HOT_WALLETS.DEV_WALLETS 
    : EXCHANGE_HOT_WALLETS.PROD_WALLETS;
  
  const results = {
    created: 0,
    skipped: 0,
    errors: 0
  };
  
  for (const wallet of wallets) {
    try {
      const exists = await HotWallet.findOne({ address: wallet.address });
      
      if (exists) {
        log.info(`Skipping existing wallet: ${wallet.label}`);
        results.skipped++;
        continue;
      }
      
      await HotWallet.create({
        address: wallet.address,
        exchange: wallet.exchange,
        label: wallet.label,
        isActive: true
      });
      
      log.info(`Created hot wallet: ${wallet.label}`);
      results.created++;
      
    } catch (error) {
      log.error(`Error creating wallet ${wallet.address}: ${error.message}`);
      results.errors++;
    }
  }
  
  log.info(`Hot wallets seeded: ${results.created} created, ${results.skipped} skipped, ${results.errors} errors`);
  
  return results;
};

// ------------------------------------
// Clear All Data (Development Only)
// ------------------------------------

const clearAllData = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot clear data in production!');
  }
  
  log.warn('Clearing all data...');
  
  const models = [
    'User',
    'HotWallet', 
    'Subwallet',
    'UserWallet',
    'Trade',
    'VolumeSession',
    'TransferLog'
  ];
  
  const mongoose = (await import('mongoose')).default;
  
  for (const modelName of models) {
    try {
      await mongoose.connection.collection(modelName.toLowerCase() + 's').drop();
      log.info(`Cleared collection: ${modelName}`);
    } catch (error) {
      if (error.code !== 26) { // Namespace not found (collection doesn't exist)
        log.error(`Error clearing ${modelName}: ${error.message}`);
      }
    }
  }
  
  log.info('All data cleared');
};

// ------------------------------------
// Main Seeder Function
// ------------------------------------

const runSeeder = async () => {
  const args = process.argv.slice(2);
  const command = args[0] || 'seed';
  const useDevWallets = args.includes('--dev') || !args.includes('--prod');
  
  try {
    log.info('Connecting to database...');
    await connectDatabase();
    
    switch (command) {
      case 'seed':
        await seedHotWallets(useDevWallets);
        break;
        
      case 'clear':
        await clearAllData();
        break;
        
      case 'reset':
        await clearAllData();
        await seedHotWallets(useDevWallets);
        break;
        
      default:
        log.error(`Unknown command: ${command}`);
        log.info('Available commands: seed, clear, reset');
        log.info('Flags: --dev (default), --prod');
    }
    
  } catch (error) {
    log.error('Seeder failed:', error);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
};

// Run if called directly
runSeeder();

export { seedHotWallets, clearAllData };
