# Sistema de Inventario - Maxi Licor

## Estado Actual del Proyecto

**Última actualización:** 16 de Abril 2026  
**Estado:** Funcional, listo para presentación al cliente

---

## Quick Start

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start

# Credenciales de prueba
# Admin: admin / admin123
# Empleado: empleado / empleado123
```

**URL:** http://localhost:3000

---

## Estructura del Proyecto

```
Inventario_Hildemar/
├── server/                 # Backend Node.js + Express
│   ├── index.js           # Entry point, API de tasa-dolar
│   ├── database/
│   │   ├── db.js          # Conexión SQLite
│   │   └── schema.sql     # Definición de tablas
│   ├── routes/            # Endpoints API
│   │   ├── auth.js        # Login, usuarios
│   │   ├── productos.js   # CRUD productos
│   │   ├── movimientos.js # Movimientos stock
│   │   ├── facturas.js    # Subida archivos
│   │   ├── categorias.js  # CRUD categorías
│   │   └── proveedores.js # CRUD proveedores
│   ├── middleware/
│   │   ├── auth.js        # JWT verification
│   │   └── audit.js       # Registro de auditoría
│   └── scripts/
│       ├── setup.js       # Primer setup interactivo
│       └── reset-password.js
├── public/                # Frontend SPA (vanilla JS)
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── app.js         # Router, estado global (tasaDolar)
│       ├── api.js         # Fetch wrapper
│       ├── auth.js        # JWT handling
│       └── views/         # Vistas individuales
│           ├── login.js
│           ├── dashboard.js
│           ├── productos.js
│           ├── movimientos.js
│           ├── facturas.js
│           ├── categorias.js
│           ├── proveedores.js
│           └── usuarios.js
└── data/                  # Base de datos SQLite (gitignored)
```

---

## Configuración de Venezuela

### Monedas Dual (USD + Bs)
- **API de tasa:** https://ve.dolarapi.com/v1/dolares/oficial
- **Endpoint:** `GET /api/tasa-dolar`
- **Fallback:** Variable `TASA_DOLAR_FALLBACK=45` en .env

### Funcionalidades implementadas:
- ✅ Tasa del dólar visible en navbar
- ✅ Precios en productos mostrados en USD y Bs
- ✅ Monto de facturas en ambas monedas
- ✅ Valor total del inventario en dashboard (USD + Bs)
- ✅ Formato locale: `es-VE`

---

## Permisos por Rol

| Sección | Admin | Empleado |
|---------|-------|----------|
| Dashboard | ✅ | ✅ |
| Categorías | CRUD | Ver |
| Proveedores | CRUD | Ver |
| Productos | CRUD | Ver |
| Movimientos | CRUD | Ver + **Crear** |
| Facturas | Subir | Ver |
| Usuarios | CRUD | ❌ |

### Empleado puede:
- Ver todas las secciones
- **Crear movimientos** (entradas/salidas de stock)
- No ve el menú de Usuarios

---

## Problemas Conocidos / Correcciones Pendientes

### Pendientes de implementar:
1. [ ] Validar stock suficiente en SALIDA (evitar stock negativo)
2. [ ] Agregar búsqueda/filtro en productos por nombre
3. [ ] Exportar inventario a Excel/PDF
4. [ ] Notificaciones de stock bajo por email

### Bugs conocidos:
- [ ] El empleado puede ver el historial de movimientos pero no el detalle de notas (el modal funciona)
- [ ] La tasa del dólar no se actualiza automáticamente cada hora (solo al recargar página)

---

## Mejoras Futuras (Roadmap)

*Lista completa en `Correcciones_pendientes.md`*

### Funcionalidades pendientes:
- [ ] Productos más vendidos (reportes)
- [ ] Método de pago por venta
- [ ] Función de deudores (cuentas por cobrar)
- [ ] Porcentaje de ganancia visualizado
- [ ] **Aumento de precio fuera de horario** (configurable por categoría)
- [ ] Backup instantáneo (local + nube Google)
- [ ] Descuentos por ticket (clientes frecuentes)
- [ ] Código de dueño (productos del negocio vs vendidos)
- [ ] Código de apoyo (regalos a autoridades)
- [ ] Agregar productos por unidad y cajas
- [ ] Sincronización de descuento de inventario (unidades vs cajas)
- [ ] Cantidad de unidades por caja en el schema
- [ ] Escaneo por código de barras
- [ ] **Compatibilidad móvil** (iOS + Android)
- [ ] Reportes por fecha (PDF + Excel)

---

## Base de Datos

**Engine:** SQLite (better-sqlite3)

### Tablas principales:
- `users` — usuarios (rol: admin/empleado)
- `productos` — productos del inventario
- `movimientos` — historial de entradas/salidas
- `facturas` — archivos subidos de facturas
- `categorías` — categorías de productos
- `proveedores` — proveedores
- `audit_log` — log de auditoría (solo inserts)

### Datos de prueba actuales:
- 4 productos (Coca-Cola, Cacique 500, Cerveza Polar, Whisky)
- 5 movimientos registrados
- 2 usuarios (admin + empleado)

---

## API Endpoints

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | /api/auth/login | ❌ | Login |
| GET | /api/productos | ✅ | Listar productos |
| POST | /api/productos | ✅ admin | Crear producto |
| GET | /api/movimientos | ✅ | Listar movimientos |
| POST | /api/movimientos | ✅ | Crear movimiento |
| GET | /api/facturas | ✅ | Listar facturas |
| POST | /api/facturas | ✅ admin | Subir factura |
| GET | /api/categorias | ✅ | Listar categorías |
| GET | /api/proveedores | ✅ | Listar proveedores |
| GET | /api/tasa-dolar | ❌ | Tasa del BCV |
| GET | /api/auth/users | ✅ admin | Listar usuarios |

---

## Variables de Entorno (.env)

```env
PORT=3000
JWT_SECRET=tu-secreto-aqui
JWT_EXPIRES_IN=8h
TASA_DOLAR_FALLBACK=45
```

---

## Tech Stack

- **Backend:** Node.js, Express, SQLite (better-sqlite3), JWT
- **Frontend:** Vanilla HTML/CSS/JS, SPA sin frameworks
- **Auth:** JWT stateless con httpOnly (token en headers)
- **Estilo:** CSS custom, diseño limpio responsive

---

## Notas para siguiente desarrollador

1. **No usar frameworks frontend** — El proyecto刻意保持 vanilla para simplicidad
2. **Auditoría inmutable** — La tabla audit_log solo acepta INSERTs, nunca UPDATE/DELETE
3. **Soft delete** — Tablas principales usan `activo = 0` en lugar de borrar filas
4. **Tasa del dólar** — Si la API del BCV falla, usa el fallback del .env
5. **Empleados pueden crear movimientos** — Esta lógica está en el frontend (botón oculto) y backend (sin adminOnly)

---

## Contacto / Soporte

Este sistema fue desarrollado para **Maxi Licor** (almacén mayorista en Venezuela).

**Stack:** Node.js + Express + SQLite + Vanilla JS  
**Último commit:** 9d9ea88 (feat: sistema Maxi Licor - monedas Venezuela, permisos empleado y branding)