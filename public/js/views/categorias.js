// Categorías View — Full CRUD with modal

const Categorias = {
    data: [],

    render() {
        const isAdminUser = isAdmin();
        return `
            <div class="container">
                <div class="page-header">
                    <h1 class="page-title">Categorías</h1>
                    <p class="page-subtitle">Gestión de categorías de productos</p>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Lista de categorías</h2>
                        ${isAdminUser ? '<button class="btn btn-primary" onclick="Categorias.openModal()">+ Nueva categoría</button>' : ''}
                    </div>
                    <div class="table-container" id="categorias-table">
                        <div class="loading">Cargando...</div>
                    </div>
                </div>
            </div>
            <div id="categorias-modal" class="hidden"></div>
        `;
    },

    async afterRender() {
        await this.load();
    },

    async load() {
        try {
            const data = await api.getCategorias();
            this.data = data.categorias;
            this.renderTable();
        } catch (error) {
            document.getElementById('categorias-table').innerHTML = `
                <div class="alert alert-error">Error: ${error.message}</div>
            `;
        }
    },

    renderTable() {
        if (this.data.length === 0) {
            document.getElementById('categorias-table').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128451;</div>
                    <p>No hay categorías registradas</p>
                </div>
            `;
            return;
        }

        const isAdminUser = isAdmin();
        document.getElementById('categorias-table').innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Descripción</th>
                        ${isAdminUser ? '<th class="text-right">Acciones</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${this.data.map(c => `
                        <tr>
                            <td>${c.id}</td>
                            <td><strong>${escapeHtml(c.nombre)}</strong></td>
                            <td>${escapeHtml(c.descripcion)}</td>
                            ${isAdminUser ? `
                                <td class="text-right">
                                    <div class="actions" style="justify-content:flex-end">
                                        <button class="btn btn-sm btn-outline" onclick="Categorias.openModal(${c.id})">Editar</button>
                                        <button class="btn btn-sm btn-danger" onclick="Categorias.delete(${c.id})">Eliminar</button>
                                    </div>
                                </td>
                            ` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    openModal(id = null) {
        const cat = id ? this.data.find(c => c.id === id) : null;
        const title = cat ? 'Editar categoría' : 'Nueva categoría';

        document.getElementById('categorias-modal').innerHTML = `
            <div class="modal-overlay" onclick="Categorias.closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close" onclick="Categorias.closeModal()">&times;</button>
                    </div>
                    <form id="categoria-form" onsubmit="Categorias.save(event, ${id || 'null'})">
                        <div class="form-group">
                            <label class="form-label">Nombre *</label>
                            <input type="text" id="cat-nombre" class="form-input" value="${cat ? cat.nombre : ''}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Descripción</label>
                            <input type="text" id="cat-descripcion" class="form-input" value="${cat ? (cat.descripcion || '') : ''}">
                        </div>
                        <div id="cat-error" class="alert alert-error hidden"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="Categorias.closeModal()">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('categorias-modal').classList.remove('hidden');
    },

    closeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        document.getElementById('categorias-modal').classList.add('hidden');
    },

    async save(event, id) {
        event.preventDefault();
        const nombre = document.getElementById('cat-nombre').value.trim();
        const descripcion = document.getElementById('cat-descripcion').value.trim();
        const errorDiv = document.getElementById('cat-error');

        try {
            errorDiv.classList.add('hidden');
            const data = { nombre };
            if (descripcion) data.descripcion = descripcion;

            if (id) {
                await api.updateCategoria(id, data);
            } else {
                await api.createCategoria(data);
            }

            this.closeModal();
            await this.load();
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        }
    },

    async delete(id) {
        const cat = this.data.find(c => c.id === id);
        const nombre = cat ? cat.nombre : 'esta categoría';
        if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return;
        try {
            await api.deleteCategoria(id);
            await this.load();
        } catch (error) {
            alert(error.message);
        }
    }
};
