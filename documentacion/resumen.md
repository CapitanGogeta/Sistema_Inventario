# Documentación del Sistema de Inventario Hildemar

## Resumen de lo realizado hasta ahora (Paso 1: Inicialización del proyecto)

Este documento resume las decisiones técnicas, la arquitectura y los archivos creados durante la fase inicial de construcción del sistema de inventario para el almacén mayorista Hildemar.

---

## Decisiones clave tomadas

### 1. Arquitectura híbrida (local + cloud backup)
- **Backend local**: Node.js + Express corriendo en una PC dentro del almacén.
- **Base de datos**: SQLite (archivo único, sin necesidad de servidor separado).
- **Backup diario**: Copia de la base de datos y archivos subidos (fotos/PDFs de facturas) a Firebase Storage cada día a las 23:00.
- **Frontend**: HTML, CSS y JavaScript vanilla (sin frameworks) para asegurar simplicidad y funcionamiento offline básico mediante Service Workers (a implementar en pasos futuros).
- **Comunicación**: REST API entre frontend y backend.

### 2. Seguridad y auditoría
- **Autenticación**: JWT (JSON Web Tokens) con contraseñas hasheadas usando bcrypt.
- **Autorización**: Roles (`admin` y `empleado`) para limitar acciones según permisos.
- **Auditoría inmutable**: Tabla `audit_log` que solo permite `INSERT`. Registra quién, qué, cuándo y los valores antes/después de cada cambio crítico.
- **Soft delete**: En tablas operativas (`users`, `productos`, `proveedores`, `categorias`) se usa un campo `activo` (0/1) en lugar de borrado físico, permitiendo recuperación y manteniendo historial.
- **Recovery key**: Clave de recuperación generada una vez durante el setup para resetear la contraseña del admin, evitando que cualquier persona con acceso a la PC pueda hacerse admin.

### 3. Funcionalidades planeadas (etapas futuras)
- **Gestión de productos**: CRUD con código, nombre, descripción, categoría, unidad de medida, stock actual/mínimo, precios.
- **Gestión de proveedores**: CRUD con datos de contacto.
- **Movimientos de stock**: Entradas (con factura asociada), salidas y ajustes (para corregir errores).
- **Facturas**: Subida de fotos o PDFs, asociación a movimientos de entrada.
- **Alertas de stock bajo**: Notificación por email al responsable cuando el stock de un producto cae por debajo del mínimo definido.
- **Reportes**: Exportación a Excel (.xlsx) de movimientos por rango de fechas, valorización de inventario, stock bajo, etc.
- **Backup diario automatizado**: Mediante `node-cron` y `firebase-admin`.

---

## Estructura de carpetas creada

```
inventario-hildemar/
├── server/
│   ├── index.js                  # Punto de entrada del servidor (pendiente)
│   ├── package.json              # Dependencias y scripts
│   ├── .env                      # Variables de entorno (NO versionar)
│   ├── database/
│   │   ├── schema.sql            # Definición de tablas e índices
│   │   └── db.js                 # Módulo de conexión a SQLite
│   ├── routes/
│   │   ├── auth.js               # Login, registro, recuperación
│   │   ├── productos.js          # CRUD de productos
│   │   ├── proveedores.js        # CRUD de proveedores
│   │   ├── categorias.js         # CRUD de categorías
│   │   ├── stock.js              # Entradas/salidas/ajustes de stock
│   │   ├── facturas.js           # Subida de archivos (fotos/PDF)
│   │   ├── reportes.js           # Generación de reportes Excel
│   │   ├── alertas.js            # Verificación de stock bajo
│   │   └── audit.js              # Consultas al log de auditoría
│   ├── middleware/
│   │   ├── auth.js               # Verifica JWT en cada request protegido
│   │   ├── audit.js              # Middleware que registra automáticamente en audit_log
│   │   ├── upload.js             # Configuración de Multer para uploads
│   │   └── roles.js              # Verifica rol (admin/empleado)
│   ├── services/
│   │   ├── email.js              # Envío de emails con Nodemailer
│   │   ├── backup.js             # Backup diario a Firebase Storage
│   │   └── excel.js              # Utilidades para generar archivos Excel
│   ├── uploads/                  # Almacena fotos y PDFs de facturas
│   └── backups/                  # Carpeta temporal para backups antes de subir a Firebase
├── public/
│   ├── index.html                # Página de login
│   ├── dashboard.html            # Panel principal
│   ├── productos.html
│   ├── stock.html
│   ├── facturas.html
│   ├── proveedores.html
│   ├── reportes.html
│   ├── alertas.html
│   ├── audit.html                # Visualización del log de auditoría
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── config.js             # URL base de la API, helpers de token
│       ├── auth.js
│       ├── dashboard.js
│       ├── productos.js
│       ├── stock.js
│       ├── facturas.js
│       ├── proveedores.js
│       ├── reportes.js
│       ├── alertas.js
│       └── audit.js
├── documentacion/
│   └── resumen.md                # Este archivo
├── README.md                     # Pendiente
└── .gitignore                    # Excluye node_modules, data, uploads, backups, .env
```

