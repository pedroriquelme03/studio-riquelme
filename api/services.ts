import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
	try {
		const supabaseUrl =
			process.env.SUPABASE_URL ||
			process.env.VITE_SUPABASE_URL;
		const supabaseKey =
			process.env.SUPABASE_SERVICE_ROLE_KEY ||
			process.env.VITE_SUPABASE_ANON_KEY;
		if (!supabaseUrl || !supabaseKey) {
			return res.status(500).json({ ok: false, error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados' });
		}
		const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

		if (req.method === 'GET') {
			const { data, error } = await supabase
				.from('services')
				.select(`
          id,
          name,
          price,
          duration_minutes,
          description,
          responsible_professional_id,
          professionals:responsible_professional_id ( id, name )
        `)
				.order('name', { ascending: true });
			if (error) return res.status(500).json({ ok: false, error: error.message });
			const services = (data || []).map((r: any) => ({
				id: r.id,
				name: r.name,
				price: Number(r.price),
				duration: Number(r.duration_minutes),
				description: r.description || '',
				responsibleProfessionalId: r.responsible_professional_id,
				responsibleProfessionalName: r.professionals?.name || null,
			}));
			return res.status(200).json({ ok: true, services });
		}

		if (req.method === 'POST') {
			const raw = req.body ?? {};
			const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
			const { name, price, duration, description, responsibleProfessionalId } = body as {
				name?: string; price?: number; duration?: number; description?: string; responsibleProfessionalId?: string | null;
			};
			if (!name || !price || !duration) {
				return res.status(400).json({ ok: false, error: 'name, price e duration são obrigatórios' });
			}
			const { data, error } = await supabase
				.from('services')
				.insert({
					name,
					price,
					duration_minutes: duration,
					description: description || '',
					responsible_professional_id: responsibleProfessionalId ?? null,
				})
				.select('id')
				.single();
			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(201).json({ ok: true, id: data?.id });
		}

		if (req.method === 'PUT') {
			const raw = req.body ?? {};
			const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
			const { id, name, price, duration, description, responsibleProfessionalId } = body as {
				id?: number; name?: string; price?: number; duration?: number; description?: string; responsibleProfessionalId?: string | null;
			};
			if (!id || !name || !price || !duration) {
				return res.status(400).json({ ok: false, error: 'id, name, price e duration são obrigatórios' });
			}
			const { error } = await supabase
				.from('services')
				.update({
					name,
					price,
					duration_minutes: duration,
					description: description || '',
					responsible_professional_id: responsibleProfessionalId ?? null,
				})
				.eq('id', id);
			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(200).json({ ok: true });
		}

		if (req.method === 'DELETE') {
			const urlObj = new URL(req?.url || '/', 'http://localhost');
			const id = Number(urlObj.searchParams.get('id') || '0');
			if (!id) return res.status(400).json({ ok: false, error: 'id é obrigatório' });
			const { error } = await supabase.from('services').delete().eq('id', id);
			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(200).json({ ok: true });
		}

		res.setHeader('Allow', 'GET, POST, PUT, DELETE');
		return res.status(405).json({ ok: false, error: 'Método não permitido' });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}

