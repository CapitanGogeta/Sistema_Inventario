const express = require('express');
const db = require('../database/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/audit');

const router = express.Router();

// Tipos de movimiento válidos
const TIPOS_VALIDOS = ['ENTRADA', 'SALIDA', 'AJUSTE'];

// GET /api/movimientos — Listar movimientos con filtros opcionales
router.get('/', authMiddleware, (req, res) => {
    try {
        const { producto_id, tipo, desde, hasta, limit } = req.query;

        // Query base con JOINs para info útil
        let sql = `
            SELECT m.*,
                   p.nombre AS producto_nombre,
                   p.codigo AS producto_codigo,
                   u.nombre AS usuario_nombre,
                   prov.nombre AS proveedor_nombre
            FROM movimientos m
            LEFT JOIN productos p ON m.producto_id = p.id
            LEFT JOIN users u ON m.user_id = u.id
            LEFT JOIN proveedores prov ON m.proveedor_id = prov.id
            WHERE 1=1
        `;
        const params = [];

        // Filtro por producto
        if (producto_id) {
            sql += ' AND m.producto_id = ?';
            params.push(producto_id);
        }

        // Filtro por tipo (ENTRADA, SALIDA, AJUSTE)
        if (tipo) {
            sql += ' AND m.tipo = ?';
            params.push(tipo.toUpperCase());
        }

        // Filtro por fecha desde
        if (desde) {
            sql += ' AND m.created_at >= ?';
            params.push(desde);
        }

        // Filtro por fecha hasta
        if (hasta) {
            sql += ' AND m.created_at <= ?';
            params.push(hasta);
        }

        // Orden y límite (paginación por defecto: 200)
        sql += ' ORDER BY m.created_at DESC';

        const limitNum = limit ? parseInt(limit) : 200;
        sql += ' LIMIT ?';
        params.push(limitNum);

        const movimientos = db.prepare(sql).all(...params);

        res.json({ movimientos });
    } catch (error) {
        console.error('[Movimientos] Error al listar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/movimientos/:id — Obtener movimiento por ID
router.get('/:id', authMiddleware, (req, res) => {
    try {
        const movimiento = db.prepare(`
            SELECT m.*,
                   p.nombre AS producto_nombre,
                   p.codigo AS producto_codigo,
                   u.nombre AS usuario_nombre,
                   prov.nombre AS proveedor_nombre
            FROM movimientos m
            LEFT JOIN productos p ON m.producto_id = p.id
            LEFT JOIN users u ON m.user_id = u.id
            LEFT JOIN proveedores prov ON m.proveedor_id = prov.id
            WHERE m.id = ?
        `).get(req.params.id);

        if (!movimiento) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }

        res.json({ movimiento });
    } catch (error) {
        console.error('[Movimientos] Error al obtener:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/movimientos — Crear movimiento y actualizar stock
// Permitido para admin y empleados (cualquier usuario autenticado)
router.post('/', authMiddleware, (req, res) => {
    try {
        const { producto_id, tipo, cantidad, motivo, proveedor_id, notas } = req.body;

        // 1. Validar campos obligatorios
        if (!producto_id) {
            return res.status(400).json({ error: 'El producto_id es requerido' });
        }
        if (!tipo) {
            return res.status(400).json({ error: 'El tipo es requerido (ENTRADA, SALIDA o AJUSTE)' });
        }
        if (cantidad === undefined || cantidad === null) {
            return res.status(400).json({ error: 'La cantidad es requerida' });
        }

        // 2. Validar tipo válido
        const tipoUpper = tipo.toUpperCase();
        if (!TIPOS_VALIDOS.includes(tipoUpper)) {
            return res.status(400).json({ error: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}` });
        }

        // 3. Validar cantidad positiva
        const cantidadNum = parseFloat(cantidad);
        if (isNaN(cantidadNum) || cantidadNum <= 0) {
            return res.status(400).json({ error: 'La cantidad debe ser un número positivo' });
        }

        // 4. Verificar que el producto existe y está activo
        const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1').get(producto_id);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado o inactivo' });
        }

        // 5. Verificar proveedor (si se proporciona)
        if (proveedor_id !== undefined && proveedor_id !== null) {
            const proveedor = db.prepare('SELECT id FROM proveedores WHERE id = ? AND activo = 1').get(proveedor_id);
            if (!proveedor) {
                return res.status(400).json({ error: 'El proveedor especificado no existe o no está activo' });
            }
        }

        // 6. Calcular nuevo stock y validar
        let nuevoStock;
        if (tipoUpper === 'ENTRADA') {
            nuevoStock = producto.stock_actual + cantidadNum;
        } else if (tipoUpper === 'SALIDA') {
            if (producto.stock_actual < cantidadNum) {
                return res.status(400).json({
                    error: `Stock insuficiente. Disponible: ${producto.stock_actual}, solicitado: ${cantidadNum}`
                });
            }
            nuevoStock = producto.stock_actual - cantidadNum;
        } else if (tipoUpper === 'AJUSTE') {
            nuevoStock = cantidadNum;
        }

        // 7. Ejecutar en transación (movimiento + actualizar stock)
        const crearMovimiento = db.transaction(() => {
            // Insertar movimiento
            const result = db.prepare(`
                INSERT INTO movimientos (producto_id, tipo, cantidad, motivo, proveedor_id, user_id, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                producto_id,
                tipoUpper,
                cantidadNum,
                motivo || null,
                proveedor_id || null,
                req.user.id,
                notas || null
            );

            // Actualizar stock del producto
            db.prepare('UPDATE productos SET stock_actual = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(nuevoStock, producto_id);

            return result.lastInsertRowid;
        });

        const movimientoId = crearMovimiento();

        // 8. Auditoría
        registrarAuditoria(
            req.user.id,
            req.user.username,
            'CREATE',
            'movimiento',
            movimientoId,
            {
                producto: producto.nombre,
                tipo: tipoUpper,
                cantidad: cantidadNum,
                stock_anterior: producto.stock_actual,
                stock_nuevo: nuevoStock
            },
            req.ip
        );

        res.status(201).json({
            message: 'Movimiento registrado',
            id: movimientoId,
            stock_anterior: producto.stock_actual,
            stock_nuevo: nuevoStock
        });
    } catch (error) {
        console.error('[Movimientos] Error al crear:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
