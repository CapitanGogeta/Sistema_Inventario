// Facturas View — List + Upload (no edit/delete, inmutable)

const Facturas = {
    data: [],
    proveedores: [],

    render() {
        const isAdminUser = isAdmin();
        return `
            <div class="container">
                <div class="page-header">
                    <h1 class="page-title">Facturas</h1>
                    <p class="page-subtitle">Facturas y recibos de proveedores</p>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Facturas registradas</h2>
                        ${isAdminUser ? '<button class="btn btn-primary" onclick="Facturas.openModal()">+ Subir factura</button>' : ''}
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

        const isAdminUser = isAdmin();
        // Calculate total
        const total = this.data.reduce((sum, f) => sum + (f.monto_total || 0), 0);
        const tasa = App.tasaDolar.tasa || 0;
        const totalBs = total * tasa;
        document.getElementById('facturas-total').innerHTML = `
            <span class="price-cell" style="flex-direction:row;gap:8px">
                <span>Total: $${total.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                <span class="price-bs">/ ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</span>
            </span>
        `;

        document.getElementById('facturas-table').innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Nro. Factura</th>
                        <th>Proveedor</th>
                        <th>Monto</th>
                        <th>Archivo</th>
                        ${isAdminUser ? '<th>Subido por</th>' : ''}
                        ${isAdminUser ? '<th class="text-right">Acciones</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${this.data.map(f => {
                        const bs = (f.monto_total || 0) * tasa;
                        return `
                            <tr>
                                <td>${f.fecha_factura || new Date(f.created_at).toLocaleDateString('es-VE')}</td>
                                <td><strong>${escapeHtml(f.numero_factura)}</strong></td>
                                <td>${escapeHtml(f.proveedor_nombre)}</td>
                                <td>
                                    ${f.monto_total ? `
                                        <div class="price-cell">
                                            <span class="price-usd">$${f.monto_total.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                                            <span class="price-bs">${bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</span>
                                        </div>
                                    ` : '-'}
                                </td>
                                <td>
                                    <span class="badge badge-info">${f.archivo_tipo}</span>
                                </td>
                                ${isAdminUser ? `<td>${f.usuario_nombre || '-'}</td>` : ''}
                                ${isAdminUser ? `
                                    <td class="text-right">
                                        <div class="actions" style="justify-content:flex-end">
                                            <button class="btn btn-sm btn-outline" onclick="Facturas.view(${f.id})">Ver</button>
                                            <button class="btn btn-sm btn-primary" onclick="Facturas.download(${f.id}, '${f.archivo_nombre_original}')">Descargar</button>
                                        </div>
                                    </td>
                                ` : ''}
                            </tr>
                        `;
                    }).join('')}
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
                            <label class="form-label">Archivo de la Factura *</label>
                            <div class="file-upload-wrapper">
                                <label for="fac-archivo" class="file-upload-label">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px; color: var(--primary);">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="17 8 12 3 7 8"></polyline>
                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                    <span id="file-name-display" style="font-weight: 500; color: var(--text-main); font-size: 1rem;">Haz clic para seleccionar o arrastra el archivo aquí</span>
                                    <span style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">Admite JPEG, PNG, WebP o PDF. Máx 10 MB.</span>
                                </label>
                                <input type="file" id="fac-archivo" class="hidden-file-input" accept=".jpg,.jpeg,.png,.webp,.pdf" required onchange="document.getElementById('file-name-display').textContent = this.files[0] ? this.files[0].name : 'Haz clic para seleccionar o arrastra el archivo aquí'">
                            </div>
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
