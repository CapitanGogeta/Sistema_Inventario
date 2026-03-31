# AGENTS.md — Inventario Hildemar

## Project Overview

Inventory management system for a wholesale warehouse (almacén mayorista).
Backend: Node.js + Express + SQLite (better-sqlite3).
Frontend: Vanilla HTML/CSS/JS (in `public/`).
No framework. CommonJS modules. Spanish UI, English code comments.

## Build / Run / Test Commands

```bash
npm install              # Install dependencies
npm start                # Start server (node server/index.js)
npm run dev              # Start with --watch (auto-reload on changes)

# First-time setup (interactive, creates admin + recovery key)
node server/scripts/setup.js

# Reset admin password (interactive, requires recovery key)
npm run reset-password

# Quick smoke test after starting server
curl http://localhost:3000/
curl http://localhost:3000/db-test
```

No test framework is configured yet. The `npm test` script is a placeholder.
If adding tests, use Jest or Node's built-in test runner and update this section.

## Project Structure

```
server/
├── index.js                # Express entry point, middleware setup, route registration
├── database/
│   ├── schema.sql          # All CREATE TABLE and INDEX statements
│   └── db.js               # SQLite connection, auto-runs schema if empty
├── middleware/
│   ├── auth.js             # authMiddleware (JWT verify), adminOnly (role check)
│   └── audit.js            # registrarAuditoria() helper, auditMiddleware
├── routes/
│   ├── auth.js             # /api/auth — login, register, users CRUD
│   ├── categorias.js       # /api/categorias — CRUD
│   └── proveedores.js      # /api/proveedores — CRUD
├── services/               # Email, backup, Excel generation (to be implemented)
├── scripts/
│   ├── setup.js            # First-run interactive setup
│   └── reset-password.js   # Password reset with recovery key
├── uploads/                # Factura images/PDFs (gitignored)
└── backups/                # Temporary backup staging (gitignored)
public/                     # Static frontend files (served by Express)
data/                       # SQLite database file (gitignored, auto-created)
```

## Code Style Guidelines

### Imports
```javascript
const express = require('express');
const db = require('../database/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/audit');
```
- Always use `const` for requires.
- Destructure named exports (e.g., `{ authMiddleware, adminOnly }`).
- No `import` syntax — project uses CommonJS (`"type": "commonjs"` in package.json).

### Naming Conventions
| Item | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `reset-password.js` |
| Routes | kebab-case URLs | `/api/proveedores`, `/api/categorias` |
| DB tables | singular, Spanish | `producto`, `categoria`, `proveedor` |
| DB columns | snake_case, Spanish | `created_at`, `activo`, `stock_minimo` |
| JS variables | camelCase | `passwordHash`, `userRol`, `stockActual` |
| SQL aliases | snake_case | `AS stock_actual` |
| Middleware functions | camelCase | `authMiddleware`, `adminOnly` |
| Audit actions | UPPER_SNAKE_CASE | `'CREATE'`, `'UPDATE'`, `'DELETE'`, `'LOGIN'` |

### Error Handling Pattern (every route)
```javascript
router.post('/', authMiddleware, adminOnly, (req, res) => {
    try {
        // 1. Validate input
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        // 2. Check duplicates
        const existente = db.prepare('SELECT id FROM ... WHERE ...').get(nombre.trim());
        if (existente) {
            return res.status(409).json({ error: 'Ya existe ...' });
        }
        // 3. Execute operation
        const result = db.prepare('INSERT INTO ...').run(...);
        // 4. Audit log
        registrarAuditoria(req.user.id, req.user.username, 'CREATE', 'entity', result.lastInsertRowid, datos, req.ip);
        // 5. Respond
        res.status(201).json({ message: '... creado', id: result.lastInsertRowid });
    } catch (error) {
        console.error('[ModuleName] Error al ...:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
```

### HTTP Status Codes
- `200` — Success (GET, PATCH, DELETE)
- `201` — Created (POST)
- `400` — Bad request / validation error
- `401` — Not authenticated (no token)
- `403` — Forbidden (not admin)
- `404` — Not found
- `409` — Conflict (duplicate name)
- `500` — Server error

### Auth & Roles
- Routes requiring login: add `authMiddleware` as second argument.
- Routes requiring admin: add `adminOnly` AFTER `authMiddleware`.
- Access `req.user.id`, `req.user.username`, `req.user.rol` inside handlers.

### Soft Delete
- Tables `users`, `productos`, `proveedores`, `categorias` use `activo INTEGER DEFAULT 1`.
- DELETE endpoints set `activo = 0`, never remove rows.
- Tables `movimientos`, `facturas`, `audit_log` are NEVER modified or deleted.

### Database Queries
- Use `better-sqlite3` synchronous API: `db.prepare(sql).get(param)` for single row, `.all()` for multiple, `.run()` for inserts/updates.
- Always use parameterized queries (`?` placeholders) — never concatenate user input into SQL.
- Use `result.lastInsertRowid` after INSERT to get the new ID.

## Environment Variables (.env)
```
PORT=3000
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=8h
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_TO=
FIREBASE_PROJECT_ID=
```

## Key Architecture Decisions
1. **SQLite over PostgreSQL** — single-file DB, no server needed, fits small team of 2-5 users.
2. **JWT stateless auth** — no server-side sessions, token carries user data.
3. **Immutable audit_log** — only INSERT allowed, records who/what/when for every change.
4. **Soft delete everywhere** — `activo` flag instead of removing rows, preserves history.
5. **Recovery key** — bcrypt-hashed key generated at setup, required for password reset script.
6. **Daily backup to Firebase** — SQLite + uploads compressed and uploaded at 23:00 via node-cron.
