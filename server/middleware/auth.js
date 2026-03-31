const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ 
            error: 'Token no proporcionado' 
        });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ 
            error: 'Formato de token inválido. Use: Bearer <token>' 
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expirado' 
            });
        }
        return res.status(401).json({ 
            error: 'Token inválido' 
        });
    }
}

function adminOnly(req, res, next) {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ 
            error: 'Acceso denegado. Se requiere rol de administrador.' 
        });
    }
    next();
}

module.exports = { authMiddleware, adminOnly };
