const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'inventario.db');
const dataDir = path.dirname(DB_PATH);

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all();

    if (tables.length === 0) {
        console.log('[DB] Base de datos vacía. Ejecutando schema...');
        db.exec(schema);
        console.log('[DB] Schema ejecutado correctamente.');
    } else {
        console.log('[DB] Base de datos existente. Conexión establecida.');
    }
}

initDatabase();

module.exports = db;
