const express = require('express');
const db = require('../database/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/audit');

const router = express.Router();

// GET /api/productos — Listar productos activos
router.get('/', authMiddleware, (req, res) => {
    try {
        const productos = db.prepare(`
            SELECT p.*, c.nombre AS categoria_nombre 
            FROM productos p 
            LEFT JOIN categorias c ON p.categoria_id = c.id 
            WHERE p.activo = 1 
            ORDER BY p.nombre ASC
        `).all();

        res.json({ productos });
    } catch (error) {
        console.error('[Productos] Error al listar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/productos/:id — Obtener producto por ID
router.get('/:id', authMiddleware, (req, res) => {
    try {
        const producto = db.prepare(`
            SELECT p.*, c.nombre AS categoria_nombre 
            FROM productos p 
            LEFT JOIN categorias c ON p.categoria_id = c.id 
            WHERE p.id = ? AND p.activo = 1
        `).get(req.params.id);

        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ producto });
    } catch (error) {
        console.error('[Productos] Error al obtener:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/productos — Crear producto (admin)
router.post('/', authMiddleware, adminOnly, (req, res) => {
    try {
        const { codigo, nombre, descripcion, categoria_id, unidad_medida, stock_minimo, precio_compra, precio_venta } = req.body;

        // Validar nombre requerido
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        // Validar codigo duplicado (si se proporciona)
        if (codigo !== undefined && codigo !== null && codigo.trim() !== '') {
            const codigoExistente = db.prepare('SELECT id FROM productos WHERE codigo = ?').get(codigo.trim());
            if (codigoExistente) {
                return res.status(409).json({ error: 'Ya existe un producto con ese código' });
            }
        }

        // Validar categoria_id (si se proporciona)
        if (categoria_id !== undefined && categoria_id !== null) {
            const categoria = db.prepare('SELECT id FROM categorias WHERE id = ? AND activo = 1').get(categoria_id);
            if (!categoria) {
                return res.status(400).json({ error: 'La categoría especificada no existe o no está activa' });
            }
        }

        const stmt = db.prepare(`
            INSERT INTO productos (codigo, nombre, descripcion, categoria_id, unidad_medida, stock_minimo, precio_compra, precio_venta) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            (codigo && codigo.trim() !== '') ? codigo.trim() : null,
            nombre.trim(),
            descripcion || null,
            categoria_id || null,
            unidad_medida || 'unidad',
            stock_minimo || 0,
            precio_compra || 0,
            precio_venta || 0
        );

        registrarAuditoria(
            req.user.id,
            req.user.username,
            'CREATE',
            'producto',
            result.lastInsertRowid,
            { nombre: nombre.trim(), codigo: codigo || null, categoria_id: categoria_id || null },
            req.ip
        );

        res.status(201).json({
            message: 'Producto creado exitosamente',
            id: result.lastInsertRowid
        });
    } catch (error) {
        console.error('[Productos] Error al crear:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PATCH /api/productos/:id — Actualizar producto (sin stock)
router.patch('/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, nombre, descripcion, categoria_id, unidad_medida, stock_minimo, precio_compra, precio_venta, stock_actual } = req.body;

        // REGLA DE NEGOCIO: rechazar stock_actual explícitamente
        if (stock_actual !== undefined) {
            return res.status(400).json({ error: 'El stock no puede modificarse directamente. Use movimientos.' });
        }

        // Verificar que el producto existe y está activo
        const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1').get(id);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Validar que hay campos para actualizar
        const camposPermitidos = { codigo, nombre, descripcion, categoria_id, unidad_medida, stock_minimo, precio_compra, precio_venta };
        const camposRecibidos = Object.keys(camposPermitidos).filter(k => camposPermitidos[k] !== undefined);
        if (camposRecibidos.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
        }

        // Validar nombre no vacío
        if (nombre !== undefined && nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre no puede estar vacío' });
        }

        // Validar codigo duplicado
        if (codigo !== undefined && codigo !== null && codigo.trim() !== '') {
            const codigoDuplicado = db.prepare('SELECT id FROM productos WHERE codigo = ? AND id != ?').get(codigo.trim(), id);
            if (codigoDuplicado) {
                return res.status(409).json({ error: 'Ya existe otro producto con ese código' });
            }
        }

        // Validar categoria_id
        if (categoria_id !== undefined && categoria_id !== null) {
            const categoria = db.prepare('SELECT id FROM categorias WHERE id = ? AND activo = 1').get(categoria_id);
            if (!categoria) {
                return res.status(400).json({ error: 'La categoría especificada no existe o no está activa' });
            }
        }

        // Construir query dinámico
        const updates = [];
        const values = [];

        if (codigo !== undefined) {
            updates.push('codigo = ?');
            values.push((codigo && codigo.trim() !== '') ? codigo.trim() : null);
        }
        if (nombre !== undefined) {
            updates.push('nombre = ?');
            values.push(nombre.trim());
        }
        if (descripcion !== undefined) {
            updates.push('descripcion = ?');
            values.push(descripcion || null);
        }
        if (categoria_id !== undefined) {
            updates.push('categoria_id = ?');
            values.push(categoria_id || null);
        }
        if (unidad_medida !== undefined) {
            updates.push('unidad_medida = ?');
            values.push(unidad_medida);
        }
        if (stock_minimo !== undefined) {
            updates.push('stock_minimo = ?');
            values.push(stock_minimo);
        }
        if (precio_compra !== undefined) {
            updates.push('precio_compra = ?');
            values.push(precio_compra);
        }
        if (precio_venta !== undefined) {
            updates.push('precio_venta = ?');
            values.push(precio_venta);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        const sql = `UPDATE productos SET ${updates.join(', ')} WHERE id = ?`;
        db.prepare(sql).run(...values);

        registrarAuditoria(
            req.user.id,
            req.user.username,
            'UPDATE',
            'producto',
            parseInt(id),
            {
                antes: {
                    nombre: producto.nombre,
                    codigo: producto.codigo,
                    precio_compra: producto.precio_compra,
                    precio_venta: producto.precio_venta,
                    categoria_id: producto.categoria_id
                },
                despues: camposPermitidos
            },
            req.ip
        );

        res.json({ message: 'Producto actualizado', id: parseInt(id) });
    } catch (error) {
        console.error('[Productos] Error al actualizar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE /api/productos/:id — Soft delete
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        const { id } = req.params;

        const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1').get(id);
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        // Verificar que no tenga movimientos asociados
        const movimientosCount = db.prepare('SELECT COUNT(*) as count FROM movimientos WHERE producto_id = ?').get(id).count;
        if (movimientosCount > 0) {
            return res.status(400).json({
                error: 'No se puede eliminar. El producto tiene movimientos asociados.'
            });
        }

        db.prepare('UPDATE productos SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

        registrarAuditoria(
            req.user.id,
            req.user.username,
            'DELETE',
            'producto',
            parseInt(id),
            { nombre: producto.nombre, codigo: producto.codigo },
            req.ip
        );

        res.json({ message: 'Producto eliminado' });
    } catch (error) {
        console.error('[Productos] Error al eliminar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
