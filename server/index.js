const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public/ (before API routes)
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/movimientos', require('./routes/movimientos'));
app.use('/api/facturas', require('./routes/facturas'));

app.get('/db-test', (req, res) => {
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
