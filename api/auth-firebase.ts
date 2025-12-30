// Endpoint: autenticação via Firebase (Google) + autorização por tabela admins (Supabase)
// Requer variáveis no Vercel:
// - FIREBASE_PROJECT_ID
// - FIREBASE_CLIENT_EMAIL
// - FIREBASE_PRIVATE_KEY (com quebras de linha escapadas como \n)
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

function initFirebaseAdmin() {
	if (getApps().length > 0) return;

	const projectId = process.env.FIREBASE_PROJECT_ID;
	const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
	let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';

	if (!projectId || !clientEmail || !privateKey) {
		console.error('[AUTH-FIREBASE] Credenciais do Firebase Admin ausentes');
		throw new Error('Firebase Admin credentials not configured');
	}

	// Corrigir quebras de linha escapadas
	privateKey = privateKey.replace(/\\n/g, '\n');

	initializeApp({
		credential: cert({ projectId, clientEmail, privateKey }),
	});
}

export default async function handler(req: any, res: any) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST');
		return res.status(405).json({ ok: false, error: 'Método não permitido' });
	}

	try {
		// Parse do body
		const raw = req.body ?? {};
		const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
		const { idToken } = (parsed || {}) as { idToken?: string };

		if (!idToken) {
			return res.status(400).json({ ok: false, error: 'idToken é obrigatório' });
		}

		// Inicializar Firebase Admin e verificar token
		initFirebaseAdmin();
		const adminAuth = getAdminAuth();

		const decoded = await adminAuth.verifyIdToken(idToken);
		const email = decoded.email || '';
		const name = decoded.name || '';
		const uid = decoded.uid;

		if (!email) {
			return res.status(400).json({ ok: false, error: 'Token sem email verificado' });
		}

		// Supabase server client (service role)
		const supabaseUrl =
			process.env.SUPABASE_URL ||
			process.env.VITE_SUPABASE_URL;
		const supabaseKey =
			process.env.SUPABASE_SERVICE_ROLE_KEY ||
			process.env.VITE_SUPABASE_ANON_KEY;

		if (!supabaseUrl || !supabaseKey) {
			console.error('[AUTH-FIREBASE] Credenciais Supabase ausentes');
			return res.status(500).json({ ok: false, error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados' });
		}

		const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

		// Autorizar por tabela admins (email precisa existir e estar ativo)
		const { data: admin, error } = await supabase
			.from('admins')
			.select('id, username, name, email, is_active')
			.eq('email', email)
			.eq('is_active', true)
			.single();

		if (error || !admin) {
			console.log('[AUTH-FIREBASE] Admin não autorizado:', { email, uid, error: error?.message });
			return res.status(403).json({ ok: false, error: 'Usuário não autorizado' });
		}

		// Sucesso
		return res.status(200).json({
			ok: true,
			admin: {
				id: admin.id,
				username: admin.username || email,
				name: admin.name || name,
				email: admin.email || email,
				uid,
				provider: 'google',
			},
		});
	} catch (err: any) {
		console.error('[AUTH-FIREBASE] Erro:', err);
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}


