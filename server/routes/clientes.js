const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { registrarAuditoria } = require('../middleware/audit');
const { exportToExcel } = require('../services/excel');

// GET /api/clientes/export/excel - Exportar clientes a Excel
router.get('/export/excel', authMiddleware, adminOnly, async (req, res) => {
    try {
        const clientes = db.prepare('SELECT id, nombre, telefono, saldo_deuda, created_at FROM clientes WHERE activo = 1 ORDER BY nombre ASC').all();
        
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'NOMBRE DEL CLIENTE', key: 'nombre', width: 40 },
            { header: 'TELÉFONO', key: 'telefono', width: 20 },
            { header: 'DEUDA PENDIENTE ($)', key: 'saldo_deuda', width: 25 },
            { header: 'FECHA DE REGISTRO', key: 'created_at', width: 25 }
        ];

        const rows = clientes.map(c => ({
            id: c.id,
            nombre: c.nombre,
            telefono: c.telefono || 'N/A',
            saldo_deuda: Number(c.saldo_deuda).toFixed(2),
            created_at: new Date(c.created_at).toLocaleString('es-VE')
        }));

        await exportToExcel(res, columns, rows, 'Clientes', `Directorio_Clientes_${new Date().toISOString().split('T')[0]}`);
    } catch (error) {
        console.error('[Clientes Excel] Error exportando:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Error exportando Excel' });
    }
});

