// App — Main application with SPA router

const App = {
    // Route definitions
    routes: {
        '/login': { view: Login, auth: false },
        '/dashboard': { view: Dashboard, auth: true },
        '/categorias': { view: Categorias, auth: true, admin: true },
        '/proveedores': { view: Proveedores, auth: true, admin: true },
        '/productos': { view: Productos, auth: true, admin: true },
        '/movimientos': { view: Movimientos, auth: true, admin: true },
        '/facturas': { view: Facturas, auth: true, admin: true },
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
        const loginPage = document.getElementById('login-page');

        if (isLoggedIn()) {
            if (nav) nav.classList.remove('hidden');
            if (userInfo) {
                const user = getUser();
                userInfo.textContent = user ? user.nombre : '';
            }
            if (loginPage) loginPage.classList.add('hidden');
        } else {
            if (nav) nav.classList.add('hidden');
            if (loginPage) loginPage.classList.remove('hidden');
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
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
