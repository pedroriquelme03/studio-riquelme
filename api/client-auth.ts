// Autenticação simples de clientes via WhatsApp (telefone)
// - Registro: action = 'register' (POST), com name, phone, email (opcional)
// - Login: action = 'login' (POST), com phone
// Agora usa Supabase (service role) em vez de conexão PG direta.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

function getSupabaseServer() {
	const supabaseUrl =
		process.env.SUPABASE_URL ||
		process.env.VITE_SUPABASE_URL;
	const supabaseKey =
		process.env.SUPABASE_SERVICE_ROLE_KEY ||
		process.env.VITE_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseKey) {
		throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados');
	}
	return createSupabaseClient(supabaseUrl, supabaseKey);
}

function normalizePhone(phone?: string): string {
	const digits = (phone || '').replace(/\D/g, '');
	// mantém DDI/DDD/numero como informado, apenas números
	return digits;
}

export default async function handler(req: any, res: any) {
	try {
		if (req.method !== 'POST') {
			res.setHeader('Allow', 'POST');
			return res.status(405).json({ ok: false, error: 'Método não permitido' });
		}

		const raw = req.body ?? {};
		const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
		const action = String(body?.action || '').toLowerCase();

		if (!['register', 'login', 'set_password', 'login_password'].includes(action)) {
			return res.status(400).json({ ok: false, error: 'action deve ser "register", "login", "set_password" ou "login_password"' });
		}

		const phone = normalizePhone(body?.phone);
		const name = (body?.name || '').toString().trim();
		const email = (body?.email || '').toString().trim() || null;
		const password = (body?.password || '').toString();

		if (!phone && action !== 'set_password' && action !== 'login_password') {
			return res.status(400).json({ ok: false, error: 'phone é obrigatório' });
		}

		const supabase = getSupabaseServer();

		// Definir/atualizar senha do cliente
		if (action === 'set_password') {
			if (!password) return res.status(400).json({ ok: false, error: 'password é obrigatório' });

			// identificar cliente por phone ou email
			let client: any = null;
			if (phone) {
				const { data } = await supabase.from('clients').select('id, phone').eq('phone', phone).maybeSingle();
				client = data;
			} else if (email) {
				const { data } = await supabase.from('clients').select('id, email').eq('email', email).maybeSingle();
				client = data;
			}
			if (!client?.id) return res.status(404).json({ ok: false, error: 'Cliente não encontrado' });

			const password_hash = createHash('sha256').update(password).digest('hex');
			const { error: upErr } = await supabase.from('clients').update({ password_hash, updated_at: new Date().toISOString() }).eq('id', client.id);
			if (upErr) return res.status(500).json({ ok: false, error: upErr.message });
			return res.status(200).json({ ok: true });
		}

		// Login com senha
		if (action === 'login_password') {
			if (!password) return res.status(400).json({ ok: false, error: 'password é obrigatório' });
			// localizar cliente por phone (preferencial) ou email
			let client: any = null;
			if (phone) {
				const { data } = await supabase.from('clients').select('id, phone, password_hash').eq('phone', phone).maybeSingle();
				client = data;
			} else if (email) {
				const { data } = await supabase.from('clients').select('id, phone, password_hash').eq('email', email).maybeSingle();
				client = data;
			}
			if (!client?.id || !client?.password_hash) {
				return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
			}
			const computed = createHash('sha256').update(password).digest('hex');
			if (computed !== client.password_hash) {
				return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
			}

			// salvar last_login em registered_clients se existir
			if (client.phone) {
				await supabase.from('registered_clients').update({ last_login: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('phone', client.phone.replace(/\D/g, ''));
			}
			return res.status(200).json({ ok: true, phone: client.phone || phone });
		}

		if (action === 'register') {
			if (!name) {
				return res.status(400).json({ ok: false, error: 'name é obrigatório para register' });
			}

			// Verificar se cliente já existe na tabela clients
			let clientId: string | null = null;
			const { data: existingClient, error: cErr } = await supabase
				.from('clients')
				.select('id, phone')
				.eq('phone', phone)
				.limit(1)
				.maybeSingle();
			
			if (!cErr && existingClient?.id) {
				clientId = String(existingClient.id);
				// Atualizar dados do cliente se necessário
				const updateData: any = {
					name,
					updated_at: new Date().toISOString(),
				};
				if (email && email.trim()) {
					updateData.email = email.trim();
				}
				await supabase
					.from('clients')
					.update(updateData)
					.eq('id', clientId);
			} else {
				// Criar novo cliente na tabela clients
				// Construir objeto de inserção sem email se for vazio/null
				const insertData: any = {
					name,
					phone,
				};
				if (email && email.trim()) {
					insertData.email = email.trim();
				}
				
				const { data: newClient, error: insClientErr } = await supabase
					.from('clients')
					.insert(insertData)
					.select('id')
					.single();
				
				if (insClientErr) {
					return res.status(500).json({ ok: false, error: `Erro ao criar cliente: ${insClientErr.message}` });
				}
				clientId = String(newClient.id);
			}

			// Buscar registro existente em registered_clients por phone (dígitos)
			const { data: existing, error: rErr } = await supabase
				.from('registered_clients')
				.select('id, client_id, email')
				.eq('phone', phone)
				.limit(1)
				.maybeSingle();
			if (rErr) {
				return res.status(500).json({ ok: false, error: rErr.message });
			}

			if (existing?.id) {
				// Atualizar nome e email (se informado agora), preservar client_id existente se já houver
				const { error: upErr } = await supabase
					.from('registered_clients')
					.update({
						name,
						email: email || existing.email || null,
						client_id: clientId,
						updated_at: new Date().toISOString(),
					})
					.eq('id', existing.id);
				if (upErr) return res.status(500).json({ ok: false, error: upErr.message });
			} else {
				// Inserir novo registro
				const { error: insErr } = await supabase
					.from('registered_clients')
					.insert({
						client_id: clientId,
						name,
						phone,
						email,
					});
				if (insErr) return res.status(500).json({ ok: false, error: insErr.message });
			}

			return res.status(201).json({ ok: true, phone });
		}

			if (action === 'login') {
				// Verificar se telefone existe na registered_clients
				const { data: r, error: rErr } = await supabase
					.from('registered_clients')
					.select('id')
					.eq('phone', phone)
					.limit(1)
					.maybeSingle();
				if (rErr) return res.status(500).json({ ok: false, error: rErr.message });

				if (!r?.id) {
					// Fallback simples: procurar em clients por igualdade exata (sem normalização avançada)
					const { data: c, error: cErr } = await supabase
						.from('clients')
						.select('id')
						.eq('phone', phone)
						.limit(1)
						.maybeSingle();
					if (cErr || !c?.id) {
						return res.status(404).json({ ok: false, error: 'Telefone não encontrado' });
					}
				} else {
					// Atualizar last_login
					await supabase
						.from('registered_clients')
						.update({ last_login: new Date().toISOString(), updated_at: new Date().toISOString() })
						.eq('id', r.id);
				}
				return res.status(200).json({ ok: true, phone });
			}

			return res.status(400).json({ ok: false, error: 'Ação inválida' });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}


