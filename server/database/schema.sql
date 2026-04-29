-- SISTEMA DE INVENTARIO HILDEMAR - Schema
-- Motor: SQLite

PRAGMA foreign_keys = ON;

-- Usuarios del sistema
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre TEXT NOT NULL,
    email TEXT,
    rol TEXT NOT NULL DEFAULT 'empleado',
    activo INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Clave de recuperación (generada una vez durante setup)
CREATE TABLE IF NOT EXISTS recovery_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categorías de productos
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    contacto TEXT,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Productos
CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE,
    codigo_barras TEXT,
    nombre TEXT NOT NULL,
    marca TEXT,
    volumen TEXT,
    descripcion TEXT,
    categoria_id INTEGER REFERENCES categorias(id),
    proveedor_id INTEGER REFERENCES proveedores(id),
    unidad_medida TEXT NOT NULL DEFAULT 'unidad',
    unidades_por_caja INTEGER NOT NULL DEFAULT 1,
    stock_actual REAL NOT NULL DEFAULT 0,
    stock_minimo REAL NOT NULL DEFAULT 0,
    precio_compra REAL NOT NULL DEFAULT 0,
    precio_venta REAL NOT NULL DEFAULT 0,
    precio_venta_detal REAL NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Facturas (fotos/PDFs de proveedores)
CREATE TABLE IF NOT EXISTS facturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id INTEGER REFERENCES proveedores(id),
    numero_factura TEXT,
    archivo_tipo TEXT NOT NULL,
    archivo_ruta TEXT NOT NULL,
    archivo_nombre_original TEXT,
    monto_total REAL,
    fecha_factura DATE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Movimientos de stock (NUNCA se borra ni edita)
CREATE TABLE IF NOT EXISTS movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    tipo TEXT NOT NULL,
    cantidad REAL NOT NULL,
    motivo TEXT,
    proveedor_id INTEGER REFERENCES proveedores(id),
    factura_id INTEGER REFERENCES facturas(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    notas TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Auditoría (NUNCA se borra ni edita)
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    accion TEXT NOT NULL,
    entidad TEXT NOT NULL,
    entidad_id INTEGER,
    detalle TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Clientes (Deudores)
CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    saldo_deuda REAL NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ventas (Tickets)
CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER REFERENCES clientes(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    tipo_venta TEXT NOT NULL, -- 'NORMAL', 'FIADO', 'DUENO', 'APOYO'
    metodo_pago TEXT, -- 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'PAGO_MOVIL'
    subtotal REAL NOT NULL,
    descuento REAL NOT NULL DEFAULT 0,
    recargo REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Detalles de Venta
CREATE TABLE IF NOT EXISTS ventas_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL REFERENCES ventas(id),
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad REAL NOT NULL,
    tipo_unidad TEXT DEFAULT 'unidad',
    precio_unitario REAL NOT NULL
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(created_at);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras ON productos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(created_at);
CREATE INDEX IF NOT EXISTS idx_movimientos_user ON movimientos(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_fecha ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entidad ON audit_log(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_facturas_proveedor ON facturas(proveedor_id);
