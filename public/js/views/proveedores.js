// Proveedores View — Full CRUD with modal

const Proveedores = {
    data: [],

    render() {
        return `
            <div class="container">
                <div class="page-header">
                    <h1 class="page-title">Proveedores</h1>
                    <p class="page-subtitle">Gestión de proveedores</p>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Lista de proveedores</h2>
                        <button class="btn btn-primary" onclick="Proveedores.openModal()">+ Nuevo proveedor</button>
                    </div>
                    <div class="table-container" id="proveedores-table">
                        <div class="loading">Cargando...</div>
                    </div>
                </div>
            </div>
            <div id="proveedores-modal" class="hidden"></div>
        `;
    },

    async afterRender() {
        await this.load();
    },

    async load() {
        try {
            const data = await api.getProveedores();
            this.data = data.proveedores;
            this.renderTable();
        } catch (error) {
            document.getElementById('proveedores-table').innerHTML = `
                <div class="alert alert-error">Error: ${error.message}</div>
            `;
        }
    },

    renderTable() {
        if (this.data.length === 0) {
            document.getElementById('proveedores-table').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128101;</div>
                    <p>No hay proveedores registrados</p>
                </div>
            `;
            return;
        }

        document.getElementById('proveedores-table').innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Contacto</th>
                        <th>Teléfono</th>
                        <th>Email</th>
                        <th class="text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.data.map(p => `
                        <tr>
                            <td>${p.id}</td>
                            <td><strong>${p.nombre}</strong></td>
                            <td>${p.contacto || '-'}</td>
                            <td>${p.telefono || '-'}</td>
                            <td>${p.email || '-'}</td>
                            <td class="text-right">
                                <div class="actions" style="justify-content:flex-end">
                                    <button class="btn btn-sm btn-outline" onclick="Proveedores.openModal(${p.id})">Editar</button>
                                    <button class="btn btn-sm btn-danger" onclick="Proveedores.delete(${p.id}, '${p.nombre}')">Eliminar</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    openModal(id = null) {
        const prov = id ? this.data.find(p => p.id === id) : null;
        const title = prov ? 'Editar proveedor' : 'Nuevo proveedor';

        document.getElementById('proveedores-modal').innerHTML = `
            <div class="modal-overlay" onclick="Proveedores.closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close" onclick="Proveedores.closeModal()">&times;</button>
                    </div>
                    <form id="proveedor-form" onsubmit="Proveedores.save(event, ${id || 'null'})">
                        <div class="form-group">
                            <label class="form-label">Nombre *</label>
                            <input type="text" id="prov-nombre" class="form-input" value="${prov ? prov.nombre : ''}" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Contacto</label>
                                <input type="text" id="prov-contacto" class="form-input" value="${prov ? (prov.contacto || '') : ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Teléfono</label>
                                <input type="text" id="prov-telefono" class="form-input" value="${prov ? (prov.telefono || '') : ''}">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" id="prov-email" class="form-input" value="${prov ? (prov.email || '') : ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Dirección</label>
                                <input type="text" id="prov-direccion" class="form-input" value="${prov ? (prov.direccion || '') : ''}">
                            </div>
                        </div>
                        <div id="prov-error" class="alert alert-error hidden"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="Proveedores.closeModal()">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('proveedores-modal').classList.remove('hidden');
    },

    closeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        document.getElementById('proveedores-modal').classList.add('hidden');
    },

    async save(event, id) {
        event.preventDefault();
        const data = {
            nombre: document.getElementById('prov-nombre').value.trim(),
            contacto: document.getElementById('prov-contacto').value.trim() || undefined,
            telefono: document.getElementById('prov-telefono').value.trim() || undefined,
            email: document.getElementById('prov-email').value.trim() || undefined,
            direccion: document.getElementById('prov-direccion').value.trim() || undefined
        };
        const errorDiv = document.getElementById('prov-error');

        try {
            errorDiv.classList.add('hidden');
            if (id) {
                await api.updateProveedor(id, data);
            } else {
                await api.createProveedor(data);
            }
            this.closeModal();
            await this.load();
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        }
    },

    async delete(id, nombre) {
        if (!confirm(`¿Eliminar el proveedor "${nombre}"?`)) return;
        try {
            await api.deleteProveedor(id);
            await this.load();
        } catch (error) {
            alert(error.message);
        }
    }
};
