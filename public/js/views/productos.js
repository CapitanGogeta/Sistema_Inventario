// Productos View — Full CRUD with modal (no stock editing)

const Productos = {
    data: [],
    categorias: [],
    proveedores: [],

    render() {
        const isAdminUser = isAdmin();
        return `
            <div class="container">
                <div class="page-header">
                    <h1 class="page-title">Productos</h1>
                    <p class="page-subtitle">Gestión de productos del inventario</p>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Lista de productos</h2>
                        <div style="display:flex;gap:12px;align-items:center">
                            <input type="text" id="filtro-producto-nombre" class="form-input" placeholder="Buscar producto..." onkeyup="Productos.renderTable()" style="margin-bottom:0;">
                            ${isAdminUser ? `
                                <button class="btn btn-outline" onclick="Productos.exportExcel()" style="border-color: #10b981; color: #10b981;">📊 Excel</button>
                                <button class="btn btn-primary" onclick="Productos.openModal()">+ Nuevo producto</button>
                            ` : ''}
                        </div>
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
            const [prodData, catData, provData] = await Promise.all([
                api.getProductos(),
                api.getCategorias(),
                api.getProveedores()
            ]);
            this.data = prodData.productos;
            this.categorias = catData.categorias;
            this.proveedores = provData.proveedores;
            this.renderTable();
        } catch (error) {
            document.getElementById('productos-table').innerHTML = `
                <div class="alert alert-error">Error: ${error.message}</div>
            `;
        }
    },

    renderTable() {
        const query = document.getElementById('filtro-producto-nombre')?.value.toLowerCase() || '';
        const dataFiltrada = this.data.filter(p => 
            p.nombre.toLowerCase().includes(query) || 
            (p.codigo && p.codigo.toLowerCase().includes(query)) ||
            (p.codigo_barras && p.codigo_barras.toLowerCase().includes(query))
        );

        if (dataFiltrada.length === 0) {
            document.getElementById('productos-table').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128230;</div>
                    <p>No hay productos registrados o no coinciden con la búsqueda</p>
                </div>
            `;
            return;
        }

        const isAdminUser = isAdmin();
        const tasa = App.tasaDolar.tasa || 0;
        document.getElementById('productos-table').innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Marca</th>
                        <th>Volumen</th>
                        <th>Categoría</th>
                        <th>Stock</th>
                        <th>P. Compra</th>
                        <th>P. Venta</th>
                        <th>Valor Total</th>
                        ${isAdminUser ? '<th class="text-right">Acciones</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${dataFiltrada.map(p => {
                        const stockClass = p.stock_actual < p.stock_minimo ? 'badge-danger' : 'badge-success';
                        
                        let stockTexto = p.unidad_medida === 'caja' ? `${p.stock_actual} cajas` : `${p.stock_actual} uds`;
                        if (p.unidad_medida === 'caja' && p.unidades_por_caja > 1) {
                            const cajas = Math.floor(p.stock_actual / p.unidades_por_caja);
                            const uds = p.stock_actual % p.unidades_por_caja;
                            stockTexto = `${cajas} Cajas <br><small style="color:#64748b">(${uds} Uds)</small>`;
                        }

                        return `
                            <tr>
                                <td><code>${escapeHtml(p.codigo) || escapeHtml(p.codigo_barras) || '-'}</code></td>
                                <td><strong>${escapeHtml(p.nombre)}</strong></td>
                                <td>${escapeHtml(p.marca || '-')}</td>
                                <td>${escapeHtml(p.volumen || '-')}</td>
                                <td>${escapeHtml(p.categoria_nombre || '-')}</td>
                                <td><span class="badge ${stockClass}">${stockTexto}</span></td>
                                <td>
                                    <div class="price-cell">
                                        <span class="price-usd">$${p.precio_compra.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                                        <span class="price-bs">${(p.precio_compra * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</span>
                                    </div>
                                </td>
                                <td>
                                    <div class="price-cell">
                                        <span style="font-size: 0.8rem; color: #64748b;">Caja:</span>
                                        <span class="price-usd">$${p.precio_venta.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                                        ${p.precio_venta_detal > 0 ? `
                                            <span style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">Detal:</span>
                                            <span class="price-usd">$${p.precio_venta_detal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                                        ` : ''}
                                    </div>
                                </td>
                                <td>
                                    <div class="price-cell">
                                        <span class="price-usd">$${(p.stock_actual * p.precio_compra).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                                        <span class="price-bs">${(p.stock_actual * p.precio_compra * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</span>
                                    </div>
                                </td>
                                ${isAdminUser ? `
                                    <td class="text-right">
                                        <div class="actions" style="justify-content:flex-end">
                                            <button class="btn btn-sm btn-outline" onclick="Productos.openModal(${p.id})">Editar</button>
                                            <button class="btn btn-sm btn-danger" onclick="Productos.delete(${p.id})">Eliminar</button>
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

    openModal(id = null) {
        const prod = id ? this.data.find(p => p.id === id) : null;
        const title = prod ? 'Editar producto' : 'Nuevo producto';

        const catOptions = this.categorias.map(c =>
            `<option value="${c.id}" ${prod && prod.categoria_id === c.id ? 'selected' : ''}>${c.nombre}</option>`
        ).join('');

        const provOptions = this.proveedores.map(p =>
            `<option value="${p.id}" ${prod && prod.proveedor_id === p.id ? 'selected' : ''}>${p.nombre}</option>`
        ).join('');

        let stockMinVal = prod ? prod.stock_minimo : 0;
        let stockMinMedida = 'unidad';
        if (prod && prod.unidades_por_caja > 1 && prod.stock_minimo > 0 && prod.stock_minimo % prod.unidades_por_caja === 0) {
            stockMinVal = prod.stock_minimo / prod.unidades_por_caja;
            stockMinMedida = 'caja';
        }

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
                                <label class="form-label">Nombre *</label>
                                <input type="text" id="prod-nombre" class="form-input" value="${prod ? escapeHtml(prod.nombre) : ''}" required placeholder="Ej: Cerveza">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Marca</label>
                                <input type="text" id="prod-marca" class="form-input" value="${prod ? escapeHtml(prod.marca) : ''}" placeholder="Ej: Quilmes">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Volumen</label>
                                <input type="text" id="prod-volumen" class="form-input" value="${prod ? escapeHtml(prod.volumen) : ''}" placeholder="Ej: 1L, 500ml, 750ml">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Código de barras</label>
                                <input type="text" id="prod-barras" class="form-input" value="${prod ? escapeHtml(prod.codigo_barras) : ''}" placeholder="Ej: 7790040001234">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Código interno</label>
                                <input type="text" id="prod-codigo" class="form-input" value="${prod ? escapeHtml(prod.codigo) : ''}" placeholder="Ej: QUI-1L">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Categoría</label>
                                <select id="prod-categoria" class="form-select">
                                    <option value="">Sin categoría</option>
                                    ${catOptions}
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Proveedor</label>
                                <select id="prod-proveedor" class="form-select">
                                    <option value="">Sin proveedor</option>
                                    ${provOptions}
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="prod-unidad-medida">Unidad de medida *</label>
                                <select id="prod-unidad-medida" class="form-select" required onchange="Productos.onUnidadChange()">
                                    <option value="unidad" ${(!prod || prod.unidad_medida === 'unidad') ? 'selected' : ''}>Unidad</option>
                                    <option value="caja" ${(prod && (prod.unidad_medida === 'caja' || prod.unidad_medida === 'Cajas')) ? 'selected' : ''}>Caja</option>
                                </select>
                            </div>
                        </div>
                        <div id="prod-caja-config" class="${(!prod || prod.unidad_medida === 'unidad') ? 'hidden' : ''}" style="background: var(--gray-100); border-radius: var(--radius); padding: 16px; margin-bottom: 16px;">
                            <p style="font-weight: bold; margin-bottom: 12px;">📦 Configuración de Caja</p>
                            <div class="form-group">
                                <label for="prod-unidades-caja">¿Cuántas unidades trae cada caja? *</label>
                                <input type="number" id="prod-unidades-caja" class="form-input" min="1" value="${prod?.unidades_por_caja || 1}" required onchange="Productos.onUnidadesCajaChange()">
                            </div>
                            <div id="prod-caja-info" style="color: var(--primary); font-size: 0.85rem;"></div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Descripción</label>
                            <input type="text" id="prod-descripcion" class="form-input" value="${prod ? escapeHtml(prod.descripcion) : ''}">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Precio de compra</label>
                                <input type="number" id="prod-compra" class="form-input" step="0.01" min="0" value="${prod ? prod.precio_compra : '0'}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Precio de venta (Caja / Mayor)</label>
                                <input type="number" id="prod-venta" class="form-input" step="0.01" min="0" value="${prod ? prod.precio_venta : '0'}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Precio de venta (Detal / Unidad)</label>
                            <input type="number" id="prod-venta-detal" class="form-input" step="0.01" min="0" value="${prod ? prod.precio_venta_detal : '0'}" placeholder="Si se vende por unidad también">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Stock mínimo (alerta)</label>
                                <div style="display:flex;gap:10px;">
                                    <input type="number" id="prod-stock-minimo" class="form-input" min="0" value="${stockMinVal}">
                                    <select id="prod-stock-minimo-medida" class="form-select" style="width: auto;">
                                        <option value="unidad" ${stockMinMedida === 'unidad' ? 'selected' : ''}>Unidades</option>
                                        <option value="caja" ${stockMinMedida === 'caja' ? 'selected' : ''}>Cajas</option>
                                    </select>
                                </div>
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

    onUnidadChange() {
        const val = document.getElementById('prod-unidad-medida').value;
        const cajaConfig = document.getElementById('prod-caja-config');
        if (val === 'caja') {
            cajaConfig.classList.remove('hidden');
            this.onUnidadesCajaChange();
        } else {
            cajaConfig.classList.add('hidden');
            document.getElementById('prod-unidades-caja').value = 1;
        }
    },

    onUnidadesCajaChange() {
        const upc = parseInt(document.getElementById('prod-unidades-caja').value) || 1;
        const precioMayor = parseFloat(document.getElementById('prod-venta').value) || 0;
        const infoDiv = document.getElementById('prod-caja-info');
        if (!infoDiv) return;

        if (upc > 1 && precioMayor > 0) {
            const sugerido = (precioMayor / upc).toFixed(2);
            infoDiv.innerHTML = `💡 Si una caja cuesta $${precioMayor.toFixed(2)} y trae ${upc} unidades, el precio por unidad sugerido es <strong>$${sugerido}</strong>`;
        } else if (upc > 1) {
            infoDiv.innerHTML = `📦 Cada caja contiene <strong>${upc}</strong> unidades.`;
        } else {
            infoDiv.innerHTML = '';
        }
    },

    async save(event, id) {
        event.preventDefault();
        const catVal = document.getElementById('prod-categoria').value;
        const errorDiv = document.getElementById('prod-error');
        const unidadesCaja = parseInt(document.getElementById('prod-unidades-caja').value) || 1;
        let stockMin = parseFloat(document.getElementById('prod-stock-minimo').value) || 0;
        const stockMinMedida = document.getElementById('prod-stock-minimo-medida').value;
        if (stockMinMedida === 'caja') {
            stockMin = stockMin * unidadesCaja;
        }

        const data = {
            nombre: document.getElementById('prod-nombre').value.trim(),
            marca: document.getElementById('prod-marca').value.trim() || undefined,
            volumen: document.getElementById('prod-volumen').value.trim() || undefined,
            codigo_barras: document.getElementById('prod-barras').value.trim() || undefined,
            codigo: document.getElementById('prod-codigo').value.trim() || undefined,
            categoria_id: catVal ? parseInt(catVal) : undefined,
            proveedor_id: document.getElementById('prod-proveedor').value || null,
            unidad_medida: document.getElementById('prod-unidad-medida').value,
            unidades_por_caja: unidadesCaja,
            descripcion: document.getElementById('prod-descripcion').value.trim() || undefined,
            precio_compra: parseFloat(document.getElementById('prod-compra').value) || 0,
            precio_venta: parseFloat(document.getElementById('prod-venta').value) || 0,
            precio_venta_detal: parseFloat(document.getElementById('prod-venta-detal').value) || 0,
            stock_minimo: stockMin
        };

        // Si es un producto EXISTENTE y cambió unidades_por_caja, alertar
        if (id && unidadesCaja > 1) {
            const prodOriginal = this.data.find(p => p.id === id);
            if (prodOriginal && prodOriginal.unidades_por_caja !== unidadesCaja && prodOriginal.stock_actual > 0) {
                const stockActual = prodOriginal.stock_actual;
                const confirmar = confirm(
                    `⚠️ ATENCIÓN: Cambiaste las unidades por caja.\n\n` +
                    `El stock actual es: ${stockActual}\n\n` +
                    `¿Ese "${stockActual}" representa CAJAS o UNIDADES SUELTAS?\n\n` +
                    `• Presiona ACEPTAR si son ${stockActual} CAJAS (se convertirá a ${stockActual * unidadesCaja} unidades)\n` +
                    `• Presiona CANCELAR si ya son ${stockActual} UNIDADES SUELTAS (no se convierte)`
                );
                if (confirmar) {
                    // El stock está en cajas, necesitamos convertirlo a unidades base
                    data.stock_necesita_conversion = true;
                }
            }
        }

        try {
            errorDiv.classList.add('hidden');
            if (id) {
                await api.updateProducto(id, data);
                
                // Si el usuario confirmó que el stock era en cajas, hacemos la conversión por separado
                if (data.stock_necesita_conversion) {
                    const prodOriginal = this.data.find(p => p.id === id);
                    const stockEnCajas = prodOriginal.stock_actual;
                    const stockEnUnidades = stockEnCajas * unidadesCaja;
                    const diferencia = stockEnUnidades - stockEnCajas;
                    
                    // Registrar un movimiento de ajuste para la conversión
                    await api.createMovimiento({
                        producto_id: id,
                        tipo: 'AJUSTE',
                        cantidad: diferencia,
                        tipo_medida: 'unidad',
                        motivo: `Conversión automática: ${stockEnCajas} cajas → ${stockEnUnidades} unidades (${unidadesCaja} uds/caja)`,
                        notas: 'Ajuste automático al configurar unidades por caja'
                    });
                }
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

    async delete(id) {
        const prod = this.data.find(p => p.id === id);
        const nombre = prod ? prod.nombre : 'este producto';
        if (!confirm(`¿Eliminar el producto "${nombre}"?`)) return;
        try {
            await api.deleteProducto(id);
            await this.load();
        } catch (error) {
            alert(error.message);
        }
    },

    exportExcel() {
        const token = localStorage.getItem('token');
        if (!token) return;
        window.open(`/api/productos/export/excel?token=${token}`, '_blank');
    }
};
