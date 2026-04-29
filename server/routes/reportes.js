const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/reportes/cierre
// Retorna un resumen de ventas filtrado por fecha y opcionalmente por tipo/método
router.get('/cierre', authMiddleware, adminOnly, (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, tipo_venta, metodo_pago } = req.query;

        let queryBase = `
            SELECT 
                v.id,
                v.tipo_venta,
                v.metodo_pago,
                v.subtotal,
                v.descuento,
                v.recargo,
                v.total,
                v.created_at,
                c.nombre as cliente_nombre,
                u.nombre as vendedor_nombre
            FROM ventas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN users u ON v.user_id = u.id
            WHERE 1=1
        `;

        const params = [];

        if (fecha_inicio) {
            queryBase += ` AND date(v.created_at) >= ?`;
            params.push(fecha_inicio);
        }
        
        if (fecha_fin) {
            queryBase += ` AND date(v.created_at) <= ?`;
            params.push(fecha_fin);
        }

        if (tipo_venta) {
            queryBase += ` AND v.tipo_venta = ?`;
            params.push(tipo_venta);
        }

        if (metodo_pago) {
            queryBase += ` AND v.metodo_pago = ?`;
            params.push(metodo_pago);
        }

        queryBase += ` ORDER BY v.created_at DESC`;

        const ventas = db.prepare(queryBase).all(...params);

        // Calculate summaries
        const resumen = {
            total_general: 0,
            por_metodo: {},
            por_tipo: {}
        };

        for (const v of ventas) {
            resumen.total_general += v.total;
            
            // Agrupar por método (Ej: EFECTIVO, PAGO_MOVIL)
            const metodo = v.metodo_pago || 'SIN_METODO';
            if (!resumen.por_metodo[metodo]) resumen.por_metodo[metodo] = 0;
            resumen.por_metodo[metodo] += v.total;

            // Agrupar por tipo (Ej: CONTADO, FIADO, CONSUMO)
            const tipo = v.tipo_venta;
            if (!resumen.por_tipo[tipo]) resumen.por_tipo[tipo] = 0;
            resumen.por_tipo[tipo] += v.total;
        }

        res.json({
            ventas,
            resumen
        });

    } catch (error) {
        console.error('[Reportes] Error en cierre:', error);
        res.status(500).json({ error: 'Error interno del servidor al generar reporte' });
    }
});

const ExcelJS = require('exceljs');

// ... (existing code remains above)

