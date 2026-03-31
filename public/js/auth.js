// Auth module — Login/logout and auth state management

const Auth = {
    // Handle login form submission
    async handleLogin(event) {
        event.preventDefault();

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');

        if (!username || !password) {
            errorDiv.textContent = 'Usuario y contraseña son requeridos';
            errorDiv.classList.remove('hidden');
            return;
        }

        try {
            errorDiv.classList.add('hidden');
            const data = await api.login(username, password);

            // Store token and user
            setToken(data.token);
            setUser(data.user);

            // Redirect to dashboard
            window.location.hash = '#/dashboard';
            App.updateNavigation();
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('hidden');
        }
    },

    // Handle logout
    logout() {
        clearToken();
        App.updateNavigation();
        window.location.hash = '#/login';
    },

    // Check if user is authenticated, redirect if not
    requireAuth() {
        if (!isLoggedIn()) {
            window.location.hash = '#/login';
            return false;
        }
        return true;
    },

    // Check if user is admin, show error if not
    requireAdmin() {
        if (!this.requireAuth()) return false;
        if (!isAdmin()) {
            alert('Acceso denegado. Se requiere rol de administrador.');
            return false;
        }
        return true;
    }
};
