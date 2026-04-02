# Documentación de Problemas — Sistema Inventario Hildemar

**Fecha de auditoría:** 2026-03-28
**Revisión:** Completa (backend + frontend + seguridad)

---

## Resumen

| Categoría | Cantidad |
|-----------|----------|
| 🔴 Críticos | 3 |
| 🟡 Importantes | 5 |
| 🟢 Mejoras | 3 |
| **Total** | **11** |

---

## 🔴 CRÍTICOS — Arreglar antes de producción

### 1. XSS en el frontend — Inyección de código malicioso

- **Archivos afectados:** `public/js/views/productos.js`, `categorias.js`, `proveedores.js`, `movimientos.js`, `facturas.js`, `usuarios.js`, `dashboard.js`
- **Descripción:** Los templates insertan datos del usuario directamente en HTML usando `${variable}` sin escapar. Si un admin malicioso crea un producto con nombre `<script>alert('hack')</script>`, el código se ejecuta en el navegador de todos los usuarios.
- **Riesgo:** Robo de sesión, manipulación de datos, phishing.
- **Ejemplo vulnerable:**
  ```javascript
  <td><strong>${p.nombre}</strong></td>  // XSS si nombre contiene <script>
  ```
- **Fix:** Crear función `escapeHtml()` que convierta `<`, `>`, `&`, `"`, `'` a entidades HTML.

### 2. Endpoint `/db-test` sin autenticación

- **Archivo:** `server/index.js` línea 24
- **Descripción:** Cualquier persona puede visitar `http://servidor:3000/db-test` y ver la lista de todas las tablas de la base de datos sin necesidad de estar logueado.
- **Riesgo:** Fuga de información sobre la estructura de la DB.
- **Fix:** Agregar `authMiddleware` al endpoint o eliminarlo en producción.

### 3. Sin rate limiting en login

- **Archivo:** `server/routes/auth.js`
- **Descripción:** No hay límite de intentos de login. Un atacante puede probar miles de contraseñas por segundo.
- **Riesgo:** Ataque de fuerza bruta para descubrir contraseñas.
- **Fix:** Implementar rate limiting simple (máximo 5 intentos por IP cada 15 minutos).

---

## 🟡 IMPORTANTES — Arreglar pronto

### 4. Falta archivo `.env.example`

- **Descripción:** No existe un `.env.example` que documente las variables de entorno necesarias. Un nuevo desarrollador no sabe qué configurar.
- **Fix:** Crear `.env.example` con valores de ejemplo.

### 5. Sin headers de seguridad HTTP

- **Archivo:** `server/index.js`
- **Descripción:** Faltan headers básicos de seguridad como `X-Content-Type-Options` y `X-Frame-Options`.
- **Riesgo:** MIME sniffing, clickjacking.
- **Fix:** Agregar middleware de headers de seguridad.

### 6. Sin límite de tamaño de body JSON

- **Archivo:** `server/index.js`
- **Descripción:** `express.json()` sin límite permite que alguien envíe un JSON de 1GB, causando denial of service.
- **Riesgo:** Ataque de denegación de servicio (DoS).
- **Fix:** `app.use(express.json({ limit: '1mb' }));`

### 7. `apiFetch` crashea si el backend devuelve error no-JSON

- **Archivo:** `public/js/api.js` línea 65
- **Descripción:** `await response.json()` lanza excepción si el servidor devuelve HTML (ej: error 500 de Express con página de error).
- **Riesgo:** Error no manejado en el frontend, pantalla en blanco.
- **Fix:** Usar try/catch alrededor de `response.json()`.

### 8. Movimientos sin paginación por defecto

- **Archivo:** `server/routes/movimientos.js`
- **Descripción:** El GET de movimientos devuelve TODOS los registros. Con miles de movimientos, esto es lento y consume memoria.
- **Riesgo:** Performance degradation con el tiempo.
- **Fix:** Agregar paginación por defecto (ej: 100 registros máximo).

---

## 🟢 MEJORAS — Para el futuro

### 9. `updateNavigation` referencia elemento inexistente

- **Archivo:** `public/js/app.js` línea 78
- **Descripción:** `document.getElementById('login-page')` no existe en `index.html`. El código no falla pero no hace nada.
- **Fix:** Eliminar la referencia o agregar el elemento al HTML.

### 10. `proveedores.js` guarda objeto completo en auditoría

- **Archivo:** `server/routes/proveedores.js` línea 109
- **Descripción:** `const antes = { ...proveedor }` guarda todo el objeto incluyendo `created_at`, `activo`, etc. Debería guardar solo los campos relevantes.
- **Fix:** Guardar solo `nombre, contacto, telefono, email, direccion`.

### 11. `apiFetch` sin manejo de error de red

- **Descripción:** Si el servidor está caído, `fetch()` lanza un error de red que no tiene un mensaje amigable.
- **Fix:** Capturar errores de red y mostrar mensaje claro.

---

## Estado de resolución

| # | Problema | Estado |
|---|----------|--------|
| 1 | XSS frontend | ✅ Resuelto |
| 2 | /db-test sin auth | ✅ Resuelto |
| 3 | Rate limiting login | ✅ Resuelto |
| 4 | .env.example | ✅ Resuelto |
| 5 | Headers seguridad | ✅ Resuelto |
| 6 | Límite body JSON | ✅ Resuelto |
| 7 | apiFetch no-JSON | ✅ Resuelto |
| 8 | Paginación movimientos | ✅ Resuelto |
| 9 | Elemento inexistente | ✅ Resuelto |
| 10 | Auditoría proveedores | ✅ Resuelto |
| 11 | Error de red | ⏳ Pendiente (mejora futura) |

**Última actualización:** 2026-03-28
