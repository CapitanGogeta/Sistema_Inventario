// Movimientos View — List + Create, grouped by week

const Movimientos = {
    data: [],
    productos: [],

    // Helper: Get Monday of a given date
    getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    },

    // Helper: Get week key (Monday date as string)
    getWeekKey(dateStr) {
        const d = new Date(dateStr);
        const monday = this.getMonday(d);
        monday.setHours(0, 0, 0, 0);
        return monday.toISOString().split('T')[0];
    },

    // Helper: Get week label "Semana del 24/03 al 30/03"
    getWeekLabel(mondayStr) {
        const monday = new Date(mondayStr + 'T00:00:00');
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        const format = (d) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
        return `Semana del ${format(monday)} al ${format(sunday)}`;
    },

    // Helper: Group movements by week
    groupByWeek(movements) {
        const groups = {};
        movements.forEach(m => {
            const key = this.getWeekKey(m.created_at);
            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        });
        // Sort weeks descending (newest first)
        return Object.keys(groups)
            .sort((a, b) => b.localeCompare(a))
            .map(key => ({ key, label: this.getWeekLabel(key), movements: groups[key] }));
    },

    // Helper: Get available weeks for dropdown
    getAvailableWeeks() {
        const weeks = new Set();
        this.data.forEach(m => weeks.add(this.getWeekKey(m.created_at)));
        return Array.from(weeks).sort((a, b) => b.localeCompare(a));
    },

    render() {
        return `
            <div class="container">
                <div class="page-header">
                    <h1 class="page-title">Movimientos</h1>
                    <p class="page-subtitle">Entradas, salidas y ajustes de stock</p>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Historial de movimientos</h2>
                        <button class="btn btn-success" onclick="Movimientos.openModal()">+ Nuevo movimiento</button>
                    </div>
                    <div id="movimientos-filters" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
                        <div class="form-group" style="margin-bottom:0">
                            <select id="filtro-semana" class="form-select" onchange="Movimientos.renderTable()">
                                <option value="">Todas las semanas</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:0">
                            <select id="filtro-tipo" class="form-select" onchange="Movimientos.renderTable()">
                                <option value="">Todos los tipos</option>
                                <option value="ENTRADA">Entrada</option>
                                <option value="SALIDA">Salida</option>
                                <option value="AJUSTE">Ajuste</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:0">
                            <select id="filtro-producto" class="form-select" onchange="Movimientos.renderTable()">
                                <option value="">Todos los productos</option>
                            </select>
                        </div>
                    </div>
                    <div class="table-container" id="movimientos-table">
                        <div class="loading">Cargando...</div>
                    </div>
                </div>
            </div>
            <div id="movimientos-modal" class="hidden"></div>
        `;
    },

    async afterRender() {
        try {
            const prodData = await api.getProductos();
            this.productos = prodData.productos;
            this.populateProductFilter();
        } catch (e) { /* ignore */ }
        await this.load();
    },

    populateProductFilter() {
        const select = document.getElementById('filtro-producto');
        if (!select) return;
        select.innerHTML = '<option value="">Todos los productos</option>' +
            this.productos.map(p => `<option value="${p.id}">${p.nombre} (${p.codigo || 'sin código'})</option>`).join('');
    },

    populateWeekFilter() {
        const select = document.getElementById('filtro-semana');
        if (!select) return;
        const weeks = this.getAvailableWeeks();
        select.innerHTML = '<option value="">Todas las semanas</option>' +
            weeks.map(w => `<option value="${w}">${this.getWeekLabel(w)}</option>`).join('');

        // Default to current week
        const currentWeek = this.getWeekKey(new Date().toISOString());
        if (weeks.includes(currentWeek)) {
            select.value = currentWeek;
        }
    },

    async load() {
        try {
            const data = await api.getMovimientos({ limit: 500 });
            this.data = data.movimientos;
            this.populateWeekFilter();
            this.renderTable();
        } catch (error) {
            document.getElementById('movimientos-table').innerHTML = `
                <div class="alert alert-error">Error: ${error.message}</div>
            `;
        }
    },

    getFilteredMovements() {
        const semanaFiltro = document.getElementById('filtro-semana')?.value;
        const tipoFiltro = document.getElementById('filtro-tipo')?.value;
        const productoFiltro = document.getElementById('filtro-producto')?.value;

        return this.data.filter(m => {
            if (semanaFiltro && this.getWeekKey(m.created_at) !== semanaFiltro) return false;
            if (tipoFiltro && m.tipo !== tipoFiltro) return false;
            if (productoFiltro && m.producto_id !== parseInt(productoFiltro)) return false;
            return true;
        });
    },

    renderTable() {
        const filtered = this.getFilteredMovements();

        if (filtered.length === 0) {
            document.getElementById('movimientos-table').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128203;</div>
                    <p>No hay movimientos para los filtros seleccionados</p>
                </div>
            `;
            return;
        }

        // If filtering by specific week, show flat table
        const semanaFiltro = document.getElementById('filtro-semana')?.value;
        if (semanaFiltro) {
            document.getElementById('movimientos-table').innerHTML = this.renderFlatTable(filtered);
            return;
        }

        // Otherwise, group by week
        const groups = this.groupByWeek(filtered);
        let html = '';

        groups.forEach(group => {
            const entradas = group.movements.filter(m => m.tipo === 'ENTRADA').length;
            const salidas = group.movements.filter(m => m.tipo === 'SALIDA').length;

            html += `
                <div style="background:var(--gray-100);padding:12px 16px;border-radius:var(--radius);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
                    <strong style="font-size:0.95rem">&#128197; ${escapeHtml(group.label)}</strong>
                    <div style="display:flex;gap:8px">
                        <span class="badge badge-success">${entradas} entradas</span>
                        <span class="badge badge-danger">${salidas} salidas</span>
                        <span class="badge badge-info">${group.movements.length} total</span>
                    </div>
                </div>
                ${this.renderFlatTable(group.movements)}
            `;
        });

        document.getElementById('movimientos-table').innerHTML = html;
    },

    renderFlatTable(movements) {
        return `
            <table style="margin-bottom:24px">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Producto</th>
                        <th>Tipo</th>
                        <th>Cantidad</th>
                        <th>Motivo</th>
                        <th>Notas</th>
                        <th>Usuario</th>
                    </tr>
                </thead>
                <tbody>
                    ${movements.map(m => {
                        const badgeClass = m.tipo === 'ENTRADA' ? 'badge-success' : m.tipo === 'SALIDA' ? 'badge-danger' : 'badge-info';
                        const sign = m.tipo === 'ENTRADA' ? '+' : m.tipo === 'SALIDA' ? '-' : '=';
                        return `
                            <tr>
                                <td>${new Date(m.created_at).toLocaleString('es-AR')}</td>
                                <td><strong>${escapeHtml(m.producto_nombre)}</strong><br><code>${escapeHtml(m.producto_codigo)}</code></td>
                                <td><span class="badge ${badgeClass}">${m.tipo}</span></td>
                                <td><strong>${sign}${m.cantidad}</strong></td>
                                <td>${escapeHtml(m.motivo)}</td>
                                <td>
                                    ${m.notas ? `<button class="btn btn-sm btn-outline" onclick="Movimientos.openDetail(${m.id})">&#128196; Ver</button>` : '<span style="color:var(--gray-300)">-</span>'}
                                </td>
                                <td>${m.usuario_nombre || '-'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    openModal() {
        const prodOptions = this.productos.map(p =>
            `<option value="${p.id}">${p.nombre} (Stock: ${p.stock_actual})</option>`
        ).join('');

        document.getElementById('movimientos-modal').innerHTML = `
            <div class="modal-overlay" onclick="Movimientos.closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">Nuevo movimiento</h3>
                        <button class="modal-close" onclick="Movimientos.closeModal()">&times;</button>
                    </div>
                    <form id="movimiento-form" onsubmit="Movimientos.save(event)">
                        <div class="form-group">
                            <label class="form-label">Producto *</label>
                            <select id="mov-producto" class="form-select" required onchange="Movimientos.updateStockInfo()">
                                <option value="">Seleccionar producto</option>
                                ${prodOptions}
                            </select>
                            <div id="mov-stock-actual" class="form-label mt-2" style="color:var(--gray-500)"></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Tipo *</label>
                                <select id="mov-tipo" class="form-select" required onchange="Movimientos.updateStockInfo()">
                                    <option value="">Seleccionar</option>
                                    <option value="ENTRADA">Entrada (+)</option>
                                    <option value="SALIDA">Salida (-)</option>
                                    <option value="AJUSTE">Ajuste (=)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Cantidad *</label>
                                <input type="number" id="mov-cantidad" class="form-input" min="0.01" step="0.01" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Motivo</label>
                            <input type="text" id="mov-motivo" class="form-input" placeholder="Ej: Compra, Venta, Inventario físico">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Notas</label>
                            <input type="text" id="mov-notas" class="form-input" placeholder="Observaciones adicionales">
                        </div>
                        <div id="mov-error" class="alert alert-error hidden"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="Movimientos.closeModal()">Cancelar</button>
                            <button type="submit" class="btn btn-success">Registrar movimiento</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('movimientos-modal').classList.remove('hidden');
    },

    updateStockInfo() {
        const prodId = document.getElementById('mov-producto')?.value;
        const tipo = document.getElementById('mov-tipo')?.value;
        const infoDiv = document.getElementById('mov-stock-actual');

        if (!prodId || !infoDiv) return;

        const prod = this.productos.find(p => p.id === parseInt(prodId));
        if (prod) {
            let info = `Stock actual: ${prod.stock_actual}`;
            if (tipo === 'SALIDA' && prod.stock_minimo > 0) {
                info += ` | Mínimo: ${prod.stock_minimo}`;
            }
            infoDiv.textContent = info;
        }
    },

    closeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        document.getElementById('movimientos-modal').classList.add('hidden');
    },

    openDetail(id) {
        const m = this.data.find(d => d.id === id);
        if (!m) return;

        const badgeClass = m.tipo === 'ENTRADA' ? 'badge-success' : m.tipo === 'SALIDA' ? 'badge-danger' : 'badge-info';
        const sign = m.tipo === 'ENTRADA' ? '+' : m.tipo === 'SALIDA' ? '-' : '=';

        document.getElementById('movimientos-modal').innerHTML = `
            <div class="modal-overlay" onclick="Movimientos.closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">Detalle del movimiento #${m.id}</h3>
                        <button class="modal-close" onclick="Movimientos.closeModal()">&times;</button>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
                        <div>
                            <div class="form-label">Producto</div>
                            <div><strong>${escapeHtml(m.producto_nombre)}</strong> <code>(${escapeHtml(m.producto_codigo)})</code></div>
                        </div>
                        <div>
                            <div class="form-label">Tipo</div>
                            <div><span class="badge ${badgeClass}">${m.tipo}</span></div>
                        </div>
                        <div>
                            <div class="form-label">Cantidad</div>
                            <div><strong>${sign}${m.cantidad}</strong></div>
                        </div>
                        <div>
                            <div class="form-label">Fecha</div>
                            <div>${new Date(m.created_at).toLocaleString('es-AR')}</div>
                        </div>
                        <div>
                            <div class="form-label">Motivo</div>
                            <div>${escapeHtml(m.motivo) || '<span style="color:var(--gray-400)">Sin motivo</span>'}</div>
                        </div>
                        <div>
                            <div class="form-label">Registrado por</div>
                            <div>${m.usuario_nombre || '-'}</div>
                        </div>
                    </div>
                    ${m.notas ? `
                        <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--radius);padding:16px">
                            <div class="form-label" style="margin-bottom:8px">&#128221; Notas</div>
                            <div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(m.notas)}</div>
                        </div>
                    ` : ''}
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="Movimientos.closeModal()">Cerrar</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('movimientos-modal').classList.remove('hidden');
    },

    async save(event) {
        event.preventDefault();
        const data = {
            producto_id: parseInt(document.getElementById('mov-producto').value),
            tipo: document.getElementById('mov-tipo').value,
            cantidad: parseFloat(document.getElementById('mov-cantidad').value),
            motivo: document.getElementById('mov-motivo').value.trim() || undefined,
            notas: document.getElementById('mov-notas').value.trim() || undefined
        };
        const errorDiv = document.getElementById('mov-error');

        try {
            errorDiv.classList.add('hidden');
            const result = await api.createMovimiento(data);
            this.closeModal();

            // Show success message with stock info
            alert(`Movimiento registrado!\nStock: ${result.stock_anterior} → ${result.stock_nuevo}`);

            // Reload both movimientos and productos (for updated stock)
            const prodData = await api.getProductos();
            this.productos = prodData.productos;
            this.populateProductFilter();
            await this.load();
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        }
    }
};
