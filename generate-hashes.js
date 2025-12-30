// Script para gerar hashes SHA-256 das senhas
// Execute: node generate-hashes.js

const crypto = require('crypto');

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

console.log('=== Hashes SHA-256 das Senhas ===\n');

users.forEach(user => {
	const hash = hashPassword(user.password);
	console.log(`Usuário: ${user.username}`);
	console.log(`Senha: ${user.password}`);
	console.log(`Hash: ${hash}`);
	console.log(`\nSQL:`);
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
	console.log(`    is_active = EXCLUDED.is_active;`);
	console.log('\n' + '='.repeat(50) + '\n');
});

