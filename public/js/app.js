// App — Main application with SPA router

// Estado global para la tasa del dólar
const App = {
    tasaDolar: { tasa: 0, fuente: '', fecha: null },
    // Route definitions
    routes: {
        '/login': { view: Login, auth: false },
        '/dashboard': { view: Dashboard, auth: true },
        '/ventas': { view: Ventas, auth: true },
        '/categorias': { view: Categorias, auth: true },
        '/proveedores': { view: Proveedores, auth: true },
        '/clientes': { view: Clientes, auth: true },
        '/productos': { view: Productos, auth: true },
        '/movimientos': { view: Movimientos, auth: true },
        '/facturas': { view: Facturas, auth: true },
        '/reportes': { view: Reportes, auth: true },
        '/usuarios': { view: Usuarios, auth: true, admin: true }
    },

    // Initialize the app
    init() {
        // Listen for hash changes
        window.addEventListener('hashchange', () => this.navigate());
        // Handle initial load
        this.navigate();
        // Update navigation based on auth state
        this.updateNavigation();
        // Setup mobile menu
        this.setupMobileMenu();
        // Setup theme toggle
        this.setupTheme();
    },

    // Initialize mobile menu toggle logic
    setupMobileMenu() {
        const menuBtn = document.getElementById('mobile-menu-btn');
        const navLinks = document.getElementById('nav-links');
        const mgmtToggle = document.getElementById('mgmt-toggle');
        const mgmtDropdown = document.getElementById('mgmt-dropdown');
        
        if (menuBtn && navLinks) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navLinks.classList.toggle('show');
            });
        }

        if (mgmtToggle && mgmtDropdown) {
            mgmtToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                mgmtDropdown.classList.toggle('show');
            });
        }
        
        // Cerrar menús al hacer clic en un link (excepto en el toggle)
        document.querySelectorAll('.nav-link, .dropdown-item').forEach(link => {
            if (link.id === 'mgmt-toggle') return;
            link.addEventListener('click', () => {
                if (navLinks) navLinks.classList.remove('show');
                if (mgmtDropdown) mgmtDropdown.classList.remove('show');
            });
        });
        
        // Cerrar menú si se hace clic fuera
        document.addEventListener('click', (e) => {
            if (navLinks && !navLinks.contains(e.target) && menuBtn && !menuBtn.contains(e.target)) {
                navLinks.classList.remove('show');
            }
            if (mgmtDropdown && !mgmtDropdown.contains(e.target)) {
                mgmtDropdown.classList.remove('show');
            }
        });
    },

    setupTheme() {
        const themeBtn = document.getElementById('theme-toggle');
        const savedTheme = localStorage.getItem('theme') || 'light';
        
        // Aplicar tema inicial
        document.documentElement.setAttribute('data-theme', savedTheme);

        if (themeBtn) {
            themeBtn.addEventListener('click', (e) => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                
                // Efecto "Theme Toggle" usando View Transition API si está disponible
                if (document.startViewTransition) {
                    const x = e.clientX;
                    const y = e.clientY;
                    const endRadius = Math.hypot(
                        Math.max(x, innerWidth - x),
                        Math.max(y, innerHeight - y)
                    );

                    const transition = document.startViewTransition(() => {
                        document.documentElement.setAttribute('data-theme', newTheme);
                        localStorage.setItem('theme', newTheme);
                    });

                    transition.ready.then(() => {
                        const clipPath = [
                            `circle(0px at ${x}px ${y}px)`,
                            `circle(${endRadius}px at ${x}px ${y}px)`,
                        ];
                        document.documentElement.animate(
                            {
                                clipPath: newTheme === 'dark' ? clipPath : [...clipPath].reverse(),
                            },
                            {
                                duration: 500,
                                easing: 'ease-in-out',
                                pseudoElement: newTheme === 'dark' ? '::view-transition-new(root)' : '::view-transition-old(root)',
                            }
                        );
                    });
                } else {
                    // Fallback para navegadores antiguos
                    document.documentElement.setAttribute('data-theme', newTheme);
                    localStorage.setItem('theme', newTheme);
                }
            });
        }
    },

    // Navigate to current hash route
    navigate() {
        const hash = window.location.hash || '#/login';
        const path = hash.replace('#', '') || '/login';
        const route = this.routes[path];

        // Default redirect
        if (!route) {
            window.location.hash = isLoggedIn() ? '#/dashboard' : '#/login';
            return;
        }

        // Auth check
        if (route.auth && !isLoggedIn()) {
            window.location.hash = '#/login';
            return;
        }

        // Admin check
        if (route.admin && !isAdmin()) {
            alert('Acceso denegado');
            window.location.hash = '#/dashboard';
            return;
        }

        // Redirect logged-in users away from login
        if (path === '/login' && isLoggedIn()) {
            window.location.hash = '#/dashboard';
            return;
        }

        // Render the view
        this.renderView(route.view);
        this.updateNavigation();
        this.updateActiveNav(path);
    },

    // Render a view into the content area
    renderView(view) {
        const content = document.getElementById('app-content');
        if (content && view && typeof view.render === 'function') {
            content.innerHTML = view.render();
            if (typeof view.afterRender === 'function') {
                view.afterRender();
            }
        }
    },

    // Update navigation visibility based on auth state
    updateNavigation() {
        const nav = document.getElementById('main-nav');
        const userInfo = document.getElementById('user-info');

        if (isLoggedIn()) {
            if (nav) nav.classList.remove('hidden');
            if (userInfo) {
                const user = getUser();
                userInfo.textContent = user ? user.nombre : '';
            }
            // Ocultar enlace a Usuarios si no es admin
            const usersLink = document.getElementById('users-nav-link');
            const mgmtDivider = document.getElementById('mgmt-divider');
            if (usersLink) usersLink.style.display = isAdmin() ? '' : 'none';
            if (mgmtDivider) mgmtDivider.style.display = isAdmin() ? '' : 'none';
        } else {
            if (nav) nav.classList.add('hidden');
        }
    },

    // Update active navigation link
    updateActiveNav(path) {
        document.querySelectorAll('.nav-link, .dropdown-item').forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = document.querySelector(`.nav-link[href="#${path}"], .dropdown-item[href="#${path}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            
            // Si el link está dentro de un dropdown, marcar el toggle
            const dropdown = activeLink.closest('.nav-dropdown');
            if (dropdown) {
                const toggle = dropdown.querySelector('.dropdown-toggle');
                if (toggle) toggle.classList.add('active');
            }
        }
    },

    // Cargar tasa del dólar desde el servidor
    async loadTasaDolar() {
        try {
            const response = await fetch('/api/tasa-dolar');
            if (response.ok) {
                const data = await response.json();
                this.tasaDolar = { tasa: data.tasa, fuente: data.fuente, fecha: data.fechaActualizacion };
                this.updateTasaDisplay();
            }
        } catch (error) {
            console.warn('[App] Error al cargar tasa del dólar:', error);
        }
    },

    // Convertir precio de USD a Bs
    aBs(usd) {
        if (!usd || usd === 0 || this.tasaDolar.tasa === 0) return 0;
        return usd * this.tasaDolar.tasa;
    },

    // Formatear monto con ambas monedas
    formatMonto(usd) {
        const bs = this.aBs(usd);
        return `$${usd.toLocaleString('es-VE', { minimumFractionDigits: 2 })} / ${bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs`;
    },

    // Actualizar display de la tasa en el navbar
    updateTasaDisplay() {
        const tasaDisplay = document.getElementById('tasa-display');
        if (tasaDisplay) {
            tasaDisplay.style.cursor = 'pointer';
            tasaDisplay.onclick = () => this.editarTasaManual();
            
            if (this.tasaDolar.tasa > 0) {
                tasaDisplay.textContent = `$${this.tasaDolar.tasa.toLocaleString('es-VE')} Bs/USD`;
                tasaDisplay.title = `Fuente: ${this.tasaDolar.fuente}${this.tasaDolar.fecha ? ' - Actualizado: ' + new Date(this.tasaDolar.fecha).toLocaleDateString('es-VE') : ''}\n(Clic para cambiar)`;
                
                // Alertar si es manual
                if (this.tasaDolar.fuente === 'Modo Manual') {
                    tasaDisplay.style.background = 'rgba(245, 158, 11, 0.2)'; // Naranja suave
                    tasaDisplay.style.color = '#d97706';
                    tasaDisplay.style.padding = '4px 12px';
                    tasaDisplay.style.borderRadius = '20px';
                    tasaDisplay.style.fontWeight = 'bold';
                    tasaDisplay.innerHTML = `⚠️ $${this.tasaDolar.tasa.toLocaleString('es-VE')} Bs (Manual)`;
                } 
                // Alertar si no hay internet (usando el caché)
                else if (this.tasaDolar.fuente.includes('Sin internet')) {
                    tasaDisplay.style.background = 'rgba(239, 68, 68, 0.15)'; // Rojo suave
                    tasaDisplay.style.color = '#dc2626'; // Rojo fuerte
                    tasaDisplay.style.padding = '4px 12px';
                    tasaDisplay.style.borderRadius = '20px';
                    tasaDisplay.style.fontWeight = 'bold';
                    tasaDisplay.innerHTML = `📡 $${this.tasaDolar.tasa.toLocaleString('es-VE')} Bs (Sin Internet)`;
                }
                else {
                    tasaDisplay.style.background = 'transparent';
                    tasaDisplay.style.color = 'inherit';
                    tasaDisplay.style.padding = '0';
                    tasaDisplay.style.fontWeight = 'normal';
                }
            } else {
                tasaDisplay.style.background = 'rgba(239, 68, 68, 0.2)';
                tasaDisplay.style.color = '#b91c1c';
                tasaDisplay.style.padding = '4px 12px';
                tasaDisplay.style.borderRadius = '20px';
                tasaDisplay.textContent = '❌ Tasa no disponible (Sin Internet)';
                tasaDisplay.title = 'No hay conexión a internet y no hay tasa de respaldo. Fijar manual urgente.';
            }
        }
    },

    async editarTasaManual() {
        const actual = this.tasaDolar.tasa || '';
        const input = prompt('Fijar tasa de dólar (solo si fallan las APIs).\n\n• Ingresa el valor en Bs.\n• Ingresa 0 o deja en blanco para volver a intentar con la API:', actual);
        
        if (input !== null) {
            let tasaManual = parseFloat(input.replace(',', '.'));
            if (isNaN(tasaManual) || input.trim() === '') tasaManual = 0; // 0 significa resetear a la API

            if (tasaManual >= 0) {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch('/api/tasa-dolar', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': token ? `Bearer ${token}` : ''
                        },
                        body: JSON.stringify({ tasa: tasaManual })
                    });
                    
                    if (response.ok) {
                        // Forzar una recarga limpia desde el backend
                        await this.loadTasaDolar();
                        
                        // Recargar vistas que dependan de la tasa sin romper si no están en pantalla
                        try {
                            if (typeof Ventas !== 'undefined') {
                                if (Ventas.carrito) Ventas.actualizarTotales();
                                if (typeof Ventas.renderProductos === 'function' && Ventas.productos && Ventas.productos.length > 0) {
                                    Ventas.renderProductos(Ventas.productos);
                                }
                            }
                            
                            const prodSec = document.getElementById('productos-section');
                            if (typeof Productos !== 'undefined' && prodSec && !prodSec.classList.contains('hidden')) {
                                Productos.renderTable();
                            }
                            
                            if (typeof Reportes !== 'undefined' && document.getElementById('reportes-resumen')) {
                                Reportes.renderResumen();
                                Reportes.renderTabla();
                            }
                        } catch (uiError) {
                            console.error('Error actualizando la vista:', uiError);
                        }
                        
                    } else {
                        alert('Error al guardar la tasa manual. ¿Tienes permisos de Administrador?');
                    }
                } catch (e) {
                    console.error('Fetch error:', e);
                    alert('Error de conexión con el servidor.');
                }
            } else {
                alert('Tasa inválida. Debe ser un número mayor o igual a 0.');
            }
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
    
    // Cargar tasa del dólar si el usuario está logueado
    if (isLoggedIn()) {
        App.loadTasaDolar();
        
        // Monitoreo proactivo de la tasa (cada 5 minutos para detectar caídas de internet rápido)
        setInterval(() => {
            if (isLoggedIn()) {
                App.loadTasaDolar();
            }
        }, 300000); 
    }

    // Detectar cambios de conexión en el navegador para reaccionar de inmediato
    window.addEventListener('online', () => {
        console.log('[App] Conexión restaurada, actualizando tasa...');
        if (isLoggedIn()) App.loadTasaDolar();
    });

    window.addEventListener('offline', () => {
        console.warn('[App] Conexión perdida');
        if (isLoggedIn()) App.loadTasaDolar(); // Esto disparará el fallback local inmediatamente
    });
});
