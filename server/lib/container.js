const { initDatabase, cleanupExpiredState } = require('../db');
const { initMySQL } = require('../db/mysql');
const { loadConfig } = require('./config');
const { AuthService } = require('./utils/auth');
const { GuestService } = require('./utils/guest');
const { StorageFactory } = require('./storage/factory');
const { StorageConfigRepository } = require('./repos/storage-config-repo');
const { FileRepository } = require('./repos/file-repo');
const { UploadService } = require('./services/upload-service');
const { ChunkUploadService } = require('./services/chunk-service');
const { MySQLSyncService } = require('./services/mysql-sync-service');
const { createSettingsStore } = require('./settings/factory');

async function createContainer(env = process.env) {
  const config = loadConfig(env);
  const db = initDatabase(config.dbPath);

  const storageRepo = new StorageConfigRepository(db, config);
  const fileRepo = new FileRepository(db);
  const storageFactory = new StorageFactory();
  const settingsStore = createSettingsStore({ db, config });

  storageRepo.ensureBootstrapStorage();
  cleanupExpiredState(db);

  const uploadService = new UploadService({
    storageRepo,
    fileRepo,
    storageFactory,
  });

  const chunkService = new ChunkUploadService({
    db,
    config,
    uploadService,
  });

  const authService = new AuthService(db, config);
  const guestService = new GuestService(db, config);

  const mysqlSync = new MySQLSyncService();
  const mysqlEnabled = await mysqlSync.init({
    host: config.mysqlHost,
    port: config.mysqlPort,
    user: config.mysqlUser,
    password: config.mysqlPassword,
    database: config.mysqlDatabase,
  });

  return {
    config,
    db,
    authService,
    guestService,
    storageRepo,
    fileRepo,
    storageFactory,
    settingsStore,
    uploadService,
    chunkService,
    mysqlSync,
    mysqlEnabled,
  };
}

module.exports = {
  createContainer,
};
