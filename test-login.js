// Script para testar o hash das senhas
// Execute: node test-login.js

import crypto from 'crypto';

function hashPassword(password) {
	return crypto.createHash('sha256').update(password).digest('hex');
}

const users = [
	{ username: 'anariquelme', password: '6YnP0#b0H' },
	{ username: 'biiariquelme', password: '53$92H3Fs' },
	{ username: 'admin', password: 'studio2024' }
];

console.log('=== Teste de Hashes ===\n');

users.forEach(user => {
	const hash = hashPassword(user.password);
	console.log(`Usuário: ${user.username}`);
	console.log(`Senha: ${user.password}`);
	console.log(`Hash: ${hash}`);
	console.log('');
});

// Verificar se os hashes do SQL estão corretos
console.log('=== Verificação dos Hashes no SQL ===\n');
console.log('anariquelme esperado: 79cb9647c9f94a5f082ab755e27d9ea4e0d1247caba0a6d24fc5bd8455f17ac1');
console.log('anariquelme calculado:', hashPassword('6YnP0#b0H'));
console.log('Match:', hashPassword('6YnP0#b0H') === '79cb9647c9f94a5f082ab755e27d9ea4e0d1247caba0a6d24fc5bd8455f17ac1');
console.log('');
console.log('biiariquelme esperado: 460f4be59bdc0f4250d40adc272d856b80b6dfc7e962a1371c9e16ed329c07a5');
console.log('biiariquelme calculado:', hashPassword('53$92H3Fs'));
console.log('Match:', hashPassword('53$92H3Fs') === '460f4be59bdc0f4250d40adc272d856b80b6dfc7e962a1371c9e16ed329c07a5');

