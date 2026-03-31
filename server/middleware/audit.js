const db = require('../database/db');

function registrarAuditoria(userId, username, accion, entidad, entidadId = null, detalle = null, ipAddress = null) {
    const stmt = db.prepare(`
        INSERT INTO audit_log (user_id, username, accion, entidad, entidad_id, detalle, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
        userId,
        username,
        accion,
        entidad,
        entidadId,
        detalle ? JSON.stringify(detalle) : null,
        ipAddress
    );
}

function auditMiddleware(accion, entidad) {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);
        
        res.json = function(data) {
            if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
                registrarAuditoria(
                    req.user.id,
                    req.user.username,
                    accion,
                    entidad,
                    data.id || null,
                    { respuesta: data },
                    req.ip
                );
            }
            return originalJson(data);
        };
        
        next();
    };
}

module.exports = { registrarAuditoria, auditMiddleware };
