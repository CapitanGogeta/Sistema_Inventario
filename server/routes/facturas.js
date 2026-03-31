const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/audit');

const router = express.Router();

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        // Crear directorio si no existe
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Nombre único: timestamp + nombre original sanitizado
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `factura-${uniqueSuffix}${ext}`);
    }
});

// Filtros de archivos permitidos
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Use: JPEG, PNG, WebP o PDF'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB máximo
});

// GET /api/facturas — Listar facturas con filtros opcionales
router.get('/', authMiddleware, (req, res) => {
    try {
        const { proveedor_id, desde, hasta, limit } = req.query;

        let sql = `
            SELECT f.*,
                   prov.nombre AS proveedor_nombre,
                   u.nombre AS usuario_nombre
            FROM facturas f
            LEFT JOIN proveedores prov ON f.proveedor_id = prov.id
            LEFT JOIN users u ON f.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (proveedor_id) {
            sql += ' AND f.proveedor_id = ?';
            params.push(proveedor_id);
        }

        if (desde) {
            sql += ' AND f.fecha_factura >= ?';
            params.push(desde);
        }

        if (hasta) {
            sql += ' AND f.fecha_factura <= ?';
            params.push(hasta);
        }

        sql += ' ORDER BY f.created_at DESC';

        if (limit) {
            sql += ' LIMIT ?';
            params.push(parseInt(limit));
        }

        const facturas = db.prepare(sql).all(...params);

        res.json({ facturas });
    } catch (error) {
        console.error('[Facturas] Error al listar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/facturas/:id — Obtener factura por ID
router.get('/:id', authMiddleware, (req, res) => {
    try {
        const factura = db.prepare(`
            SELECT f.*,
                   prov.nombre AS proveedor_nombre,
                   u.nombre AS usuario_nombre
            FROM facturas f
            LEFT JOIN proveedores prov ON f.proveedor_id = prov.id
            LEFT JOIN users u ON f.user_id = u.id
            WHERE f.id = ?
        `).get(req.params.id);

        if (!factura) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        res.json({ factura });
    } catch (error) {
        console.error('[Facturas] Error al obtener:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/facturas/:id/archivo — Descargar/ver archivo
router.get('/:id/archivo', authMiddleware, (req, res) => {
    try {
        const factura = db.prepare('SELECT * FROM facturas WHERE id = ?').get(req.params.id);

        if (!factura) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        const filePath = path.resolve(factura.archivo_ruta);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
        }

        // Enviar archivo con el nombre original
        res.download(filePath, factura.archivo_nombre_original);
    } catch (error) {
        console.error('[Facturas] Error al descargar archivo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/facturas — Subir factura (admin)
router.post('/', authMiddleware, adminOnly, upload.single('archivo'), (req, res) => {
    try {
        // Verificar que se subió un archivo
        if (!req.file) {
            return res.status(400).json({ error: 'El archivo de factura es requerido' });
        }

        const { proveedor_id, numero_factura, monto_total, fecha_factura } = req.body;

        // Verificar proveedor (si se proporciona)
        if (proveedor_id !== undefined && proveedor_id !== null && proveedor_id !== '') {
            const proveedor = db.prepare('SELECT id FROM proveedores WHERE id = ? AND activo = 1').get(proveedor_id);
            if (!proveedor) {
                // Borrar archivo subido si el proveedor no es válido
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ error: 'El proveedor especificado no existe o no está activo' });
            }
        }

        // Insertar factura en la base de datos
        const stmt = db.prepare(`
            INSERT INTO facturas (proveedor_id, numero_factura, archivo_tipo, archivo_ruta, archivo_nombre_original, monto_total, fecha_factura, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            (proveedor_id && proveedor_id !== '') ? proveedor_id : null,
            numero_factura || null,
            req.file.mimetype,
            req.file.path,
            req.file.originalname,
            monto_total ? parseFloat(monto_total) : null,
            fecha_factura || null,
            req.user.id
        );

        // Auditoría
        registrarAuditoria(
            req.user.id,
            req.user.username,
            'CREATE',
            'factura',
            result.lastInsertRowid,
            {
                numero_factura: numero_factura || null,
                proveedor_id: proveedor_id || null,
                archivo: req.file.originalname,
                monto_total: monto_total || null
            },
            req.ip
        );

        res.status(201).json({
            message: 'Factura subida exitosamente',
            id: result.lastInsertRowid,
            archivo: req.file.originalname
        });
    } catch (error) {
        // Borrar archivo si hubo error en la base de datos
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch (e) { /* ignorar */ }
        }
        console.error('[Facturas] Error al subir:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Manejo de errores de multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'El archivo es demasiado grande. Máximo 10 MB.' });
        }
        return res.status(400).json({ error: `Error al subir archivo: ${error.message}` });
    }
    if (error.message && error.message.includes('Tipo de archivo no permitido')) {
        return res.status(400).json({ error: error.message });
    }
    next(error);
});

module.exports = router;
