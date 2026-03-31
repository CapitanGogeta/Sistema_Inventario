const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/audit');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }

        const user = db.prepare('SELECT * FROM users WHERE username = ? AND activo = 1').get(username);

        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const passwordValido = await bcrypt.compare(password, user.password_hash);

        if (!passwordValido) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, rol: user.rol, nombre: user.nombre },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        registrarAuditoria(user.id, user.username, 'LOGIN', 'user', user.id, null, req.ip);

        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                username: user.username,
                nombre: user.nombre,
                rol: user.rol
            }
        });
    } catch (error) {
        console.error('[Auth] Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/register', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { username, password, nombre, email, rol } = req.body;

        if (!username || !password || !nombre) {
            return res.status(400).json({ error: 'Username, password y nombre son requeridos' });
        }

        const existente = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existente) {
            return res.status(409).json({ error: 'El usuario ya existe' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const userRol = rol === 'admin' ? 'admin' : 'empleado';

        const stmt = db.prepare(`
            INSERT INTO users (username, password_hash, nombre, email, rol)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(username, passwordHash, nombre, email || null, userRol);

        registrarAuditoria(
            req.user.id,
            req.user.username,
            'CREATE',
            'user',
            result.lastInsertRowid,
            { username, nombre, email, rol: userRol },
            req.ip
        );

        res.status(201).json({
            message: 'Usuario creado exitosamente',
            id: result.lastInsertRowid
        });
    } catch (error) {
        console.error('[Auth] Error en registro:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.get('/me', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT id, username, nombre, email, rol, created_at FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user });
});

router.get('/users', authMiddleware, adminOnly, (req, res) => {
    try {
        const users = db.prepare(`
            SELECT id, username, nombre, email, rol, activo, created_at 
            FROM users 
            ORDER BY created_at DESC
        `).all();

        res.json({ users });
    } catch (error) {
        console.error('[Auth] Error al listar usuarios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.patch('/users/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, rol, activo } = req.body;

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const updates = [];
        const values = [];

        if (nombre !== undefined) {
            updates.push('nombre = ?');
            values.push(nombre);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }
        if (rol !== undefined && (rol === 'admin' || rol === 'empleado')) {
            updates.push('rol = ?');
            values.push(rol);
        }
        if (activo !== undefined) {
            updates.push('activo = ?');
            values.push(activo ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        db.prepare(sql).run(...values);

        registrarAuditoria(
            req.user.id,
            req.user.username,
            'UPDATE',
            'user',
            parseInt(id),
            { antes: { nombre: user.nombre, email: user.email, rol: user.rol, activo: user.activo }, despues: { nombre, email, rol, activo } },
            req.ip
        );

        res.json({ message: 'Usuario actualizado', id: parseInt(id) });
    } catch (error) {
        console.error('[Auth] Error al actualizar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.delete('/users/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        const { id } = req.params;

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }

        db.prepare('UPDATE users SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

        registrarAuditoria(
            req.user.id,
            req.user.username,
            'DELETE',
            'user',
            parseInt(id),
            { username: user.username, nombre: user.nombre },
            req.ip
        );

        res.json({ message: 'Usuario desactivado' });
    } catch (error) {
        console.error('[Auth] Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
