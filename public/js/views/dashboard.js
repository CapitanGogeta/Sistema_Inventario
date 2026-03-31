// Dashboard View

const Dashboard = {
    render() {
        return `
            <div class="container">
                <div class="page-header">
                    <h1 class="page-title">Dashboard</h1>
                    <p class="page-subtitle">Resumen del inventario</p>
                </div>
                <div class="stats-grid" id="dashboard-stats">
                    <div class="loading">Cargando estadísticas...</div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Últimos movimientos</h2>
                    </div>
                    <div class="table-container" id="dashboard-movements">
                        <div class="loading">Cargando...</div>
                    </div>
                </div>
            </div>
        `;
    },

    async afterRender() {
        try {
            // Load stats in parallel
            const [productos, movimientos, categorias, proveedores] = await Promise.all([
                api.getProductos(),
                api.getMovimientos({ limit: 5 }),
                api.getCategorias(),
                api.getProveedores()
            ]);

            // Calculate stock total and low stock items
            const totalStock = productos.productos.reduce((sum, p) => sum + (p.stock_actual || 0), 0);
            const lowStock = productos.productos.filter(p => p.stock_actual < p.stock_minimo).length;

            // Render stats
            document.getElementById('dashboard-stats').innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${productos.productos.length}</div>
                    <div class="stat-label">Productos activos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${categorias.categorias.length}</div>
                    <div class="stat-label">Categorías</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${proveedores.proveedores.length}</div>
                    <div class="stat-label">Proveedores</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${lowStock}</div>
                    <div class="stat-label">Stock bajo</div>
                </div>
            `;

            // Render recent movements
            if (movimientos.movimientos.length === 0) {
                document.getElementById('dashboard-movements').innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">&#128203;</div>
                        <p>No hay movimientos registrados</p>
                    </div>
                `;
            } else {
                document.getElementById('dashboard-movements').innerHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Producto</th>
                                <th>Tipo</th>
                                <th>Cantidad</th>
                                <th>Motivo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${movimientos.movimientos.map(m => `
                                <tr>
                                    <td>${new Date(m.created_at).toLocaleString('es-AR')}</td>
                                    <td>${m.producto_nombre || '-'}</td>
                                    <td><span class="badge badge-${m.tipo === 'ENTRADA' ? 'success' : m.tipo === 'SALIDA' ? 'danger' : 'info'}">${m.tipo}</span></td>
                                    <td>${m.cantidad}</td>
                                    <td>${m.motivo || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        } catch (error) {
            document.getElementById('dashboard-stats').innerHTML = `
                <div class="alert alert-error">Error al cargar estadísticas: ${error.message}</div>
            `;
        }
    }
};
