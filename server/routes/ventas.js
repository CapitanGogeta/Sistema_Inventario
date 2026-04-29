const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/audit');

// GET /api/ventas - Listar ventas (con soporte para paginación opcional)
router.get('/', authMiddleware, (req, res) => {
    try {
        const limite = req.query.limit ? parseInt(req.query.limit) : 100;
        const ventas = db.prepare(`
            SELECT v.*, c.nombre as cliente_nombre, u.nombre as vendedor_nombre 
            FROM ventas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN users u ON v.user_id = u.id
            ORDER BY v.created_at DESC
            LIMIT ?
        `).all(limite);
        res.json(ventas);
    } catch (error) {
        console.error('[Ventas] Error al obtener ventas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/ventas - Registrar una nueva venta (TICKET)
router.post('/', authMiddleware, (req, res) => {
    const {
        cliente_id,
        tipo_venta,
        metodo_pago,
        subtotal,
        descuento,
        recargo,
        total,
        detalles // Array de: { producto_id, cantidad, precio_unitario }
    } = req.body;

    try {
        if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
            return res.status(400).json({ error: 'El ticket no tiene productos' });
        }

        if (tipo_venta === 'FIADO' && !cliente_id) {
            return res.status(400).json({ error: 'Debe seleccionar un cliente para ventas fiadas' });
        }

        // Preparar la transacción atómica
        const registrarVentaTransaccion = db.transaction(() => {
            // 1. Crear el ticket (Venta maestra)
            const insertVenta = db.prepare(`
                INSERT INTO ventas (cliente_id, user_id, tipo_venta, metodo_pago, subtotal, descuento, recargo, total) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const infoVenta = insertVenta.run(
                cliente_id || null, 
                req.user.id, 
                tipo_venta, 
                metodo_pago || null, 
                subtotal, 
                descuento || 0, 
                recargo || 0, 
                total
            );
            const ventaId = infoVenta.lastInsertRowid;

            // 2. Insertar detalles, descontar stock y generar movimientos
            const insertDetalle = db.prepare(`
                INSERT INTO ventas_detalles (venta_id, producto_id, cantidad, tipo_unidad, precio_unitario) 
                VALUES (?, ?, ?, ?, ?)
            `);
            const getProducto = db.prepare(`SELECT unidades_por_caja FROM productos WHERE id = ?`);
            const updateStock = db.prepare(`
                UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?
            `);
            const insertMovimiento = db.prepare(`
                INSERT INTO movimientos (producto_id, tipo, cantidad, motivo, user_id, notas)
                VALUES (?, 'VENTA', ?, ?, ?, ?)
            `);

            for (const item of detalles) {
                const prod = getProducto.get(item.producto_id);
                const unidadesPorCaja = prod ? prod.unidades_por_caja : 1;
                
                // Determinar la cantidad real a descontar (en unidades base)
                let cantDescontar = item.cantidad;
                if (item.tipo_unidad === 'caja') {
                    cantDescontar = item.cantidad * unidadesPorCaja;
                }

                // Registrar linea del ticket
                insertDetalle.run(ventaId, item.producto_id, item.cantidad, item.tipo_unidad || 'unidad', item.precio_unitario);
                
                // Descontar inventario
                updateStock.run(cantDescontar, item.producto_id);

                // Registrar movimiento histórico
                // Convertimos cantidad a negativo para que refleje la salida en el Kardex
                const cantSalida = -Math.abs(cantDescontar);
                const motivo = `Venta #${ventaId} (${tipo_venta})`;
                insertMovimiento.run(item.producto_id, cantSalida, motivo, req.user.id, `Método: ${metodo_pago || 'N/A'} - Se vendió como: ${item.tipo_unidad || 'unidad'}`);
            }

            // 3. Si es Fiado, sumar a la deuda del cliente
            if (tipo_venta === 'FIADO' && cliente_id) {
                db.prepare(`UPDATE clientes SET saldo_deuda = saldo_deuda + ? WHERE id = ?`).run(total, cliente_id);
            }

            return ventaId;
        });

        // Ejecutar toda la transacción
        const nuevaVentaId = registrarVentaTransaccion();

        // 4. Registrar auditoría (fuera de la transacción para evitar fallos si la DB está ocupada)
        registrarAuditoria(req.user.id, req.user.username, 'CREATE', 'venta', nuevaVentaId, { tipo: tipo_venta, total }, req.ip);

        res.status(201).json({ message: 'Venta registrada exitosamente', venta_id: nuevaVentaId });
    } catch (error) {
        console.error('[Ventas] Error al procesar venta:', error);
        res.status(500).json({ error: 'Error interno al procesar el ticket de venta' });
    }
});

module.exports = router;
