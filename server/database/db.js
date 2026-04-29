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
        migrateDatabase(schema);
    }
}

function migrateDatabase(schema) {
    // Asegurar que las tablas nuevas (IF NOT EXISTS) se creen
    if (schema) {
        try {
            db.exec(schema);
        } catch (e) {
            console.error('[DB] Error creando nuevas tablas desde schema:', e.message);
        }
    }

    // Add new columns if they don't exist (for existing databases)
    const migrations = [
        { table: 'productos', column: 'marca', type: 'TEXT' },
        { table: 'productos', column: 'volumen', type: 'TEXT' },
        { table: 'productos', column: 'codigo_barras', type: 'TEXT' },
        { table: 'productos', column: 'proveedor_id', type: 'INTEGER REFERENCES proveedores(id)' },
        { table: 'productos', column: 'unidades_por_caja', type: 'INTEGER NOT NULL DEFAULT 1' },
        { table: 'productos', column: 'precio_venta_detal', type: 'REAL NOT NULL DEFAULT 0' },
        { table: 'ventas_detalles', column: 'tipo_unidad', type: 'TEXT DEFAULT "unidad"' }
    ];

    migrations.forEach(m => {
        try {
            const columns = db.prepare(`PRAGMA table_info(${m.table})`).all().map(c => c.name);
            if (!columns.includes(m.column)) {
                db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type}`);
                console.log(`[DB] Migración: agregada columna ${m.column} a ${m.table}`);
                
                // Si agregamos precio_venta_detal, copiamos el precio_venta actual para evitar que queden en 0
                if (m.column === 'precio_venta_detal') {
                    db.exec(`UPDATE productos SET precio_venta_detal = precio_venta`);
                    console.log(`[DB] Migración: inicializado precio_venta_detal con el valor de precio_venta`);
                }
            }
        } catch (e) {
            console.error(`[DB] Error en migración ${m.column}:`, e.message);
        }
    });

    // Migración única: Convertir stock de cajas a unidades base
    try {
        const needsUnitConversion = db.prepare(`
            SELECT id FROM productos 
            WHERE unidad_medida = 'caja' AND unidades_por_caja > 1 
            LIMIT 1
        `).get();
        
        // Vamos a verificar si ya convertimos usando alguna bandera interna, pero para hacerlo robusto:
        // Si hay una caja cuyo stock_minimo es < unidades_por_caja, asumimos que no ha sido convertido?
        // Mejor asumimos que si el cliente acaba de aceptar, lo corremos una vez.
        // Pero no podemos correrlo siempre. Agregaremos una tabla metadata.
        const metaColumns = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='metadata'").all();
        if (metaColumns.length === 0) {
            db.exec(`CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT)`);
            db.exec(`INSERT INTO metadata (key, value) VALUES ('stock_converted', '0')`);
        }
        const isConverted = db.prepare("SELECT value FROM metadata WHERE key = 'stock_converted'").get();
        if (isConverted && isConverted.value === '0') {
            console.log('[DB] Migración: Convirtiendo stock de cajas a unidades base...');
            db.exec(`
                UPDATE productos 
                SET stock_actual = stock_actual * unidades_por_caja,
                    stock_minimo = stock_minimo * unidades_por_caja
                WHERE unidad_medida = 'caja' AND unidades_por_caja > 1
            `);
            db.exec(`UPDATE metadata SET value = '1' WHERE key = 'stock_converted'`);
            console.log('[DB] Migración: Conversión de stock completada.');
        }
    } catch (e) {
        console.error(`[DB] Error en migración de stock a unidades:`, e.message);
    }

    // Add index for codigo_barras if not exists
    try {
        db.exec('CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras ON productos(codigo_barras)');
    } catch (e) { /* ignore */ }
}

initDatabase();

module.exports = db;
