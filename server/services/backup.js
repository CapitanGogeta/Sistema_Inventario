const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

// Configuración de Telegram
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const DB_PATH = path.join(__dirname, '../../data/database.sqlite');
const BACKUP_TEMP_PATH = path.join(__dirname, '../../backups/instant_backup.sqlite');

let isDirty = false;
let isBackingUp = false;

/**
 * Marca que ha habido un cambio en la base de datos que requiere respaldo.
 */
const markAsDirty = () => {
    isDirty = true;
};

/**
 * Realiza el proceso de backup y lo envía por Telegram.
 */
const performBackup = async () => {
    if (!BOT_TOKEN || !CHAT_ID) {
        // console.warn('[Backup] No configurado: Faltan credenciales de Telegram.');
        return;
    }

    if (isBackingUp || !isDirty) return;

    isBackingUp = true;
    try {
        console.log('[Backup] Iniciando respaldo a Telegram...');
        
        // 1. Crear directorio de backups si no existe
        const backupDir = path.dirname(BACKUP_TEMP_PATH);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // 2. Realizar backup en caliente de SQLite (clon seguro de la DB)
        await db.backup(BACKUP_TEMP_PATH);

        // 3. Preparar archivo para enviar por Telegram
        const form = new FormData();
        form.append('chat_id', CHAT_ID);
        form.append('document', fs.createReadStream(BACKUP_TEMP_PATH), {
            filename: `hildemar_backup_${new Date().toISOString().split('T')[0]}.sqlite`,
            contentType: 'application/x-sqlite3'
        });
        form.append('caption', `📦 Respaldo automático\n⏰ ${new Date().toLocaleString('es-VE')}`);

        // 4. Enviar a Telegram
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, form, {
            headers: form.getHeaders(),
            maxBodyLength: Infinity,
            timeout: 30000 // 30 segundos máximo
        });

        // 5. Limpiar bandera
        isDirty = false;
        console.log('[Backup] ✅ Respaldo enviado exitosamente por Telegram.');
    } catch (error) {
        console.error('[Backup] ❌ Error enviando a Telegram:', error.message);
    } finally {
        isBackingUp = false;
    }
};

// Iniciar el vigilante (cada 15 segundos revisa si hay cambios)
const startBackupWatcher = (intervalMs = 15000) => {
    setInterval(performBackup, intervalMs);
    console.log(`[Backup] Vigilante de Telegram iniciado (revisión cada ${intervalMs/1000}s)`);
};

module.exports = {
    markAsDirty,
    startBackupWatcher
};
