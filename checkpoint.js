const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'gestion.db');
const db = new Database(dbPath);
const info = db.pragma('wal_checkpoint(TRUNCATE)');
console.log('Checkpoint info:', info);
db.close();
console.log('Database checkpointed successfully.');
