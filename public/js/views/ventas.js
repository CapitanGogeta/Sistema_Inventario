const Ventas = {
    productos: [],
    clientes: [],
    carrito: [],
    filtroBusqueda: '',

    render() {
        return `
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                <!-- Panel Izquierdo: Buscador y Productos -->
                <div class="card" style="flex: 2; min-width: 300px; display: flex; flex-direction: column; max-height: 80vh;">
                    <div style="margin-bottom: 15px;">
                        <input type="text" id="pos-search" class="form-input" placeholder="Buscar por nombre o código de barras..." style="font-size: 1.2rem; padding: 10px;" onkeyup="Ventas.handleSearch(event)">
                    </div>
                    
                    <div style="flex: 1; overflow-y: auto;">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Cód. Barras</th>
                                    <th>Producto</th>
                                    <th>Stock</th>
                                    <th>Precio</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody id="pos-productos-body">
                                <tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Panel Derecho: Carrito (Ticket) -->
                <div class="card" style="flex: 1; min-width: 300px; display: flex; flex-direction: column; max-height: 80vh; background: var(--bg-dark); border: 2px solid var(--border-color);">
                    <h3 style="margin-top:0; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">Ticket Actual</h3>
                    
                    <div id="pos-carrito" style="flex: 1; overflow-y: auto; margin-bottom: 15px;">
                        <!-- Ítems del carrito -->
                    </div>

                    <div style="border-top: 2px dashed var(--border-color); padding-top: 15px;">
                        <div style="display:flex; justify-content:space-between; font-size: 1.2rem;">
                            <span>Subtotal:</span>
                            <span id="pos-subtotal">$0.00</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size: 1.5rem; font-weight: bold; margin-top: 10px; color: var(--primary);">
                            <span>TOTAL:</span>
                            <span id="pos-total-usd">$0.00</span>
                        </div>
                        <div style="display:flex; justify-content:flex-end; font-size: 1.2rem; color: var(--text-muted); margin-bottom: 15px;">
                            <span id="pos-total-bs">0.00 Bs</span>
                        </div>
                        
                        <button class="btn btn-success" style="width: 100%; font-size: 1.2rem; padding: 15px;" onclick="Ventas.openCobrarModal()" id="btn-cobrar" disabled>
                            COBRAR
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal Cobrar -->
            <div id="cobrar-modal" class="modal-overlay hidden" onclick="Ventas.closeCobrarModal()">
                <div class="modal" style="max-width: 500px;" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">Procesar Venta</h3>
                        <button class="modal-close" onclick="Ventas.closeCobrarModal()">&times;</button>
                    </div>
                    
                    <div style="background: var(--bg-main); padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: center; border: 1px solid var(--border-color);">
                        <div style="font-size: 2.5rem; font-weight: bold; color: var(--success);" id="modal-total-usd"></div>
                        <div style="font-size: 1.2rem; color: var(--text-muted);" id="modal-total-bs"></div>
                    </div>

                    <form id="cobrar-form" onsubmit="Ventas.procesarVenta(event)">
                        <div class="form-group">
                            <label class="form-label">Tipo de Venta *</label>
                            <select id="venta-tipo" class="form-input" required onchange="Ventas.handleTipoVentaChange()">
                                <option value="NORMAL">Contado</option>
                                <option value="FIADO">Fiado (A Crédito)</option>
                                <option value="DUENO">Consumo Interno / Dueño</option>
                                <option value="APOYO">Apoyo a Local / Funcionario</option>
                            </select>
                        </div>

                        <div class="form-group" id="group-cliente" style="display:none;">
                            <label class="form-label">Cliente (Deudor) *</label>
                            <select id="venta-cliente" class="form-input">
                                <option value="">-- Seleccione Cliente --</option>
                            </select>
                        </div>

                        <div class="form-group" id="group-metodo">
                            <label class="form-label">Método de Pago *</label>
                            <select id="venta-metodo" class="form-input">
                                <option value="EFECTIVO">Efectivo</option>
                                <option value="DIVISAS">Divisas ($ / €)</option>
                                <option value="PAGO_MOVIL">Pago Móvil</option>
                                <option value="TRANSFERENCIA">Transferencia</option>
                                <option value="PUNTO">Punto de Venta</option>
                                <option value="ZELLE">Zelle</option>
                                <option value="OTRO">Otro</option>
                            </select>
                        </div>

                        <div class="modal-footer" style="margin-top: 24px;">
                            <button type="button" class="btn btn-outline" onclick="Ventas.closeCobrarModal()">Cancelar</button>
                            <button type="submit" class="btn btn-success" style="font-weight: bold;">CONFIRMAR VENTA</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    async afterRender() {
        this.carrito = [];
        await Promise.all([
            this.loadProductos(),
            this.loadClientes()
        ]);
        
        // Auto-focus search
        setTimeout(() => {
            const search = document.getElementById('pos-search');
            if (search) search.focus();
        }, 100);
    },

    async loadProductos() {
        try {
            const data = await apiFetch('/productos');
            // Solo productos activos
            this.productos = (data.productos || []).filter(p => p.activo === 1);
            this.renderProductos();
        } catch (error) {
            console.error('Error cargando productos:', error);
            document.getElementById('pos-productos-body').innerHTML = '<tr><td colspan="5" class="text-danger">Error cargando productos</td></tr>';
        }
    },

    async loadClientes() {
        try {
            const data = await apiFetch('/clientes');
            this.clientes = (data || []).filter(c => c.activo === 1);
            
            const select = document.getElementById('venta-cliente');
            if (select) {
                select.innerHTML = '<option value="">-- Seleccione Cliente --</option>' + 
                    this.clientes.map(c => `<option value="${c.id}">${this.escapeHtml(c.nombre)}</option>`).join('');
            }
        } catch (error) {
            console.error('Error cargando clientes:', error);
        }
    },

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

    handleSearch(event) {
        this.filtroBusqueda = event.target.value.toLowerCase();
        
        // Si el usuario presiona Enter, intentar agregar automáticamente si hay un solo resultado exacto (ej. escáner)
        if (event.key === 'Enter') {
            const match = this.productos.find(p => 
                (p.codigo_barras && p.codigo_barras.toLowerCase() === this.filtroBusqueda) ||
                p.id.toString() === this.filtroBusqueda
            );
            if (match) {
                this.agregarAlCarrito(match.id);
                event.target.value = ''; // limpiar
                this.filtroBusqueda = '';
            }
        }
        
        this.renderProductos();
    },

    renderProductos() {
        const tbody = document.getElementById('pos-productos-body');
        if (!tbody) return;

        let filtrados = this.productos;
        if (this.filtroBusqueda) {
            filtrados = this.productos.filter(p => 
                p.nombre.toLowerCase().includes(this.filtroBusqueda) || 
                (p.codigo_barras && p.codigo_barras.toLowerCase().includes(this.filtroBusqueda))
            );
        }

        // Mostrar máximo 50 para no trabar el navegador
        filtrados = filtrados.slice(0, 50);

        if (filtrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay productos que coincidan</td></tr>';
            return;
        }

        tbody.innerHTML = filtrados.map(p => {
            const stockColor = p.stock_actual <= p.stock_minimo ? 'var(--danger)' : 'inherit';
            
            let stockDisplay = p.stock_actual;
            let stockTexto = p.unidad_medida === 'caja' ? 'Cajas' : 'Uds';
            if (p.unidad_medida === 'caja' && p.unidades_por_caja > 1) {
                const cajas = Math.floor(p.stock_actual / p.unidades_por_caja);
                const uds = p.stock_actual % p.unidades_por_caja;
                stockDisplay = `${cajas} <small>Cajas</small> <br><small style="color:var(--gray-500)">(${uds} uds)</small>`;
                stockTexto = '';
            } else if (p.unidad_medida === 'caja') {
                stockDisplay = p.stock_actual;
            }

            let actionButtons = '';
            // Si el producto tiene unidades por caja > 1 y tiene un precio detal distinto al de mayor, mostramos ambos
            if (p.unidades_por_caja > 1 && p.precio_venta_detal > 0 && p.precio_venta_detal !== p.precio_venta) {
                actionButtons = `
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <button class="btn btn-sm btn-primary" onclick="Ventas.agregarAlCarrito(${p.id}, 'caja')">
                            + Caja ($${p.precio_venta.toFixed(2)})
                        </button>
                        <button class="btn btn-sm btn-outline" style="border-color: var(--primary); color: var(--primary);" onclick="Ventas.agregarAlCarrito(${p.id}, 'unidad')">
                            + Unidad ($${p.precio_venta_detal.toFixed(2)})
                        </button>
                    </div>
                `;
            } else {
                actionButtons = `
                    <button class="btn btn-sm btn-primary" onclick="Ventas.agregarAlCarrito(${p.id}, 'unidad')">
                        Agregar
                    </button>
                `;
            }

            return `
            <tr>
                <td><small>${this.escapeHtml(p.codigo_barras) || '-'}</small></td>
                <td>
                    <strong>${this.escapeHtml(p.nombre)}</strong>
                    <br><small style="color: var(--gray-500);">Mayor: $${p.precio_venta.toFixed(2)} | Detal: $${(p.precio_venta_detal || 0).toFixed(2)}</small>
                </td>
                <td style="color: ${stockColor}; font-weight: bold;">${stockDisplay} ${stockTexto}</td>
                <td>$${p.precio_venta.toFixed(2)}</td>
                <td>
                    ${actionButtons}
                </td>
            </tr>
            `;
        }).join('');
    },

    agregarAlCarrito(id, tipo_unidad = 'unidad') {
        const producto = this.productos.find(p => p.id === id);
        if (!producto) return;

        const isCaja = tipo_unidad === 'caja';
        const precio = isCaja ? producto.precio_venta : (producto.precio_venta_detal || producto.precio_venta);
        const nameSuffix = (producto.unidad_medida === 'caja' && producto.unidades_por_caja > 1) ? (isCaja ? ' (Caja)' : ' (Unidad)') : '';
        const idUnico = `${id}_${tipo_unidad}`;

        // Verificamos stock total en unidades base
        const cantRequeridaEnUnidadesBase = isCaja ? producto.unidades_por_caja : 1;
        const totalEnCarritoBase = this.carrito.reduce((sum, item) => {
            if (item.producto_id === id) {
                return sum + (item.cantidad * (item.tipo_unidad === 'caja' ? producto.unidades_por_caja : 1));
            }
            return sum;
        }, 0);

        if (totalEnCarritoBase + cantRequeridaEnUnidadesBase > producto.stock_actual) {
            alert('No hay suficiente stock disponible');
            return;
        }

        const existente = this.carrito.find(item => item.id_unico === idUnico);
        
        if (existente) {
            existente.cantidad += 1;
        } else {
            this.carrito.push({
                id_unico: idUnico,
                producto_id: producto.id,
                tipo_unidad: tipo_unidad,
                nombre: producto.nombre + nameSuffix,
                precio_unitario: precio,
                cantidad: 1,
                max_stock_base: producto.stock_actual,
                unidades_por_caja: producto.unidades_por_caja
            });
        }

        this.renderCarrito();
    },

    actualizarCantidad(idUnico, delta) {
        const item = this.carrito.find(i => i.id_unico === idUnico);
        if (!item) return;

        const nuevaCantidad = item.cantidad + delta;
        if (nuevaCantidad <= 0) {
            this.carrito = this.carrito.filter(i => i.id_unico !== idUnico);
            this.renderCarrito();
            return;
        }

        // Check stock
        const cantAumentoBase = delta > 0 ? (item.tipo_unidad === 'caja' ? item.unidades_por_caja : 1) : 0;
        if (cantAumentoBase > 0) {
            const totalEnCarritoBase = this.carrito.reduce((sum, i) => {
                if (i.producto_id === item.producto_id) {
                    return sum + (i.cantidad * (i.tipo_unidad === 'caja' ? i.unidades_por_caja : 1));
                }
                return sum;
            }, 0);

            if (totalEnCarritoBase + cantAumentoBase > item.max_stock_base) {
                alert('Stock máximo alcanzado');
                return;
            }
        }

        item.cantidad = nuevaCantidad;
        this.renderCarrito();
    },

    eliminarDelCarrito(idUnico) {
        this.carrito = this.carrito.filter(i => i.id_unico !== idUnico);
        this.renderCarrito();
    },

    renderCarrito() {
        const container = document.getElementById('pos-carrito');
        const btnCobrar = document.getElementById('btn-cobrar');
        if (!container) return;

        if (this.carrito.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">El ticket está vacío</div>';
            btnCobrar.disabled = true;
            this.actualizarTotales();
            return;
        }

        btnCobrar.disabled = false;

        container.innerHTML = this.carrito.map(item => {
            const subtotal = item.cantidad * item.precio_unitario;
            return `
                <div style="background: var(--bg-color); border: 1px solid var(--border-color); padding: 10px; margin-bottom: 8px; border-radius: 4px;">
                    <div style="display:flex; justify-content: space-between; font-weight: bold; margin-bottom: 5px;">
                        <span>${this.escapeHtml(item.nombre)}</span>
                        <span>$${subtotal.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--text-muted); font-size: 0.9rem;">$${item.precio_unitario.toFixed(2)} c/u</span>
                        
                        <div style="display:flex; align-items: center; gap: 10px;">
                            <button class="btn btn-sm btn-outline" style="padding: 2px 8px;" onclick="Ventas.actualizarCantidad('${item.id_unico}', -1)">-</button>
                            <span style="font-weight: bold;">${item.cantidad} <small style="font-weight: normal; color: var(--gray-500);">${item.tipo_unidad === 'caja' ? 'cajas' : 'uds'}</small></span>
                            <button class="btn btn-sm btn-outline" style="padding: 2px 8px;" onclick="Ventas.actualizarCantidad('${item.id_unico}', 1)">+</button>
                            <button class="btn btn-sm btn-danger" style="padding: 2px 8px; margin-left: 10px;" onclick="Ventas.eliminarDelCarrito('${item.id_unico}')">X</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.actualizarTotales();
    },

    calcularTotalUSD() {
        return this.carrito.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
    },

    actualizarTotales() {
        const totalUsd = this.calcularTotalUSD();
        
        document.getElementById('pos-subtotal').textContent = `$${totalUsd.toFixed(2)}`;
        document.getElementById('pos-total-usd').textContent = `$${totalUsd.toFixed(2)}`;
        
        if (App && App.aBs) {
            const totalBs = App.aBs(totalUsd);
            document.getElementById('pos-total-bs').textContent = `${totalBs.toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs`;
        }
    },

    openCobrarModal() {
        if (this.carrito.length === 0) return;
        
        const totalUsd = this.calcularTotalUSD();
        document.getElementById('modal-total-usd').textContent = `$${totalUsd.toFixed(2)}`;
        
        if (App && App.aBs) {
            const totalBs = App.aBs(totalUsd);
            document.getElementById('modal-total-bs').textContent = `${totalBs.toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs`;
        }

        document.getElementById('venta-tipo').value = 'NORMAL';
        this.handleTipoVentaChange(); // reset UI

        document.getElementById('cobrar-modal').classList.remove('hidden');
    },

    closeCobrarModal() {
        document.getElementById('cobrar-modal').classList.add('hidden');
    },

    handleTipoVentaChange() {
        const tipo = document.getElementById('venta-tipo').value;
        const groupCliente = document.getElementById('group-cliente');
        const groupMetodo = document.getElementById('group-metodo');
        const selectCliente = document.getElementById('venta-cliente');

        if (tipo === 'FIADO') {
            groupCliente.style.display = 'block';
            selectCliente.required = true;
            groupMetodo.style.display = 'none';
        } else if (tipo === 'CONSUMO') {
            groupCliente.style.display = 'none';
            selectCliente.required = false;
            groupMetodo.style.display = 'none';
        } else {
            // NORMAL
            groupCliente.style.display = 'none';
            selectCliente.required = false;
            groupMetodo.style.display = 'block';
        }
    },

    async procesarVenta(event) {
        event.preventDefault();

        if (this.carrito.length === 0) {
            alert('El carrito está vacío');
            return;
        }

        const tipo = document.getElementById('venta-tipo').value;
        const metodo = tipo === 'NORMAL' ? document.getElementById('venta-metodo').value : null;
        const cliente_id = tipo === 'FIADO' ? document.getElementById('venta-cliente').value : null;

        if (tipo === 'FIADO' && !cliente_id) {
            alert('Debe seleccionar un cliente para fiar');
            return;
        }

        const btn = event.target.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Procesando...';

        const total = this.calcularTotalUSD();

        const payload = {
            cliente_id: cliente_id || null,
            tipo_venta: tipo,
            metodo_pago: metodo,
            subtotal: total,
            descuento: 0,
            recargo: 0,
            total: total,
            detalles: this.carrito.map(i => ({
                producto_id: i.producto_id,
                cantidad: i.cantidad,
                precio_unitario: i.precio_unitario,
                tipo_unidad: i.tipo_unidad
            }))
        };

        try {
            const resp = await apiFetch('/ventas', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            // Venta exitosa
            this.closeCobrarModal();
            this.carrito = []; // vaciar
            this.renderCarrito();
            
            // Recargar productos para actualizar el stock local
            await this.loadProductos();
            
            alert(`¡Venta registrada exitosamente! (Ticket #${resp.venta_id})`);
            
            const search = document.getElementById('pos-search');
            if (search) {
                search.value = '';
                search.focus();
            }

        } catch (error) {
            alert('Error al registrar venta: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