// GET /api/clientes - Listar todos los clientes activos
router.get('/', authMiddleware, (req, res) => {
    try {
        const clientes = db.prepare('SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre ASC').all();
        res.json(clientes);
    } catch (error) {
        console.error('[Clientes] Error al obtener clientes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/clientes/:id - Obtener un cliente específico
router.get('/:id', authMiddleware, (req, res) => {
    try {
        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ? AND activo = 1').get(req.params.id);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json(cliente);
    } catch (error) {
        console.error('[Clientes] Error al obtener cliente:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/clientes - Crear un nuevo cliente
router.post('/', authMiddleware, adminOnly, (req, res) => {
    const { nombre, telefono } = req.body;
    
    try {
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const result = db.prepare(`
            INSERT INTO clientes (nombre, telefono, saldo_deuda) 
            VALUES (?, ?, 0)
        `).run(nombre.trim(), telefono ? telefono.trim() : null);

        const nuevoCliente = { 
            id: result.lastInsertRowid, 
            nombre: nombre.trim(), 
            telefono: telefono ? telefono.trim() : null,
            saldo_deuda: 0 
        };

        registrarAuditoria(req.user.id, req.user.username, 'CREATE', 'cliente', result.lastInsertRowid, nuevoCliente, req.ip);
        
        res.status(201).json({ 
            message: 'Cliente creado exitosamente', 
            cliente: nuevoCliente 
        });
    } catch (error) {
        console.error('[Clientes] Error al crear cliente:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/clientes/:id - Actualizar datos del cliente
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
    const { nombre, telefono } = req.body;
    const { id } = req.params;

    try {
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const clienteExiste = db.prepare('SELECT * FROM clientes WHERE id = ? AND activo = 1').get(id);
        if (!clienteExiste) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        db.prepare(`
            UPDATE clientes 
            SET nombre = ?, telefono = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(nombre.trim(), telefono ? telefono.trim() : null, id);

        const datosActualizados = { nombre: nombre.trim(), telefono: telefono ? telefono.trim() : null };
        registrarAuditoria(req.user.id, req.user.username, 'UPDATE', 'cliente', id, datosActualizados, req.ip);

        res.json({ message: 'Cliente actualizado exitosamente' });
    } catch (error) {
        console.error('[Clientes] Error al actualizar cliente:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE /api/clientes/:id - Eliminar cliente (soft delete)
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
    const { id } = req.params;

    try {
        const cliente = db.prepare('SELECT id, saldo_deuda FROM clientes WHERE id = ? AND activo = 1').get(id);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        if (cliente.saldo_deuda > 0) {
            return res.status(400).json({ error: 'No se puede eliminar un cliente que tiene deuda pendiente' });
        }

        db.prepare('UPDATE clientes SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

        registrarAuditoria(req.user.id, req.user.username, 'DELETE', 'cliente', id, { activo: 0 }, req.ip);

        res.json({ message: 'Cliente eliminado exitosamente' });
    } catch (error) {
        console.error('[Clientes] Error al eliminar cliente:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/clientes/:id/abono - Registrar un pago para reducir deuda
router.post('/:id/abono', authMiddleware, (req, res) => {
    const { monto } = req.body;
    const { id } = req.params;

    try {
        if (!monto || isNaN(monto) || Number(monto) <= 0) {
            return res.status(400).json({ error: 'El monto del abono debe ser mayor a cero' });
        }

        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ? AND activo = 1').get(id);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        if (cliente.saldo_deuda <= 0) {
            return res.status(400).json({ error: 'El cliente no tiene deuda pendiente' });
        }

        // Evitar abonar más de lo que debe
        const montoAbonar = Math.min(Number(monto), cliente.saldo_deuda);
        
        db.prepare(`
            UPDATE clientes 
            SET saldo_deuda = saldo_deuda - ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(montoAbonar, id);

        const detalleAbono = { 
            monto_abonado: montoAbonar, 
            saldo_anterior: cliente.saldo_deuda, 
            saldo_restante: cliente.saldo_deuda - montoAbonar 
        };
        registrarAuditoria(req.user.id, req.user.username, 'ABONO', 'cliente', id, detalleAbono, req.ip);

        res.json({ 
            message: 'Abono registrado exitosamente', 
            monto_abonado: montoAbonar,
            saldo_restante: cliente.saldo_deuda - montoAbonar
        });
    } catch (error) {
        console.error('[Clientes] Error al registrar abono:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/clientes/:id/pdf - Generar Estado de Cuenta del cliente en PDF
const pdfmake = require('pdfmake');
const fonts = {
    Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};
pdfmake.setFonts(fonts);

router.get('/:id/pdf', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Obtener datos del cliente
        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ? AND activo = 1').get(id);
        if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

        // 2. Obtener historial de ventas (con detalles)
        const ventas = db.prepare(`
            SELECT v.*, u.nombre as vendedor_nombre 
            FROM ventas v
            LEFT JOIN users u ON v.user_id = u.id
            WHERE v.cliente_id = ?
            ORDER BY v.created_at DESC
        `).all(id);

        // Obtener detalles para cada venta
        for (let v of ventas) {
            v.detalles = db.prepare(`
                SELECT vd.*, p.nombre as producto_nombre
                FROM ventas_detalles vd
                JOIN productos p ON vd.producto_id = p.id
                WHERE vd.venta_id = ?
            `).all(v.id);
        }

        // 3. Obtener historial de abonos (desde auditoría)
        const abonos = db.prepare(`
            SELECT * FROM audit_log 
            WHERE entidad = 'cliente' AND entidad_id = ? AND accion = 'ABONO'
            ORDER BY created_at DESC
        `).all(id);

        // Obtener tasa actual para conversión
        const manualRow = db.prepare("SELECT value FROM metadata WHERE key = 'tasa_dolar_manual'").get();
        const cacheRow = db.prepare("SELECT value FROM metadata WHERE key = 'tasa_dolar_cache'").get();
        let tasa = 1;
        if (manualRow && parseFloat(manualRow.value) > 0) tasa = parseFloat(manualRow.value);
        else if (cacheRow && parseFloat(cacheRow.value) > 0) tasa = parseFloat(cacheRow.value);

        // 4. Definición del PDF
        const content = [
            { text: 'ESTADO DE CUENTA', style: 'header' },
            { text: cliente.nombre.toUpperCase(), style: 'clienteNombre' },
            { text: `Teléfono: ${cliente.telefono || 'N/A'}`, margin: [0, 0, 0, 10], alignment: 'center' },
            
            {
                table: {
                    widths: ['*'],
                    body: [[{
                        text: [
                            { text: 'DEUDA PENDIENTE ACTUAL: ', bold: true },
                            { text: `$${cliente.saldo_deuda.toFixed(2)} USD`, color: '#e11d48', bold: true, fontSize: 16 },
                            { text: `  /  ${(cliente.saldo_deuda * tasa).toLocaleString('es-VE')} Bs`, fontSize: 12 }
                        ],
                        alignment: 'center',
                        fillColor: '#fff1f2',
                        padding: [10, 10, 10, 10]
                    }]]
                },
                margin: [0, 0, 0, 20],
                layout: 'noBorders'
            }
        ];

        // Sección Compras
        content.push({ text: 'HISTORIAL DE COMPRAS', style: 'sectionTitle' });
        if (ventas.length === 0) {
            content.push({ text: 'No se registran compras hasta la fecha.', italics: true, margin: [0, 5, 0, 0] });
        } else {
            ventas.forEach(v => {
                const fecha = new Date(v.created_at).toLocaleDateString('es-VE');
                const hora = new Date(v.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
                content.push({
                    stack: [
                        {
                            columns: [
                                { text: `Ticket #${v.id} - ${fecha} ${hora}`, bold: true, fontSize: 10 },
                                { text: `${v.tipo_venta} - $${v.total.toFixed(2)}`, alignment: 'right', fontSize: 10, color: '#1e293b', bold: true }
                            ],
                            margin: [0, 5, 0, 2]
                        },
                        {
                            table: {
                                widths: ['*', 'auto', 'auto'],
                                body: v.detalles.map(d => [
                                    { text: d.producto_nombre, fontSize: 9 },
                                    { text: `${d.cantidad} ${d.tipo_unidad}`, fontSize: 9, alignment: 'center' },
                                    { text: `$${(d.cantidad * d.precio_unitario).toFixed(2)}`, fontSize: 9, alignment: 'right' }
                                ])
                            },
                            margin: [0, 0, 0, 10],
                            layout: {
                                hLineWidth: () => 0.5,
                                vLineWidth: () => 0,
                                hLineColor: () => '#e2e8f0',
                                paddingLeft: () => 5,
                                paddingRight: () => 5,
                            }
                        }
                    ]
                });
            });
        }

        // Sección Abonos (Solo si existen)
        if (abonos.length > 0) {
            content.push({ text: 'HISTORIAL DE ABONOS (PAGOS)', style: 'sectionTitle', margin: [0, 20, 0, 5] });
            content.push({
                table: {
                    widths: ['auto', '*', 'auto'],
                    headerRows: 1,
                    body: [
                        [
                            { text: 'Fecha', style: 'tableHeader' },
                            { text: 'Concepto', style: 'tableHeader' },
                            { text: 'Monto ($)', style: 'tableHeader' }
                        ],
                        ...abonos.map(a => {
                            const fecha = new Date(a.created_at).toLocaleDateString('es-VE');
                            const detalle = JSON.parse(a.detalle);
                            return [
                                fecha,
                                'Abono a cuenta',
                                { text: `$${parseFloat(detalle.monto_abonado).toFixed(2)}`, alignment: 'right', color: '#16a34a', bold: true }
                            ];
                        })
                    ]
                },
                layout: 'lightHorizontalLines'
            });
        }

        const docDefinition = {
            content: content,
            styles: {
                header: { fontSize: 20, bold: true, color: '#e11d48', alignment: 'center', margin: [0, 0, 0, 5] },
                clienteNombre: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
                sectionTitle: { fontSize: 11, bold: true, color: 'white', fillColor: '#1e293b', margin: [0, 10, 0, 5] },
                tableHeader: { bold: true, fontSize: 10, color: 'white', fillColor: '#e11d48', alignment: 'center' }
            },
            defaultStyle: { fontSize: 10 }
        };

        const pdfDoc = pdfmake.createPdf(docDefinition);
        const stream = await pdfDoc.getStream();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=cuenta_${cliente.nombre.replace(/ /g, '_')}.pdf`);
        
        stream.pipe(res);
        stream.end();

    } catch (error) {
        console.error('[Clientes] Error en PDF:', error);
        res.status(500).json({ error: 'Error al generar el estado de cuenta' });
    }
});

module.exports = router;
