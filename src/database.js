const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbPath = process.env.NODE_ENV === 'test' ? './data/tasks.test.db' : (process.env.DATABASE_PATH || './data/tasks.db');
let dbInstance = null;
let initializingPromise = null; // To handle concurrent calls during initialization

const log = (...args) => {
  // console.log('[DB]', ...args); // Removed for cleaner output
};

const initializeDatabase = async () => {
  log('initializeDatabase called.');
  if (dbInstance) {
    log('initializeDatabase: Instance already exists. Returning it.');
    return dbInstance;
  }

  if (initializingPromise) {
    log('initializeDatabase: Initialization already in progress. Waiting for it.');
    return initializingPromise;
  }

  initializingPromise = (async () => {
    try {
      log(`Attempting to open database at: ${dbPath}`);
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      });
      log(`Database opened successfully: ${dbPath}`);

      await db.exec('PRAGMA foreign_keys = ON;');
      log('Foreign keys PRAGMA executed.');

      await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          email TEXT UNIQUE,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);
      log('Users table ensured.');

      await db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          completed BOOLEAN NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          userId INTEGER,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      log('Tasks table ensured.');

      // Re-enable tags and task_tags creation
      await db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE
        )
      `);
      log('Tags table ensured.');

      await db.exec(`
        CREATE TABLE IF NOT EXISTS task_tags (
          task_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (task_id, tag_id),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )
      `);
      log('Task_tags table ensured.');

      log('Database schema fully initialized.');
      dbInstance = db; // Set the global instance
      return db;
    } catch (err) {
      console.error('[DB] CRITICAL: Failed to initialize the database:', err.message, err.stack);
      dbInstance = null; // Ensure instance is null on failure
      throw err; // Re-throw the error
    } finally {
      initializingPromise = null; // Clear the promise once done (success or fail)
    }
  })();

  return initializingPromise;
};

const getDb = async () => {
  log('getDb called.');
  if (!dbInstance) {
    log('getDb: dbInstance is null. Attempting to initialize.');
    // This will either use an in-progress promise or start a new initialization
    return initializeDatabase(); // This returns the promise from initializeDatabase
  }
  log('getDb: Returning existing dbInstance.');
  return dbInstance;
};

const closeDb = async () => {
  log('closeDb called.');
  if (dbInstance) {
    try {
      await dbInstance.close();
      log('Database connection closed.');
      dbInstance = null;
    } catch (error) {
      console.error('[DB] Error closing the database:', error); // Kept critical error log
    }
  } else {
    log('closeDb: No active database instance to close.');
  }
};

module.exports = {
  initializeDatabase,
  getDb,
  closeDb, // Export closeDb
  // getDbInstance: () => dbInstance, // For debugging if needed
};