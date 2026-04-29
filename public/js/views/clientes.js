const Clientes = {
    clientes: [],

    render() {
        return `
            <div class="container">
                <div class="page-header">
                    <h1 class="page-title">Clientes</h1>
                    <p class="page-subtitle">Gestión de Clientes y Deudores</p>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Directorio de clientes</h2>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-outline" onclick="Clientes.exportExcel()" style="border-color: #10b981; color: #10b981;">📊 Excel</button>
                            <button class="btn btn-primary" onclick="Clientes.openModal()">+ Nuevo Cliente</button>
                        </div>
                    </div>
                    
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Teléfono</th>
                                    <th>Deuda Pendiente</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="clientes-table-body">
                                <tr><td colspan="4" style="text-align:center;">Cargando clientes...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <!-- Modal Formulario Cliente -->
            <div id="cliente-modal" class="modal-overlay hidden" onclick="Clientes.closeModal()">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 id="modal-title" class="modal-title">Nuevo Cliente</h3>
                        <button class="modal-close" onclick="Clientes.closeModal()">&times;</button>
                    </div>
                    <form id="cliente-form" onsubmit="Clientes.handleSubmit(event)">
                        <input type="hidden" id="cliente-id">
                        
                        <div class="form-group">
                            <label class="form-label" for="cliente-nombre">Nombre / Razón Social *</label>
                            <input type="text" id="cliente-nombre" class="form-input" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="cliente-telefono">Teléfono</label>
                            <input type="text" id="cliente-telefono" class="form-input">
                        </div>

                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="Clientes.closeModal()">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
            <!-- Modal Abono -->
            <div id="abono-modal" class="modal-overlay hidden" onclick="Clientes.closeAbonoModal()">
                <div class="modal" style="max-width: 400px;" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">Registrar Abono</h3>
                        <button class="modal-close" onclick="Clientes.closeAbonoModal()">&times;</button>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <p>Cliente: <strong id="abono-cliente-nombre"></strong></p>
                        <p>Deuda actual: <strong id="abono-deuda-actual" class="text-danger"></strong></p>
                    </div>
                    
                    <form id="abono-form" onsubmit="Clientes.handleAbonoSubmit(event)">
                        <input type="hidden" id="abono-cliente-id">
                        
                        <div class="form-group">
                            <label class="form-label" for="abono-monto">Monto a abonar ($) *</label>
                            <input type="number" id="abono-monto" class="form-input" step="0.01" min="0.01" required>
                        </div>

                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="Clientes.closeAbonoModal()">Cancelar</button>
                            <button type="submit" class="btn btn-success">Registrar Pago</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    async afterRender() {
        await this.loadClientes();
    },

    async loadClientes() {
        try {
            const data = await apiFetch('/clientes');
            this.clientes = data || [];
            this.renderTable();
        } catch (error) {
            console.error('Error cargando clientes:', error);
            document.getElementById('clientes-table-body').innerHTML = `
                <tr><td colspan="4" style="text-align:center;color:var(--danger)">Error al cargar datos</td></tr>
            `;
        }
    },

    // Escapar HTML para prevenir XSS (Problema resuelto en auditoría)
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    renderTable() {
        const tbody = document.getElementById('clientes-table-body');
        
        if (this.clientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay clientes registrados</td></tr>';
            return;
        }

        tbody.innerHTML = this.clientes.map(c => {
            const esDeudor = c.saldo_deuda > 0;
            const deudaBadge = esDeudor 
                ? `<span class="badge" style="background:var(--danger)">${App.formatMonto(c.saldo_deuda)}</span>`
                : `<span class="badge" style="background:var(--success)">Sin deuda</span>`;

            return `
            <tr>
                <td><strong>${this.escapeHtml(c.nombre)}</strong></td>
                <td>${this.escapeHtml(c.telefono) || '-'}</td>
                <td>${deudaBadge}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="Clientes.openModal(${c.id})" title="Editar">Editar</button>
                    <button class="btn btn-sm btn-outline" style="color:#e11d48; border-color:#e11d48;" onclick="Clientes.exportPdf(${c.id})" title="Estado de Cuenta PDF">PDF</button>
                    ${esDeudor ? `<button class="btn btn-sm btn-success" onclick="Clientes.openAbonoModal(${c.id})">Abonar</button>` : ''}
                    ${!esDeudor ? `<button class="btn btn-sm btn-danger" onclick="Clientes.deleteCliente(${c.id})">Eliminar</button>` : ''}
                </td>
            </tr>
        `}).join('');
    },

    openModal(id = null) {
        const modal = document.getElementById('cliente-modal');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('cliente-form');
        
        form.reset();
        
        if (id) {
            const cliente = this.clientes.find(c => c.id === id);
            if (cliente) {
                title.textContent = 'Editar Cliente';
                document.getElementById('cliente-id').value = cliente.id;
                document.getElementById('cliente-nombre').value = cliente.nombre;
                document.getElementById('cliente-telefono').value = cliente.telefono || '';
            }
        } else {
            title.textContent = 'Nuevo Cliente';
            document.getElementById('cliente-id').value = '';
        }
        modal.classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('cliente-modal').classList.add('hidden');
    },

    openAbonoModal(id) {
        const cliente = this.clientes.find(c => c.id === id);
        if (!cliente) return;

        document.getElementById('abono-cliente-id').value = cliente.id;
        document.getElementById('abono-cliente-nombre').textContent = cliente.nombre;
        document.getElementById('abono-deuda-actual').textContent = App.formatMonto(cliente.saldo_deuda);
        document.getElementById('abono-monto').value = '';
        document.getElementById('abono-monto').max = cliente.saldo_deuda;

        document.getElementById('abono-modal').classList.remove('hidden');
    },

    closeAbonoModal() {
        document.getElementById('abono-modal').classList.add('hidden');
    },

    async handleSubmit(event) {
        event.preventDefault();
        
        const id = document.getElementById('cliente-id').value;
        const data = {
            nombre: document.getElementById('cliente-nombre').value,
            telefono: document.getElementById('cliente-telefono').value
        };

        try {
            if (id) {
                await apiFetch(`/clientes/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
            } else {
                await apiFetch('/clientes', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
            }
            
            this.closeModal();
            this.loadClientes();
        } catch (error) {
            alert('Error al guardar: ' + error.message);
        }
    },

    async handleAbonoSubmit(event) {
        event.preventDefault();
        
        const id = document.getElementById('abono-cliente-id').value;
        const monto = parseFloat(document.getElementById('abono-monto').value);

        if (!id || isNaN(monto) || monto <= 0) {
            alert('Monto inválido');
            return;
        }

        try {
            await apiFetch(`/clientes/${id}/abono`, {
                method: 'POST',
                body: JSON.stringify({ monto })
            });
            
            this.closeAbonoModal();
            this.loadClientes(); // Recargar para ver el saldo nuevo
        } catch (error) {
            alert('Error al procesar abono: ' + error.message);
        }
    },

    async deleteCliente(id) {
        if (!confirm('¿Está seguro de eliminar este cliente?')) return;

        try {
            await apiFetch(`/clientes/${id}`, { method: 'DELETE' });
            this.loadClientes();
        } catch (error) {
            alert('Error al eliminar: ' + error.message);
        }
    },

    exportPdf(id) {
        const token = localStorage.getItem('token');
        if (!token) return;
        window.open(`/api/clientes/${id}/pdf?token=${token}`, '_blank');
    },

    exportExcel() {
        const token = localStorage.getItem('token');
        if (!token) return;
        window.open(`/api/clientes/export/excel?token=${token}`, '_blank');
    }
};

