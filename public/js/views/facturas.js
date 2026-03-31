// Facturas View — List + Upload (no edit/delete, inmutable)

const Facturas = {
    data: [],
    proveedores: [],

    render() {
        return `
            <div class="container">
                <div class="page-header">
                    <h1 class="page-title">Facturas</h1>
                    <p class="page-subtitle">Facturas y recibos de proveedores</p>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Facturas registradas</h2>
                        <button class="btn btn-primary" onclick="Facturas.openModal()">+ Subir factura</button>
                    </div>
                    <div id="facturas-filters" class="form-row" style="margin-bottom:16px">
                        <div class="form-group" style="margin-bottom:0">
                            <select id="filtro-proveedor" class="form-select" onchange="Facturas.load()">
                                <option value="">Todos los proveedores</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:0">
                            <span id="facturas-total" style="font-weight:600;color:var(--gray-700)"></span>
                        </div>
                    </div>
                    <div class="table-container" id="facturas-table">
                        <div class="loading">Cargando...</div>
                    </div>
                </div>
            </div>
            <div id="facturas-modal" class="hidden"></div>
        `;
    },

    async afterRender() {
        try {
            const provData = await api.getProveedores();
            this.proveedores = provData.proveedores;
            this.populateFilters();
        } catch (e) { /* ignore */ }
        await this.load();
    },

    populateFilters() {
        const select = document.getElementById('filtro-proveedor');
        if (!select) return;
        select.innerHTML = '<option value="">Todos los proveedores</option>' +
            this.proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    },

    async load() {
        try {
            const params = {};
            const proveedor = document.getElementById('filtro-proveedor')?.value;
            if (proveedor) params.proveedor_id = proveedor;

            const data = await api.getFacturas(params);
            this.data = data.facturas;
            this.renderTable();
        } catch (error) {
            document.getElementById('facturas-table').innerHTML = `
                <div class="alert alert-error">Error: ${error.message}</div>
            `;
        }
    },

    renderTable() {
        if (this.data.length === 0) {
            document.getElementById('facturas-table').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128196;</div>
                    <p>No hay facturas registradas</p>
                </div>
            `;
            document.getElementById('facturas-total').textContent = '';
            return;
        }

        // Calculate total
        const total = this.data.reduce((sum, f) => sum + (f.monto_total || 0), 0);
        document.getElementById('facturas-total').textContent = `Total: $${total.toLocaleString('es-AR')}`;

        document.getElementById('facturas-table').innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Nro. Factura</th>
                        <th>Proveedor</th>
                        <th>Monto</th>
                        <th>Archivo</th>
                        <th>Subido por</th>
                        <th class="text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.data.map(f => `
                        <tr>
                            <td>${f.fecha_factura || new Date(f.created_at).toLocaleDateString('es-AR')}</td>
                            <td><strong>${f.numero_factura || '-'}</strong></td>
                            <td>${f.proveedor_nombre || '-'}</td>
                            <td>${f.monto_total ? '$' + f.monto_total.toLocaleString('es-AR') : '-'}</td>
                            <td>
                                <span class="badge badge-info">${f.archivo_tipo}</span>
                            </td>
                            <td>${f.usuario_nombre || '-'}</td>
                            <td class="text-right">
                                <div class="actions" style="justify-content:flex-end">
                                    <button class="btn btn-sm btn-outline" onclick="Facturas.view(${f.id})">Ver</button>
                                    <button class="btn btn-sm btn-primary" onclick="Facturas.download(${f.id}, '${f.archivo_nombre_original}')">Descargar</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    openModal() {
        const provOptions = this.proveedores.map(p =>
            `<option value="${p.id}">${p.nombre}</option>`
        ).join('');

        document.getElementById('facturas-modal').innerHTML = `
            <div class="modal-overlay" onclick="Facturas.closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">Subir factura</h3>
                        <button class="modal-close" onclick="Facturas.closeModal()">&times;</button>
                    </div>
                    <form id="factura-form" onsubmit="Facturas.save(event)">
                        <div class="form-group">
                            <label class="form-label">Archivo *</label>
                            <input type="file" id="fac-archivo" class="form-input" accept=".jpg,.jpeg,.png,.webp,.pdf" required>
                            <div class="form-label mt-2" style="color:var(--gray-500);font-size:0.8rem">JPEG, PNG, WebP o PDF. Máximo 10 MB.</div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Proveedor</label>
                                <select id="fac-proveedor" class="form-select">
                                    <option value="">Sin proveedor</option>
                                    ${provOptions}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Número de factura</label>
                                <input type="text" id="fac-numero" class="form-input" placeholder="Ej: FAC-001">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Monto total</label>
                                <input type="number" id="fac-monto" class="form-input" step="0.01" min="0" placeholder="0.00">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Fecha de factura</label>
                                <input type="date" id="fac-fecha" class="form-input">
                            </div>
                        </div>
                        <div id="fac-error" class="alert alert-error hidden"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="Facturas.closeModal()">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Subir factura</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('facturas-modal').classList.remove('hidden');
    },

    closeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        document.getElementById('facturas-modal').classList.add('hidden');
    },

    async save(event) {
        event.preventDefault();
        const fileInput = document.getElementById('fac-archivo');
        const errorDiv = document.getElementById('fac-error');

        if (!fileInput.files || !fileInput.files[0]) {
            errorDiv.textContent = 'Debe seleccionar un archivo';
            errorDiv.classList.remove('hidden');
            return;
        }

        const formData = new FormData();
        formData.append('archivo', fileInput.files[0]);

        const proveedor = document.getElementById('fac-proveedor').value;
        const numero = document.getElementById('fac-numero').value.trim();
        const monto = document.getElementById('fac-monto').value;
        const fecha = document.getElementById('fac-fecha').value;

        if (proveedor) formData.append('proveedor_id', proveedor);
        if (numero) formData.append('numero_factura', numero);
        if (monto) formData.append('monto_total', monto);
        if (fecha) formData.append('fecha_factura', fecha);

        try {
            errorDiv.classList.add('hidden');
            await api.uploadFactura(formData);
            this.closeModal();
            await this.load();
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        }
    },

    // View file in new tab (with auth)
    async view(id) {
        try {
            const token = getToken();
            const response = await fetch(`/api/facturas/${id}/archivo`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al obtener archivo');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            alert(error.message);
        }
    },

    // Download file (with auth)
    async download(id, filename) {
        try {
            const token = getToken();
            const response = await fetch(`/api/facturas/${id}/archivo`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al descargar archivo');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'factura';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            alert(error.message);
        }
    }
};
