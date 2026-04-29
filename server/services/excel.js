const ExcelJS = require('exceljs');

/**
 * Genera y envía un archivo Excel.
 * @param {Object} res - Objeto de respuesta de Express.
 * @param {Array} columns - Configuración de columnas [{ header: 'ID', key: 'id', width: 10 }, ...]
 * @param {Array} rows - Datos a insertar en las filas
 * @param {String} sheetName - Nombre de la pestaña (Hoja 1)
 * @param {String} fileName - Nombre del archivo de descarga
 */
const exportToExcel = async (res, columns, rows, sheetName, fileName) => {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Inventario Hildemar';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet(sheetName, {
            views: [{ state: 'frozen', ySplit: 1 }] // Congelar la primera fila (cabeceras)
        });

        // Configurar columnas
        sheet.columns = columns;

        // Estilizar cabeceras
        const headerRow = sheet.getRow(1);
        headerRow.font = { name: 'Arial', family: 4, size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1e293b' } // Color oscuro para cabecera (Slate 800)
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // Añadir datos
        sheet.addRows(rows);

        // Ajustar bordes a todas las celdas
        sheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
            row.eachCell({ includeEmpty: false }, function (cell, colNumber) {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
                
                // Si no es la cabecera, añadir un color de fila alterno para mejor lectura
                if (rowNumber > 1 && rowNumber % 2 === 0) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF8FAFC' } // Slate 50
                    };
                }
            });
        });

        // Configurar headers para descarga
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}.xlsx`);

        // Escribir el buffer y enviar
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('[ExcelJS] Error generando Excel:', error);
        res.status(500).json({ error: 'Error interno generando el archivo Excel' });
    }
};

module.exports = {
    exportToExcel
};
