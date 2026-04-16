// Login View

const Login = {
    render() {
        return `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-header">
                        <img src="img/logo.png" alt="Maxi Licor" class="login-logo-img">
                        <h1 class="login-title">Maxi Licor</h1>
                        <p class="login-subtitle">Sistema de gestión de inventario</p>
                    </div>
                    <form id="login-form" onsubmit="Auth.handleLogin(event)">
                        <div class="form-group">
                            <label class="form-label" for="login-username">Usuario</label>
                            <input type="text" id="login-username" class="form-input" placeholder="Tu usuario" autofocus>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="login-password">Contraseña</label>
                            <input type="password" id="login-password" class="form-input" placeholder="Tu contraseña">
                        </div>
                        <div id="login-error" class="alert alert-error hidden"></div>
                        <button type="submit" class="btn btn-primary" style="width:100%">Iniciar sesión</button>
                    </form>
                </div>
            </div>
        `;
    },

    afterRender() {
        // Focus on username field
        const usernameInput = document.getElementById('login-username');
        if (usernameInput) usernameInput.focus();
    }
};
