const express = require('express');
const db = require('../database/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/audit');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
    try {
        const categorias = db.prepare(`
            SELECT * FROM categorias 
            WHERE activo = 1 
            ORDER BY nombre ASC
        `).all();

        res.json({ categorias });
    } catch (error) {
        console.error('[Categorias] Error al listar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/:id', authMiddleware, (req, res) => {
    try {
        const categoria = db.prepare(`
            SELECT * FROM categorias WHERE id = ? AND activo = 1
        `).get(req.params.id);

        if (!categoria) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        res.json({ categoria });
    } catch (error) {
        console.error('[Categorias] Error al obtener:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/', authMiddleware, adminOnly, (req, res) => {
    try {
        const { nombre, descripcion } = req.body;

        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const existente = db.prepare('SELECT id FROM categorias WHERE nombre = ? AND activo = 1').get(nombre.trim());
        if (existente) {
            return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
        }

        const stmt = db.prepare(`
            INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)
        `);
        const result = stmt.run(nombre.trim(), descripcion || null);

        registrarAuditoria(
            req.user.id,
            req.user.username,
            'CREATE',
            'categoria',
            result.lastInsertRowid,
            { nombre: nombre.trim(), descripcion },
            req.ip
        );

        res.status(201).json({
            message: 'Categoría creada exitosamente',
            id: result.lastInsertRowid
        });
    } catch (error) {
        console.error('[Categorias] Error al crear:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.patch('/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;

        const categoria = db.prepare('SELECT * FROM categorias WHERE id = ? AND activo = 1').get(id);
        if (!categoria) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        if (nombre !== undefined) {
            if (nombre.trim() === '') {
                return res.status(400).json({ error: 'El nombre no puede estar vacío' });
            }
            const duplicada = db.prepare('SELECT id FROM categorias WHERE nombre = ? AND id != ? AND activo = 1')
                .get(nombre.trim(), id);
            if (duplicada) {
                return res.status(409).json({ error: 'Ya existe otra categoría con ese nombre' });
            }
        }

        const updates = [];
        const values = [];

        if (nombre !== undefined) {
            updates.push('nombre = ?');
            values.push(nombre.trim());
        }
        if (descripcion !== undefined) {
            updates.push('descripcion = ?');
            values.push(descripcion);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
        }

        values.push(id);
        const sql = `UPDATE categorias SET ${updates.join(', ')} WHERE id = ?`;
        db.prepare(sql).run(...values);

        registrarAuditoria(
            req.user.id,
            req.user.username,
            'UPDATE',
            'categoria',
            parseInt(id),
            { antes: { nombre: categoria.nombre, descripcion: categoria.descripcion }, despues: { nombre, descripcion } },
            req.ip
        );

        res.json({ message: 'Categoría actualizada', id: parseInt(id) });
    } catch (error) {
        console.error('[Categorias] Error al actualizar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        const { id } = req.params;

        const categoria = db.prepare('SELECT * FROM categorias WHERE id = ? AND activo = 1').get(id);
        if (!categoria) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        const productosCount = db.prepare('SELECT COUNT(*) as count FROM productos WHERE categoria_id = ? AND activo = 1')
            .get(id).count;
        if (productosCount > 0) {
            return res.status(400).json({ 
                error: `No se puede eliminar. Hay ${productosCount} producto(s) asociados a esta categoría.` 
            });
        }

        db.prepare('UPDATE categorias SET activo = 0 WHERE id = ?').run(id);

        registrarAuditoria(
            req.user.id,
            req.user.username,
            'DELETE',
            'categoria',
            parseInt(id),
            { nombre: categoria.nombre },
            req.ip
        );

        res.json({ message: 'Categoría eliminada' });
    } catch (error) {
        console.error('[Categorias] Error al eliminar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