// GET /api/reportes/excel
// Genera y descarga un archivo Excel con el reporte filtrado
router.get('/excel', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, tipo_venta, metodo_pago } = req.query;

        // 1. Obtener datos (mismo filtro que /cierre)
        let queryBase = `
            SELECT 
                v.id, v.tipo_venta, v.metodo_pago, v.subtotal, v.descuento, v.recargo, v.total, v.created_at,
                c.nombre as cliente_nombre, u.nombre as vendedor_nombre
            FROM ventas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN users u ON v.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        if (fecha_inicio) { queryBase += ` AND date(v.created_at) >= ?`; params.push(fecha_inicio); }
        if (fecha_fin) { queryBase += ` AND date(v.created_at) <= ?`; params.push(fecha_fin); }
        if (tipo_venta) { queryBase += ` AND v.tipo_venta = ?`; params.push(tipo_venta); }
        if (metodo_pago) { queryBase += ` AND v.metodo_pago = ?`; params.push(metodo_pago); }
        queryBase += ` ORDER BY v.created_at DESC`;

        const ventas = db.prepare(queryBase).all(...params);

        // Obtener tasa actual para conversión (prioridad: manual > cacheada)
        const manualRow = db.prepare("SELECT value FROM metadata WHERE key = 'tasa_dolar_manual'").get();
        const cacheRow = db.prepare("SELECT value FROM metadata WHERE key = 'tasa_dolar_cache'").get();
        
        let tasa = 1;
        if (manualRow && parseFloat(manualRow.value) > 0) {
            tasa = parseFloat(manualRow.value);
        } else if (cacheRow && parseFloat(cacheRow.value) > 0) {
            tasa = parseFloat(cacheRow.value);
        }

        // 2. Crear Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Reporte de Ventas');

        // Estilos
        const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } }, alignment: { horizontal: 'center' } };

        // Cabecera Principal
        sheet.mergeCells('A1:I1');
        sheet.getCell('A1').value = `REPORTE DE VENTAS - MAXI LICOR`;
        sheet.getCell('A1').font = { size: 16, bold: true };
        sheet.getCell('A1').alignment = { horizontal: 'center' };

        sheet.mergeCells('A2:I2');
        sheet.getCell('A2').value = `Periodo: ${fecha_inicio || 'Inicio'} al ${fecha_fin || 'Fin'} | Tasa Ref: ${tasa} Bs/USD`;
        sheet.getCell('A2').alignment = { horizontal: 'center' };

        // Encabezados de tabla
        const headers = ['ID', 'Fecha', 'Hora', 'Cliente', 'Cajero', 'Método', 'Tipo', 'Total ($)', 'Total (Bs)'];
        const headerRow = sheet.addRow(headers);
        headerRow.eachCell((cell) => { cell.style = headerStyle; });

        // Datos
        let totalUSD = 0;
        ventas.forEach(v => {
            const fecha = new Date(v.created_at);
            totalUSD += v.total;
            const row = sheet.addRow([
                v.id,
                fecha.toLocaleDateString('es-VE'),
                fecha.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
                v.cliente_nombre || 'Consumidor Final',
                v.vendedor_nombre,
                v.metodo_pago || 'CRÉDITO',
                v.tipo_venta,
                v.total,
                v.total * tasa
            ]);
            row.getCell(8).numFmt = '"$"#,##0.00';
            row.getCell(9).numFmt = '#,##0.00" Bs"';
        });

        // Totales al final
        sheet.addRow([]);
        const totalRow = sheet.addRow(['', '', '', '', '', '', 'TOTAL GENERAL:', totalUSD, totalUSD * tasa]);
        totalRow.getCell(7).font = { bold: true };
        totalRow.getCell(8).font = { bold: true };
        totalRow.getCell(8).numFmt = '"$"#,##0.00';
        totalRow.getCell(9).font = { bold: true };
        totalRow.getCell(9).numFmt = '#,##0.00" Bs"';

        // Ajustar anchos
        sheet.columns.forEach(col => { col.width = 15; });
        sheet.getColumn(4).width = 25; // Cliente más ancho

        // 3. Enviar archivo
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=reporte_ventas_${new Date().toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('[Reportes] Error en Excel:', error);
        res.status(500).json({ error: 'Error al generar el archivo Excel' });
    }
});

const pdfmake = require('pdfmake');

// Configuración de fuentes para pdfmake (estándar en Node.js)
const fonts = {
    Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};

// Configurar fuentes en la instancia
pdfmake.setFonts(fonts);

// GET /api/reportes/pdf
// Genera y descarga un archivo PDF con el reporte filtrado
router.get('/pdf', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, tipo_venta, metodo_pago } = req.query;

        // 1. Obtener datos (mismo filtro que /cierre y /excel)
        let queryBase = `
            SELECT 
                v.id, v.tipo_venta, v.metodo_pago, v.total, v.created_at,
                c.nombre as cliente_nombre, u.nombre as vendedor_nombre
            FROM ventas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN users u ON v.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        if (fecha_inicio) { queryBase += ` AND date(v.created_at) >= ?`; params.push(fecha_inicio); }
        if (fecha_fin) { queryBase += ` AND date(v.created_at) <= ?`; params.push(fecha_fin); }
        if (tipo_venta) { queryBase += ` AND v.tipo_venta = ?`; params.push(tipo_venta); }
        if (metodo_pago) { queryBase += ` AND v.metodo_pago = ?`; params.push(metodo_pago); }
        queryBase += ` ORDER BY v.created_at DESC`;

        const ventas = db.prepare(queryBase).all(...params);

        // Obtener tasa actual para conversión
        const manualRow = db.prepare("SELECT value FROM metadata WHERE key = 'tasa_dolar_manual'").get();
        const cacheRow = db.prepare("SELECT value FROM metadata WHERE key = 'tasa_dolar_cache'").get();
        let tasa = 1;
        if (manualRow && parseFloat(manualRow.value) > 0) tasa = parseFloat(manualRow.value);
        else if (cacheRow && parseFloat(cacheRow.value) > 0) tasa = parseFloat(cacheRow.value);

        // Calcular resumen para el PDF
        let totalUSD = 0;
        const porMetodo = {};
        ventas.forEach(v => {
            totalUSD += v.total;
            const met = v.metodo_pago || 'CRÉDITO';
            porMetodo[met] = (porMetodo[met] || 0) + v.total;
        });

        // 2. Definición del Documento
        const docDefinition = {
            content: [
                { text: 'MAXI LICOR - REPORTE DE VENTAS', style: 'header' },
                { 
                    text: `Periodo: ${fecha_inicio || 'Inicio'} al ${fecha_fin || 'Fin'}`, 
                    style: 'subheader' 
                },
                { 
                    text: `Tasa de Referencia: ${tasa.toLocaleString('es-VE')} Bs/USD`, 
                    margin: [0, 0, 0, 15] 
                },

                // Sección Resumen
                { text: 'RESUMEN DE CAJA', style: 'sectionTitle' },
                {
                    table: {
                        widths: ['*', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'Método', style: 'tableHeader' }, 
                                { text: 'Total USD', style: 'tableHeader' }, 
                                { text: 'Total Bs', style: 'tableHeader' }
                            ],
                            ...Object.entries(porMetodo).map(([met, val]) => [
                                met.replace('_', ' '), 
                                `$${val.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 
                                `${(val * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs`
                            ]),
                            [
                                { text: 'TOTAL GENERAL', bold: true, fillColor: '#f3f4f6' },
                                { text: `$${totalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, bold: true, fillColor: '#f3f4f6' },
                                { text: `${(totalUSD * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs`, bold: true, fillColor: '#f3f4f6' }
                            ]
                        ]
                    },
                    margin: [0, 0, 0, 20]
                },

                // Tabla Detallada
                { text: 'DETALLE DE OPERACIONES', style: 'sectionTitle' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['auto', 'auto', '*', 'auto'],
                        body: [
                            [
                                { text: 'Hora', style: 'tableHeader' },
                                { text: 'Método', style: 'tableHeader' },
                                { text: 'Cliente', style: 'tableHeader' },
                                { text: 'Total ($)', style: 'tableHeader' }
                            ],
                            ...ventas.map(v => {
                                const hora = new Date(v.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
                                return [
                                    hora,
                                    v.metodo_pago ? v.metodo_pago.substring(0, 5) : 'CRED',
                                    { text: (v.cliente_nombre || 'Final').substring(0, 15), fontSize: 9 },
                                    { text: `$${v.total.toFixed(2)}`, alignment: 'right' }
                                ];
                            })
                        ]
                    }
                }
            ],
            styles: {
                header: { fontSize: 18, bold: true, color: '#e11d48', alignment: 'center', margin: [0, 0, 0, 5] },
                subheader: { fontSize: 12, color: '#64748b', alignment: 'center', margin: [0, 0, 0, 10] },
                sectionTitle: { fontSize: 14, bold: true, margin: [0, 10, 0, 5], color: '#1e293b' },
                tableHeader: { bold: true, fontSize: 10, color: 'white', fillColor: '#e11d48', alignment: 'center' }
            },
            defaultStyle: { fontSize: 10 }
        };

        const pdfDoc = pdfmake.createPdf(docDefinition);
        const stream = await pdfDoc.getStream();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=cierre_${new Date().toISOString().split('T')[0]}.pdf`);
        
        stream.pipe(res);
        stream.end();

    } catch (error) {
        console.error('[Reportes] Error en PDF:', error);
        res.status(500).json({ error: 'Error al generar el archivo PDF' });
    }
});

module.exports = router;
