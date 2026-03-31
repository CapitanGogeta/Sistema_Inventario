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
    console.log('  Reset de Contraseña');
    console.log('===========================================\n');

    const recoveryKeys = db.prepare('SELECT * FROM recovery_keys ORDER BY created_at DESC LIMIT 1').get();

    if (!recoveryKeys) {
        console.log('ERROR: No existe ninguna clave de recuperación.');
        console.log('Ejecuta primero el script de setup para generar una.\n');
        rl.close();
        return;
    }

    const claveIngresada = await pregunta('Clave de recuperación: ');

    try {
        const esValida = await bcrypt.compare(claveIngresada, recoveryKeys.key_hash);

        if (!esValida) {
            console.log('\n❌ Clave de recuperación incorrecta. Acceso denegado.\n');
            rl.close();
            return;
        }
    } catch (error) {
        console.log('\n❌ Error al verificar la clave.\n');
        rl.close();
        return;
    }

    console.log('✅ Clave de recuperación verificada.\n');

    const usuarios = db.prepare("SELECT id, username, nombre, rol FROM users WHERE activo = 1").all();

    console.log('Usuarios activos:\n');
    usuarios.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.username} (${u.nombre}) - ${u.rol}`);
    });
    console.log('');

    const usernameSeleccionado = await pregunta('Username del usuario a resetear: ');

    const usuario = db.prepare('SELECT id, username FROM users WHERE username = ? AND activo = 1').get(usernameSeleccionado);

    if (!usuario) {
        console.log('\n❌ Usuario no encontrado.\n');
        rl.close();
        return;
    }

    const nuevaPassword = await pregunta('Nueva contraseña: ');
    const confirmarPassword = await pregunta('Confirmar contraseña: ');

    if (nuevaPassword !== confirmarPassword) {
        console.log('\n❌ Las contraseñas no coinciden.\n');
        rl.close();
        return;
    }

    if (nuevaPassword.length < 6) {
        console.log('\n❌ La contraseña debe tener al menos 6 caracteres.\n');
        rl.close();
        return;
    }

    const passwordHash = await bcrypt.hash(nuevaPassword, 10);

    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(passwordHash, usuario.id);

    console.log('\n✅ Contraseña actualizada exitosamente para el usuario: ' + usuario.username);
    console.log('   El usuario puede iniciar sesión con la nueva contraseña.\n');

    rl.close();
}

main();
