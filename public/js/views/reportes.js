// Reportes View - Cierres de caja y auditoría

const Reportes = {
    data: null, // { ventas: [], resumen: {} }

    render() {
        // Por defecto: fecha de hoy
        const hoy = new Date().toISOString().split('T')[0];

        return `
            <div class="container">
                <div class="page-header">
                    <h1 class="page-title">Cierres y Reportes</h1>
                    <p class="page-subtitle">Auditoría de ventas diarias y métodos de pago</p>
                </div>

                <!-- Filtros -->
                <div class="card" style="margin-bottom: 20px;">
                    <div class="card-header">
                        <h2 class="card-title">Filtros de Búsqueda</h2>
                    </div>
                    <form id="reportes-filtros" class="form-row" onsubmit="Reportes.load(event)">
                        <div class="form-group">
                            <label class="form-label">Fecha Inicio</label>
                            <input type="date" id="rep-fecha-inicio" class="form-input" value="${hoy}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Fecha Fin</label>
                            <input type="date" id="rep-fecha-fin" class="form-input" value="${hoy}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Método de Pago</label>
                            <select id="rep-metodo" class="form-select">
                                <option value="">Todos</option>
                                <option value="EFECTIVO">Efectivo</option>
                                <option value="PAGO_MOVIL">Pago Móvil</option>
                                <option value="TRANSFERENCIA">Transferencia</option>
                                <option value="PUNTO">Punto de Venta</option>
                                <option value="ZELLE">Zelle / Divisas</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Tipo de Venta</label>
                            <select id="rep-tipo" class="form-select">
                                <option value="">Todos</option>
                                <option value="NORMAL">Normal (Contado)</option>
                                <option value="FIADO">Fiado</option>
                                <option value="DUENO">Consumo Dueño</option>
                                <option value="APOYO">Apoyo a Local</option>
                            </select>
                        </div>
                        <div class="form-group" style="display: flex; align-items: flex-end;">
                            <button type="submit" class="btn btn-primary" style="width: 100%">Generar</button>
                        </div>
                    </form>
                </div>

                <!-- Resumen (Tarjetas) -->
                <div id="reportes-resumen" class="stats-grid" style="margin-bottom: 20px;">
                    <!-- Se llena con JS -->
                </div>

                <!-- Tabla de Ventas Filtradas -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Detalle de Operaciones</h2>
                        <div id="reportes-export-actions" class="actions">
                            <button onclick="Reportes.exportExcel()" class="btn btn-outline" style="color: #16a34a; border-color: #16a34a; margin-right: 8px;">
                                <span>&#128196;</span> Excel
                            </button>
                            <button onclick="Reportes.exportPdf()" class="btn btn-outline" style="color: #e11d48; border-color: #e11d48;">
                                <span>&#128147;</span> PDF
                            </button>
                        </div>
                    </div>
                    <div class="table-container" id="reportes-table">
                        <div class="empty-state">
                            <p>Presiona "Generar" para ver los resultados.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async afterRender() {
        // Asegurarse de tener la tasa del dólar más reciente antes de cargar
        await App.loadTasaDolar();
        // Cargar por defecto los datos del día actual
        await this.load();
    },

    async load(event) {
        if (event) event.preventDefault();

        const fecha_inicio = document.getElementById('rep-fecha-inicio').value;
        const fecha_fin = document.getElementById('rep-fecha-fin').value;
        const metodo_pago = document.getElementById('rep-metodo').value;
        const tipo_venta = document.getElementById('rep-tipo').value;

        const tableContainer = document.getElementById('reportes-table');
        tableContainer.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <p>Generando reporte detallado...</p>
            </div>
        `;

        try {
            const params = {};
            if (fecha_inicio) params.fecha_inicio = fecha_inicio;
            if (fecha_fin) params.fecha_fin = fecha_fin;
            if (metodo_pago) params.metodo_pago = metodo_pago;
            if (tipo_venta) params.tipo_venta = tipo_venta;

            const response = await api.getReporteCierre(params);
            this.data = response; // Guarda el JSON de respuesta

            this.renderResumen();
            this.renderTabla();
        } catch (error) {
            console.error(error);
            tableContainer.innerHTML = `<div class="alert alert-error">Error al cargar: ${error.message}</div>`;
        }
    },

    renderResumen() {
        const resumenDiv = document.getElementById('reportes-resumen');
        if (!this.data || !this.data.resumen) {
            resumenDiv.innerHTML = '';
            return;
        }

        const res = this.data.resumen;
        const totalGeneralBs = App.aBs(res.total_general);

        // Tarjeta principal (Total)
        let html = `
            <div class="stat-card stat-wide animate-scale-in" style="border: 2px solid var(--primary); background: rgba(225,29,72,0.05); animation-delay: 0.1s;">
                <div class="stat-label">Total Recaudado (Filtrado)</div>
                <div class="stat-value">$${res.total_general.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
                <div class="stat-subvalue">${totalGeneralBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</div>
            </div>
        `;

        // Tarjetas por método de pago
        let delay = 0.2;
        for (const [metodo, total] of Object.entries(res.por_metodo)) {
            const metName = metodo === 'SIN_METODO' ? 'Por Cobrar' : metodo.replace('_', ' ');
            const bsEquiv = App.aBs(total);
            html += `
                <div class="stat-card animate-scale-in" style="animation-delay: ${delay}s;">
                    <div class="stat-label">Total en ${metName}</div>
                    <div class="stat-value">$${total.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
                    <div class="stat-subvalue">${bsEquiv.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</div>
                </div>
            `;
            delay += 0.05;
        }

        resumenDiv.innerHTML = html;
    },

    renderTabla() {
        const tableContainer = document.getElementById('reportes-table');
        if (!this.data || !this.data.ventas || this.data.ventas.length === 0) {
            tableContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128196;</div>
                    <p>No se encontraron registros para los filtros seleccionados.</p>
                </div>
            `;
            return;
        }

        const ventas = this.data.ventas;
        const tasa = App.tasaDolar.tasa || 1;

        tableContainer.innerHTML = `
            <table class="animate-fade-in" style="animation-delay: 0.4s;">
                <thead>
                    <tr>
                        <th>ID Venta</th>
                        <th>Fecha y Hora</th>
                        <th>Cliente</th>
                        <th>Cajero</th>
                        <th>Método Pago</th>
                        <th>Tipo</th>
                        <th class="text-right">Total ($)</th>
                        <th class="text-right">Total (Bs)</th>
                    </tr>
                </thead>
                <tbody>
                    ${ventas.map(v => {
                        const dateObj = new Date(v.created_at);
                        const bs = v.total * tasa;
                        
                        let badgeTipo = 'info';
                        if (v.tipo_venta === 'FIADO') badgeTipo = 'warning';
                        if (v.tipo_venta === 'NORMAL') badgeTipo = 'success';

                        return `
                            <tr>
                                <td><strong>#${v.id}</strong></td>
                                <td>${dateObj.toLocaleDateString('es-VE')} ${dateObj.toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit'})}</td>
                                <td>${v.cliente_nombre ? escapeHtml(v.cliente_nombre) : 'Consumidor Final'}</td>
                                <td>${escapeHtml(v.vendedor_nombre)}</td>
                                <td>${v.metodo_pago ? escapeHtml(v.metodo_pago.replace('_', ' ')) : '-'}</td>
                                <td><span class="badge badge-${badgeTipo}">${v.tipo_venta}</span></td>
                                <td class="text-right" style="font-weight: 600;">$${v.total.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                                <td class="text-right text-muted">${bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    exportExcel() {
        const fecha_inicio = document.getElementById('rep-fecha-inicio').value;
        const fecha_fin = document.getElementById('rep-fecha-fin').value;
        const metodo_pago = document.getElementById('rep-metodo').value;
        const tipo_venta = document.getElementById('rep-tipo').value;
        const token = localStorage.getItem('token');

        const params = new URLSearchParams();
        if (fecha_inicio) params.append('fecha_inicio', fecha_inicio);
        if (fecha_fin) params.append('fecha_fin', fecha_fin);
        if (metodo_pago) params.append('metodo_pago', metodo_pago);
        if (tipo_venta) params.append('tipo_venta', tipo_venta);
        if (token) params.append('token', token); // Pasar token para auth en descarga directa

        window.open(`/api/reportes/excel?${params.toString()}`, '_blank');
    },

    exportPdf() {
        const fecha_inicio = document.getElementById('rep-fecha-inicio').value;
        const fecha_fin = document.getElementById('rep-fecha-fin').value;
        const metodo_pago = document.getElementById('rep-metodo').value;
        const tipo_venta = document.getElementById('rep-tipo').value;
        const token = localStorage.getItem('token');

        const params = new URLSearchParams();
        if (fecha_inicio) params.append('fecha_inicio', fecha_inicio);
        if (fecha_fin) params.append('fecha_fin', fecha_fin);
        if (metodo_pago) params.append('metodo_pago', metodo_pago);
        if (tipo_venta) params.append('tipo_venta', tipo_venta);
        if (token) params.append('token', token);

        window.open(`/api/reportes/pdf?${params.toString()}`, '_blank');
    }
};