---

## Archivos creados

### Paso 1: Estructura base

| Archivo | Descripción |
|---------|-------------|
| `server/database/schema.sql` | Definición completa de todas las tablas e índices |
| `server/database/db.js` | Conexión a SQLite con auto-inicialización |
| `.env` | Variables de entorno (JWT_SECRET, email, Firebase) |
| `.gitignore` | Archivos/carpetas excluidos de versionado |
| `package.json` | Scripts: `npm start`, `npm run dev`, `npm run reset-password` |

### Paso 2: Autenticación ✅

| Archivo | Descripción |
|---------|-------------|
| `server/middleware/auth.js` | Verificación de JWT + helper `adminOnly` |
| `server/middleware/audit.js` | Registro automático en audit_log |
| `server/routes/auth.js` | Endpoints: login, register, usuarios, perfil |
| `server/scripts/setup.js` | Primer setup: crear admin + recovery key |
| `server/scripts/reset-password.js` | Reset con clave de recuperación |

### Endpoints de autenticación

```
POST /api/auth/login          → Login (sin auth requerida)
POST /api/auth/register       → Crear usuario (requiere admin)
GET  /api/auth/me             → Perfil del usuario (requiere auth)
GET  /api/auth/users          → Listar usuarios (requiere admin)
PATCH /api/auth/users/:id     → Actualizar usuario (requiere admin)
DELETE /api/auth/users/:id     → Desactivar usuario (requiere admin)
```

### Prueba de funcionamiento

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Endpoint protegido
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

### Credenciales de prueba

| Username | Password | Rol |
|----------|----------|-----|
| admin | admin123 | admin |

### Scripts disponibles

```bash
npm start                    # Arrancar servidor
npm run dev                  # Arrancar con auto-reload
npm run reset-password       # Resetear contraseña (pide recovery key)
node server/scripts/setup.js # Setup inicial
```

---

## Próximos pasos (Paso 2: Autenticación)

En la siguiente fase implementaremos:

1. **Middleware de autenticación**: Verificar JWT en rutas protegidas.
2. **Rutas de auth**: 
   - `POST /api/login` → retorna token si credenciales válidas.
   - `POST /api/register` → crea usuario inicial (solo para setup).
   - `POST /api/refresh-token` → opcional para renovar token.
3. **Hashing de contraseñas**: Uso de `bcrypt` (sal + hash).
4. **Protección de rutas**: Solo usuarios autenticados pueden acceder a `/api/*`.
5. **Roles**: Middleware que verifica si el usuario tiene rol `admin` o `empleado`.
6. **Endpoint de recuperación de contraseña**: Script `server/scripts/reset-password.js` que requiere la *recovery key* para resetear la contraseña de un usuario (pensado para el admin).
7. **Generación de la recovery key**: Durante el primer arranque, si no existe clave en la tabla `recovery_keys`, se genera una aleatoria, se hashea y se guarda, y se muestra por consola una sola vez (debe ser anotada por el administrador).

---

## Consideraciones de diseño

- **Statelessness**: El backend no guarda sesiones; todo el estado de autenticación está en el JWT firmado.
- **Principio de menor privilegio**: Un empleado solo puede realizar movimientos de stock y ver productos; solo el admin puede crear/editar/eliminar productos, proveedores, usuarios, etc.
- **Auditoría como pilar**: Cada cambio crítico (creación, actualización, eliminación, login, exportación, backup, reset de contraseña) genera una entrada en `audit_log`.
- **Resiliencia ante errores**: El sistema está pensado para funcionar incluso si falla internet (las operaciones locales continúan; el backup simplemente se reintentará al día siguiente).
- **Legibilidad y mantenibilidad**: Código modular, separación de responsabilidades (routes, services, middleware), nombres descriptivos, comentarios donde sea necesario.

---

## Próximos archivos a crear

En el Paso 2, crearemos (entre otros):

- `server/middleware/auth.js`
- `server/routes/auth.js`
- `server/controllers/auth.controller.js` (opcional, si se usa patrón controlador)
- `server/scripts/reset-password.js`
- Comandos de prueba para verificar login y token.

---

## Conclusión

Con lo construido hasta ahora tenemos una base sólida: estructura de proyecto bien organizada, base de datos definida con todas las tablas necesarias para un sistema de inventario seguro y auditado, y un plan claro para implementar autenticación y funcionalidades core. El enfoque en auditoría desde el inicio garantiza que cualquier intento de manipulación quede registrado, y el sistema de recuperación con clave única protege contra accesos no autorizados mientras permite al dueño recuperar el acceso si olvida su credencial.

La documentación permanecerá en `documentacion/resumen.md` y se actualizará a medida que avancemos en la construcción del sistema.

---
*Documento generado el 27 de marzo de 2026 como parte del proceso de desarrollo del Sistema de Inventario Hildemar.*