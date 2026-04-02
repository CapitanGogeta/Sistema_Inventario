const express = require('express');
const db = require('../database/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/audit');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
    try {
        const proveedores = db.prepare(`
            SELECT * FROM proveedores 
            WHERE activo = 1 
            ORDER BY nombre ASC
        `).all();

        res.json({ proveedores });
    } catch (error) {
        console.error('[Proveedores] Error al listar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/:id', authMiddleware, (req, res) => {
    try {
        const proveedor = db.prepare(`
            SELECT * FROM proveedores WHERE id = ? AND activo = 1
        `).get(req.params.id);

        if (!proveedor) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        res.json({ proveedor });
    } catch (error) {
        console.error('[Proveedores] Error al obtener:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/', authMiddleware, adminOnly, (req, res) => {
    try {
        const { nombre, contacto, telefono, email, direccion } = req.body;

        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const existente = db.prepare('SELECT id FROM proveedores WHERE nombre = ? AND activo = 1')
            .get(nombre.trim());
        if (existente) {
            return res.status(409).json({ error: 'Ya existe un proveedor con ese nombre' });
        }

        const stmt = db.prepare(`
            INSERT INTO proveedores (nombre, contacto, telefono, email, direccion)
            VALUES (?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            nombre.trim(),
            contacto || null,
            telefono || null,
            email || null,
            direccion || null
        );

        registrarAuditoria(
            req.user.id,
            req.user.username,
            'CREATE',
            'proveedor',
            result.lastInsertRowid,
            { nombre: nombre.trim(), contacto, telefono, email, direccion },
            req.ip
        );

        res.status(201).json({
            message: 'Proveedor creado exitosamente',
            id: result.lastInsertRowid
        });
    } catch (error) {
        console.error('[Proveedores] Error al crear:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.patch('/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, contacto, telefono, email, direccion } = req.body;

        const proveedor = db.prepare('SELECT * FROM proveedores WHERE id = ? AND activo = 1').get(id);
        if (!proveedor) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        if (nombre !== undefined) {
            if (nombre.trim() === '') {
                return res.status(400).json({ error: 'El nombre no puede estar vacío' });
            }
            const duplicado = db.prepare('SELECT id FROM proveedores WHERE nombre = ? AND id != ? AND activo = 1')
                .get(nombre.trim(), id);
            if (duplicado) {
                return res.status(409).json({ error: 'Ya existe otro proveedor con ese nombre' });
            }
        }

        const updates = [];
        const values = [];
        const antes = {
            nombre: proveedor.nombre,
            contacto: proveedor.contacto,
            telefono: proveedor.telefono,
            email: proveedor.email,
            direccion: proveedor.direccion
        };

        if (nombre !== undefined) {
            updates.push('nombre = ?');
            values.push(nombre.trim());
        }
        if (contacto !== undefined) {
            updates.push('contacto = ?');
            values.push(contacto);
        }
        if (telefono !== undefined) {
            updates.push('telefono = ?');
            values.push(telefono);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }
        if (direccion !== undefined) {
            updates.push('direccion = ?');
            values.push(direccion);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        const sql = `UPDATE proveedores SET ${updates.join(', ')} WHERE id = ?`;
        db.prepare(sql).run(...values);

        registrarAuditoria(
            req.user.id,
            req.user.username,
            'UPDATE',
            'proveedor',
            parseInt(id),
            { antes, despues: { nombre, contacto, telefono, email, direccion } },
            req.ip
        );

        res.json({ message: 'Proveedor actualizado', id: parseInt(id) });
    } catch (error) {
        console.error('[Proveedores] Error al actualizar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        const { id } = req.params;

        const proveedor = db.prepare('SELECT * FROM proveedores WHERE id = ? AND activo = 1').get(id);
        if (!proveedor) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        const facturasCount = db.prepare('SELECT COUNT(*) as count FROM facturas WHERE proveedor_id = ?').get(id).count;
        const movimientosCount = db.prepare('SELECT COUNT(*) as count FROM movimientos WHERE proveedor_id = ?').get(id).count;

        if (facturasCount > 0 || movimientosCount > 0) {
            return res.status(400).json({ 
                error: 'No se puede eliminar. El proveedor tiene facturas o movimientos asociados.' 
            });
        }

        db.prepare('UPDATE proveedores SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

        registrarAuditoria(
            req.user.id,
            req.user.username,
            'DELETE',
            'proveedor',
            parseInt(id),
            { nombre: proveedor.nombre },
            req.ip
        );

        res.json({ message: 'Proveedor eliminado' });
    } catch (error) {
        console.error('[Proveedores] Error al eliminar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
