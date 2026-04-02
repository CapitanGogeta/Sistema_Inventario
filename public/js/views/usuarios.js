// Usuarios View — Full CRUD with modal

const Usuarios = {
    data: [],

    render() {
        return `
            <div class="container">
                <div class="page-header">
                    <h1 class="page-title">Usuarios</h1>
                    <p class="page-subtitle">Gestión de usuarios del sistema</p>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Lista de usuarios</h2>
                        <button class="btn btn-primary" onclick="Usuarios.openModal()">+ Nuevo usuario</button>
                    </div>
                    <div class="table-container" id="usuarios-table">
                        <div class="loading">Cargando...</div>
                    </div>
                </div>
            </div>
            <div id="usuarios-modal" class="hidden"></div>
        `;
    },

    async afterRender() {
        await this.load();
    },

    async load() {
        try {
            const data = await api.getUsers();
            this.data = data.users;
            this.renderTable();
        } catch (error) {
            document.getElementById('usuarios-table').innerHTML = `
                <div class="alert alert-error">Error: ${error.message}</div>
            `;
        }
    },

    renderTable() {
        if (this.data.length === 0) {
            document.getElementById('usuarios-table').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128100;</div>
                    <p>No hay usuarios registrados</p>
                </div>
            `;
            return;
        }

        const currentUserId = getUser()?.id;

        document.getElementById('usuarios-table').innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th class="text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.data.map(u => {
                        const isMe = u.id === currentUserId;
                        const rolBadge = u.rol === 'admin' ? 'badge-info' : 'badge-success';
                        const estadoBadge = u.activo ? 'badge-success' : 'badge-danger';
                        const estadoTexto = u.activo ? 'Activo' : 'Inactivo';
                        return `
                            <tr style="${!u.activo ? 'opacity:0.5' : ''}">
                                <td><code>${escapeHtml(u.username)}</code>${isMe ? ' <span class="badge badge-warning" style="font-size:0.7rem">vos</span>' : ''}</td>
                                <td><strong>${escapeHtml(u.nombre)}</strong></td>
                                <td>${escapeHtml(u.email)}</td>
                                <td><span class="badge ${rolBadge}">${u.rol}</span></td>
                                <td><span class="badge ${estadoBadge}">${estadoTexto}</span></td>
                                <td class="text-right">
                                    <div class="actions" style="justify-content:flex-end">
                                        <button class="btn btn-sm btn-outline" onclick="Usuarios.openModal(${u.id})">Editar</button>
                                        ${!isMe ? `<button class="btn btn-sm btn-danger" onclick="Usuarios.toggleActive(${u.id})">${u.activo ? 'Desactivar' : 'Activar'}</button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    openModal(id = null) {
        const user = id ? this.data.find(u => u.id === id) : null;
        const title = user ? 'Editar usuario' : 'Nuevo usuario';
        const isEdit = !!user;

        document.getElementById('usuarios-modal').innerHTML = `
            <div class="modal-overlay" onclick="Usuarios.closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close" onclick="Usuarios.closeModal()">&times;</button>
                    </div>
                    <form id="usuario-form" onsubmit="Usuarios.save(event, ${id || 'null'})">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Usuario *</label>
                                <input type="text" id="usr-username" class="form-input" value="${user ? user.username : ''}" ${isEdit ? 'disabled' : ''} required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Nombre *</label>
                                <input type="text" id="usr-nombre" class="form-input" value="${user ? user.nombre : ''}" required>
                            </div>
                        </div>
                        ${!isEdit ? `
                        <div class="form-group">
                            <label class="form-label">Contraseña *</label>
                            <input type="password" id="usr-password" class="form-input" required minlength="4">
                        </div>
                        ` : ''}
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" id="usr-email" class="form-input" value="${user ? (user.email || '') : ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Rol *</label>
                                <select id="usr-rol" class="form-select" required>
                                    <option value="empleado" ${user && user.rol === 'empleado' ? 'selected' : ''}>Empleado</option>
                                    <option value="admin" ${user && user.rol === 'admin' ? 'selected' : ''}>Administrador</option>
                                </select>
                            </div>
                        </div>
                        <div id="usr-error" class="alert alert-error hidden"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="Usuarios.closeModal()">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('usuarios-modal').classList.remove('hidden');
    },

    closeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        document.getElementById('usuarios-modal').classList.add('hidden');
    },

    async save(event, id) {
        event.preventDefault();
        const errorDiv = document.getElementById('usr-error');

        try {
            errorDiv.classList.add('hidden');

            if (id) {
                // Edit
                const data = {
                    nombre: document.getElementById('usr-nombre').value.trim(),
                    email: document.getElementById('usr-email').value.trim() || undefined,
                    rol: document.getElementById('usr-rol').value
                };
                await api.updateUser(id, data);
            } else {
                // Create
                const data = {
                    username: document.getElementById('usr-username').value.trim(),
                    password: document.getElementById('usr-password').value,
                    nombre: document.getElementById('usr-nombre').value.trim(),
                    email: document.getElementById('usr-email').value.trim() || undefined,
                    rol: document.getElementById('usr-rol').value
                };
                await api.registerUser(data);
            }

            this.closeModal();
            await this.load();
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        }
    },

    async toggleActive(id) {
        const user = this.data.find(u => u.id === id);
        if (!user) return;
        const action = user.activo ? 'desactivar' : 'activar';
        if (!confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} al usuario "${user.nombre}"?`)) return;
        try {
            await api.updateUser(id, { activo: user.activo ? 0 : 1 });
            await this.load();
        } catch (error) {
            alert(error.message);
        }
    }
};
