// App — Main application with SPA router

// Estado global para la tasa del dólar
const App = {
    tasaDolar: { tasa: 0, fuente: '', fecha: null },
    // Route definitions
    routes: {
        '/login': { view: Login, auth: false },
        '/dashboard': { view: Dashboard, auth: true },
        '/categorias': { view: Categorias, auth: true },
        '/proveedores': { view: Proveedores, auth: true },
        '/productos': { view: Productos, auth: true },
        '/movimientos': { view: Movimientos, auth: true },
        '/facturas': { view: Facturas, auth: true },
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
            const usersLink = document.querySelector('a[href="#/usuarios"]');
            if (usersLink) {
                usersLink.style.display = isAdmin() ? '' : 'none';
            }
        } else {
            if (nav) nav.classList.add('hidden');
        }
    },

    // Update active navigation link
    updateActiveNav(path) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${path}`) {
                link.classList.add('active');
            }
        });
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
            if (this.tasaDolar.tasa > 0) {
                tasaDisplay.textContent = `$${this.tasaDolar.tasa.toLocaleString('es-VE')} Bs/USD`;
                tasaDisplay.title = `Fuente: ${this.tasaDolar.fuente}${this.tasaDolar.fecha ? ' - Actualizado: ' + new Date(this.tasaDolar.fecha).toLocaleDateString('es-VE') : ''}`;
            } else {
                tasaDisplay.textContent = 'Tasa no disponible';
                tasaDisplay.title = 'No se pudo obtener la tasa del dólar';
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
    }
});
