// Script para gerar SQL de criação de usuários admin
// Execute: node create-users.js

import crypto from 'crypto';

function hashPassword(password) {
	return crypto.createHash('sha256').update(password).digest('hex');
}

const users = [
	{
		username: 'anariquelme',
		password: '6YnP0#b0H',
		name: 'Ana Clara Riquelme',
		email: 'ana@studioriquelme.com.br'
	},
	{
		username: 'biiariquelme',
		password: '53$92H3Fs',
		name: 'Ana Beatriz Riquelme',
		email: 'biia@studioriquelme.com.br'
	}
];

console.log('=== SQL para Criar Usuários Admin ===\n');
console.log('Execute este SQL no Supabase SQL Editor:\n');
console.log('--' + '='.repeat(60));
console.log('');

users.forEach((user, index) => {
	const hash = hashPassword(user.password);
	console.log(`-- Usuário ${index + 1}: ${user.username}`);
	console.log(`-- Senha: ${user.password}`);
	console.log(`-- Hash SHA-256: ${hash}`);
	console.log(`INSERT INTO public.admins (username, password_hash, name, email, is_active)`);
	console.log(`VALUES (`);
	console.log(`    '${user.username}',`);
	console.log(`    '${hash}',`);
	console.log(`    '${user.name}',`);
	console.log(`    '${user.email}',`);
	console.log(`    true`);
	console.log(`)`);
	console.log(`ON CONFLICT (username) DO UPDATE`);
	console.log(`SET password_hash = EXCLUDED.password_hash,`);
	console.log(`    name = EXCLUDED.name,`);
	console.log(`    email = EXCLUDED.email,`);
	console.log(`    is_active = EXCLUDED.is_active,`);
	console.log(`    updated_at = NOW();`);
	console.log('');
});

console.log('--' + '='.repeat(60));

