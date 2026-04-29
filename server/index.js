const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { authMiddleware, adminOnly } = require('./middleware/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.removeHeader('X-Powered-By');
    next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static files from public/ (before API routes)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Middleware de Respaldo Instantáneo (Marca cambios en peticiones de escritura)
const { markAsDirty, startBackupWatcher } = require('./services/backup');
app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        markAsDirty();
    }
    next();
});

// Iniciar el vigilante de respaldos en la nube
startBackupWatcher(15000); // Revisión cada 15 segundos

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/movimientos', require('./routes/movimientos'));
app.use('/api/facturas', require('./routes/facturas'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/reportes', require('./routes/reportes'));

// GET /api/tasa-dolar — Obtener tasa oficial del BCV (Venezuela)
app.get('/api/tasa-dolar', async (req, res) => {
    const db = require('./database/db');
    try {
        // Proveedor 1: DolarApi
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        if (response.ok) {
            const data = await response.json();
            const tasaActual = data.promedio || data.venta || 0;
            
            // Guardar esta tasa como el último respaldo conocido automáticamente
            try {
                db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('tasa_dolar_cache', ?)").run(tasaActual.toString());
            } catch (cacheErr) { /* ignora */ }

            return res.json({
                fuente: 'BCV (DolarApi)',
                tasa: tasaActual,
                fechaActualizacion: data.fechaActualizacion
            });
        }
        throw new Error('DolarApi no disponible');
    } catch (error) {
        console.warn('[TasaDolar] Error en DolarApi, intentando proveedor alternativo...', error.message);
        
        // Proveedor 2 eliminado temporalmente porque la API pública de PyDolar en Vercel está caída/no encontrada.

        // Fallback final: revisar si hay una tasa manual o cacheada en la DB
        try {
            const manual = db.prepare("SELECT value FROM metadata WHERE key = 'tasa_dolar_manual'").get();
            if (manual && manual.value && parseFloat(manual.value) > 0) {
                return res.json({
                    fuente: 'Modo Manual',
                    tasa: parseFloat(manual.value),
                    fechaActualizacion: null
                });
            }

            const cache = db.prepare("SELECT value FROM metadata WHERE key = 'tasa_dolar_cache'").get();
            if (cache && cache.value) {
                return res.json({
                    fuente: 'Última API conocida (Sin internet)',
                    tasa: parseFloat(cache.value),
                    fechaActualizacion: null
                });
            }
        } catch (e3) { /* ignora si no existe tabla o algo */ }

        // Si nada funciona
        res.json({
            fuente: 'No disponible',
            tasa: 0,
            fechaActualizacion: null
        });
    }
});

// POST /api/tasa-dolar — Configurar tasa manual si fallan las APIs
app.post('/api/tasa-dolar', authMiddleware, adminOnly, async (req, res) => {
    const { tasa } = req.body;
    const db = require('./database/db');
    
    // Si envían 0, significa que quieren borrar la tasa manual y volver a la API
    if (tasa === 0 || tasa === '0') {
        try {
            db.prepare("DELETE FROM metadata WHERE key = 'tasa_dolar_manual'").run();
            return res.json({ success: true, message: 'Tasa manual borrada' });
        } catch (e) {
            return res.status(500).json({ error: 'Error al borrar tasa manual: ' + e.message });
        }
    }

    if (!tasa || isNaN(parseFloat(tasa)) || parseFloat(tasa) <= 0) {
        return res.status(400).json({ error: 'Tasa inválida' });
    }
    
    try {
        db.prepare("INSERT INTO metadata (key, value) VALUES ('tasa_dolar_manual', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(tasa.toString(), tasa.toString());
        res.json({ success: true, tasa: parseFloat(tasa) });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar tasa manual: ' + e.message });
    }
});

app.get('/db-test', authMiddleware, (req, res) => {
    try {
        const db = require('./database/db');
        const result = db.prepare('SELECT 1 as test').get();
        res.json({
            message: 'Conexión a la base de datos exitosa',
            test: result.test,
            tables: db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name)
        });
    } catch (error) {
        res.status(500).json({ message: 'Error en la conexión a la base de datos', error: error.message });
    }
});

// SPA fallback — serve index.html for all non-API, non-static routes
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.includes('.')) {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    } else {
        next();
    }
});

app.use((err, req, res, next) => {
    console.error('[Error]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  SISTEMA DE INVENTARIO HILDEMAR`);
    console.log(`========================================`);
    console.log(`  Servidor: http://localhost:${PORT}`);
    console.log(`  Entorno:  ${process.env.NODE_ENV || 'development'}`);
    console.log(`========================================\n`);
});
