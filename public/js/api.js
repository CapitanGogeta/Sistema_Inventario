// API Service — All backend communication
// Uses fetch with automatic token injection

const API_BASE = '/api';

// Get token from localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Set token in localStorage
function setToken(token) {
    localStorage.setItem('token', token);
}

// Remove token
function clearToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

// Get stored user
function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Set stored user
function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

// Check if logged in
function isLoggedIn() {
    return !!getToken();
}

// Check if user is admin
function isAdmin() {
    const user = getUser();
    return user && user.rol === 'admin';
}

// Base fetch with auth header
async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json();

    // If unauthorized, redirect to login
    if (response.status === 401) {
        clearToken();
        window.location.hash = '#/login';
        throw new Error('Sesión expirada');
    }

    if (!response.ok) {
        throw new Error(data.error || 'Error en la petición');
    }

    return data;
}

// API methods
const api = {
    // Auth
    login: (username, password) =>
        apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        }),

    // Categorías
    getCategorias: () => apiFetch('/categorias'),
    getCategoria: (id) => apiFetch(`/categorias/${id}`),
    createCategoria: (data) =>
        apiFetch('/categorias', { method: 'POST', body: JSON.stringify(data) }),
    updateCategoria: (id, data) =>
        apiFetch(`/categorias/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteCategoria: (id) =>
        apiFetch(`/categorias/${id}`, { method: 'DELETE' }),

    // Proveedores
    getProveedores: () => apiFetch('/proveedores'),
    getProveedor: (id) => apiFetch(`/proveedores/${id}`),
    createProveedor: (data) =>
        apiFetch('/proveedores', { method: 'POST', body: JSON.stringify(data) }),
    updateProveedor: (id, data) =>
        apiFetch(`/proveedores/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteProveedor: (id) =>
        apiFetch(`/proveedores/${id}`, { method: 'DELETE' }),

    // Productos
    getProductos: () => apiFetch('/productos'),
    getProducto: (id) => apiFetch(`/productos/${id}`),
    createProducto: (data) =>
        apiFetch('/productos', { method: 'POST', body: JSON.stringify(data) }),
    updateProducto: (id, data) =>
        apiFetch(`/productos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteProducto: (id) =>
        apiFetch(`/productos/${id}`, { method: 'DELETE' }),

    // Movimientos
    getMovimientos: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiFetch(`/movimientos${query ? '?' + query : ''}`);
    },
    getMovimiento: (id) => apiFetch(`/movimientos/${id}`),
    createMovimiento: (data) =>
        apiFetch('/movimientos', { method: 'POST', body: JSON.stringify(data) }),

    // Facturas
    getFacturas: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiFetch(`/facturas${query ? '?' + query : ''}`);
    },
    getFactura: (id) => apiFetch(`/facturas/${id}`),
    uploadFactura: (formData) =>
        apiFetch('/facturas', { method: 'POST', body: formData }),

    // Usuarios
    getUsers: () => apiFetch('/auth/users'),
    registerUser: (data) =>
        apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id, data) =>
        apiFetch(`/auth/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteUser: (id) =>
        apiFetch(`/auth/users/${id}`, { method: 'DELETE' })
};
