const readline = require('readline');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../database/db');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function pregunta(pregunta) {
    return new Promise((resolve) => {
        rl.question(pregunta, (respuesta) => {
            resolve(respuesta);
        });
    });
}

async function generarRecoveryKey() {
    const key = crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
    return key;
}

async function main() {
    console.log('\n===========================================');
    console.log('  SISTEMA DE INVENTARIO HILDEMAR');
    console.log('  Setup Inicial');
    console.log('===========================================\n');

    const usuariosExistentes = db.prepare('SELECT COUNT(*) as count FROM users').get();

    if (usuariosExistentes.count > 0) {
        console.log('El sistema ya tiene usuarios configurados.');
        console.log('Este script solo debe ejecutarse en el primer setup.\n');
        rl.close();
        return;
    }

    console.log('PRIMER PASO: Crear usuario administrador\n');

    const adminUsername = await pregunta('Username del admin: ');
    const adminPassword = await pregunta('Contraseña del admin: ');
    const adminNombre = await pregunta('Nombre completo del admin: ');
    const adminEmail = await pregunta('Email del admin (opcional): ');

    if (!adminUsername || !adminPassword || !adminNombre) {
        console.log('\n❌ Username, contraseña y nombre son obligatorios.\n');
        rl.close();
        return;
    }

    if (adminPassword.length < 6) {
        console.log('\n❌ La contraseña debe tener al menos 6 caracteres.\n');
        rl.close();
        return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const result = db.prepare(`
        INSERT INTO users (username, password_hash, nombre, email, rol)
        VALUES (?, ?, ?, ?, 'admin')
    `).run(adminUsername, passwordHash, adminNombre, adminEmail || null);

    console.log('\n✅ Usuario administrador creado.');

    const recoveryKey = await generarRecoveryKey();
    const recoveryKeyHash = await bcrypt.hash(recoveryKey, 10);

    db.prepare('INSERT INTO recovery_keys (key_hash) VALUES (?)').run(recoveryKeyHash);

    console.log('\n===========================================');
    console.log('  ⚠️  CLAVE DE RECUPERACIÓN IMPORTANTE');
    console.log('  ⚠️  GUARDALA EN UN LUGAR SEGURO');
    console.log('===========================================\n');
    console.log('  Clave: ' + recoveryKey + '\n');
    console.log('  Esta clave es ÚNICA y se genera una sola vez.');
    console.log('  Si perdés la contraseña del admin, necesitás');
    console.log('  esta clave para resetearla.\n');
    console.log('  Para resetear: npm run reset-password\n');

    const agregarEmpleado = await pregunta('¿Querés crear un usuario empleado ahora? (s/n): ');

    if (agregarEmpleado.toLowerCase() === 's') {
        console.log('\nSEGUNDO PASO: Crear usuario empleado\n');

        const empUsername = await pregunta('Username del empleado: ');
        const empPassword = await pregunta('Contraseña del empleado: ');
        const empNombre = await pregunta('Nombre completo del empleado: ');

        if (empUsername && empPassword && empNombre) {
            const empHash = await bcrypt.hash(empPassword, 10);
            db.prepare(`
                INSERT INTO users (username, password_hash, nombre, rol)
                VALUES (?, ?, ?, 'empleado')
            `).run(empUsername, empHash, empNombre);
            console.log('\n✅ Usuario empleado creado.\n');
        }
    }

    console.log('===========================================');
    console.log('  SETUP COMPLETADO');
    console.log('===========================================');
    console.log('\nArrancá el servidor con: npm start\n');

    rl.close();
}

main();
