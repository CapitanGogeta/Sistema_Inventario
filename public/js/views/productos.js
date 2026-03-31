// Productos View — Full CRUD with modal (no stock editing)

const Productos = {
    data: [],
    categorias: [],

    render() {
        return `
            <div class="container">
                <div class="page-header">
                    <h1 class="page-title">Productos</h1>
                    <p class="page-subtitle">Gestión de productos del inventario</p>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Lista de productos</h2>
                        <button class="btn btn-primary" onclick="Productos.openModal()">+ Nuevo producto</button>
                    </div>
                    <div class="table-container" id="productos-table">
                        <div class="loading">Cargando...</div>
                    </div>
                </div>
            </div>
            <div id="productos-modal" class="hidden"></div>
        `;
    },

    async afterRender() {
        await this.load();
    },

    async load() {
        try {
            const [prodData, catData] = await Promise.all([
                api.getProductos(),
                api.getCategorias()
            ]);
            this.data = prodData.productos;
            this.categorias = catData.categorias;
            this.renderTable();
        } catch (error) {
            document.getElementById('productos-table').innerHTML = `
                <div class="alert alert-error">Error: ${error.message}</div>
            `;
        }
    },

    renderTable() {
        if (this.data.length === 0) {
            document.getElementById('productos-table').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128230;</div>
                    <p>No hay productos registrados</p>
                </div>
            `;
            return;
        }

        document.getElementById('productos-table').innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Categoría</th>
                        <th>Stock</th>
                        <th>P. Compra</th>
                        <th>Monto Total</th>
                        <th class="text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.data.map(p => {
                        const stockClass = p.stock_actual < p.stock_minimo ? 'badge-danger' : 'badge-success';
                        return `
                            <tr>
                                <td><code>${p.codigo || '-'}</code></td>
                                <td><strong>${p.nombre}</strong></td>
                                <td>${p.categoria_nombre || '-'}</td>
                                <td><span class="badge ${stockClass}">${p.stock_actual}</span></td>
                                <td>$${p.precio_compra}</td>
                                <td><strong>$${(p.stock_actual * p.precio_compra).toLocaleString('es-AR')}</strong></td>
                                <td class="text-right">
                                    <div class="actions" style="justify-content:flex-end">
                                        <button class="btn btn-sm btn-outline" onclick="Productos.openModal(${p.id})">Editar</button>
                                        <button class="btn btn-sm btn-danger" onclick="Productos.delete(${p.id}, '${p.nombre}')">Eliminar</button>
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
        const prod = id ? this.data.find(p => p.id === id) : null;
        const title = prod ? 'Editar producto' : 'Nuevo producto';

        const catOptions = this.categorias.map(c =>
            `<option value="${c.id}" ${prod && prod.categoria_id === c.id ? 'selected' : ''}>${c.nombre}</option>`
        ).join('');

        document.getElementById('productos-modal').innerHTML = `
            <div class="modal-overlay" onclick="Productos.closeModal(event)">
                <div class="modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close" onclick="Productos.closeModal()">&times;</button>
                    </div>
                    <form id="producto-form" onsubmit="Productos.save(event, ${id || 'null'})">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Código</label>
                                <input type="text" id="prod-codigo" class="form-input" value="${prod ? (prod.codigo || '') : ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Nombre *</label>
                                <input type="text" id="prod-nombre" class="form-input" value="${prod ? prod.nombre : ''}" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Categoría</label>
                            <select id="prod-categoria" class="form-select">
                                <option value="">Sin categoría</option>
                                ${catOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Descripción</label>
                            <input type="text" id="prod-descripcion" class="form-input" value="${prod ? (prod.descripcion || '') : ''}">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Precio de compra</label>
                                <input type="number" id="prod-compra" class="form-input" step="0.01" min="0" value="${prod ? prod.precio_compra : '0'}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Stock mínimo (alerta)</label>
                                <input type="number" id="prod-stock-min" class="form-input" min="0" value="${prod ? prod.stock_minimo : '0'}">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Unidad de medida</label>
                                <input type="text" id="prod-unidad" class="form-input" value="${prod ? prod.unidad_medida : 'unidad'}">
                            </div>
                        </div>
                        ${prod ? '<p class="form-label" style="color:var(--warning);margin-bottom:16px">⚠️ El stock solo se modifica desde Movimientos</p>' : ''}
                        <div id="prod-error" class="alert alert-error hidden"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="Productos.closeModal()">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('productos-modal').classList.remove('hidden');
    },

    closeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        document.getElementById('productos-modal').classList.add('hidden');
    },

    async save(event, id) {
        event.preventDefault();
        const catVal = document.getElementById('prod-categoria').value;
        const data = {
            codigo: document.getElementById('prod-codigo').value.trim() || undefined,
            nombre: document.getElementById('prod-nombre').value.trim(),
            descripcion: document.getElementById('prod-descripcion').value.trim() || undefined,
            categoria_id: catVal ? parseInt(catVal) : undefined,
            precio_compra: parseFloat(document.getElementById('prod-compra').value) || 0,
            unidad_medida: document.getElementById('prod-unidad').value.trim() || 'unidad',
            stock_minimo: parseInt(document.getElementById('prod-stock-min').value) || 0
        };
        const errorDiv = document.getElementById('prod-error');

        try {
            errorDiv.classList.add('hidden');
            if (id) {
                await api.updateProducto(id, data);
            } else {
                await api.createProducto(data);
            }
            this.closeModal();
            await this.load();
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        }
    },

    async delete(id, nombre) {
        if (!confirm(`¿Eliminar el producto "${nombre}"?`)) return;
        try {
            await api.deleteProducto(id);
            await this.load();
        } catch (error) {
            alert(error.message);
        }
    }
};
