// Script para criar o primeiro admin
// Execute: node create-admin.js

const crypto = require('crypto');

function hashPassword(password) {
	return crypto.createHash('sha256').update(password).digest('hex');
}

// Configurações
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'studio2024';
const ADMIN_NAME = 'Administrador';
const ADMIN_EMAIL = 'admin@studioriquelme.com.br';

// Gerar hash da senha
const passwordHash = hashPassword(ADMIN_PASSWORD);

console.log('=== Script de Criação de Admin ===\n');
console.log('Username:', ADMIN_USERNAME);
console.log('Password Hash:', passwordHash);
console.log('\nExecute este SQL no Supabase:\n');
console.log(`INSERT INTO public.admins (username, password_hash, name, email, is_active)
VALUES ('${ADMIN_USERNAME}', '${passwordHash}', '${ADMIN_NAME}', '${ADMIN_EMAIL}', true)
ON CONFLICT (username) DO NOTHING;`);

