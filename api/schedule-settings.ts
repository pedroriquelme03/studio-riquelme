// API para configurar horários usando Supabase (service role)
// - GET: lista business_hours e manual_slots
// - PUT: upsert de business_hours (7 dias)
// - POST: insert de manual_slots
// - DELETE: delete de manual_slots por id

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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

export default async function handler(req: any, res: any) {
	try {
		const supabase = getSupabaseServer();

			if (req.method === 'GET') {
				const { data: hours, error: hErr } = await supabase
					.from('business_hours')
					.select('id, weekday, enabled, open_time, close_time')
					.order('weekday', { ascending: true });
				const { data: slots, error: sErr } = await supabase
					.from('manual_slots')
					.select('id, date, time, professional_id, note, available, created_at')
					.order('date', { ascending: true })
					.order('time', { ascending: true });
				if (hErr) return res.status(500).json({ ok: false, error: hErr.message });
				if (sErr) return res.status(500).json({ ok: false, error: sErr.message });
				return res.status(200).json({ ok: true, business_hours: hours || [], manual_slots: slots || [] });
			}

			if (req.method === 'PUT') {
				const raw = req.body ?? {};
				const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
				const hours = Array.isArray(body?.business_hours) ? body.business_hours : [];
				if (hours.length !== 7) {
					return res.status(400).json({ ok: false, error: 'business_hours deve conter 7 itens (0=domingo ... 6=sábado)' });
				}
				// Upsert em lote
				const payload = hours.map((h: any) => ({
					weekday: Number(h?.weekday),
					enabled: !!h?.enabled,
					open_time: (String(h?.open_time || '09:00')).length === 5 ? `${h.open_time}:00` : String(h?.open_time || '09:00'),
					close_time: (String(h?.close_time || '20:00')).length === 5 ? `${h.close_time}:00` : String(h?.close_time || '20:00'),
					updated_at: new Date().toISOString(),
				}));
				if (payload.some((p: any) => !(p.weekday >= 0 && p.weekday <= 6))) {
					return res.status(400).json({ ok: false, error: 'weekday inválido' });
				}
				const { error: upErr } = await supabase
					.from('business_hours')
					.upsert(payload, { onConflict: 'weekday' });
				if (upErr) return res.status(500).json({ ok: false, error: upErr.message });
				return res.status(200).json({ ok: true });
			}

			if (req.method === 'POST') {
				const raw = req.body ?? {};
				const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
				const date = String(body?.date || '');
				const time = String(body?.time || '');
				const professional_id = body?.professional_id || null;
				const note = (body?.note || '') as string;
				if (!date || !time) {
					return res.status(400).json({ ok: false, error: 'date e time são obrigatórios' });
				}
				const { data, error: insErr } = await supabase
					.from('manual_slots')
					.insert({
						date,
						time: time.length === 5 ? `${time}:00` : time,
						professional_id,
						note: note || null,
						available: true,
					})
					.select('id')
					.single();
				if (insErr) return res.status(500).json({ ok: false, error: insErr.message });
				return res.status(201).json({ ok: true, id: (data as any)?.id });
			}

			if (req.method === 'DELETE') {
				const raw = req.body ?? {};
				const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
				const id = String(body?.id || '');
				if (!id) return res.status(400).json({ ok: false, error: 'id é obrigatório' });
				const { error: delErr } = await supabase
					.from('manual_slots')
					.delete()
					.eq('id', id);
				if (delErr) return res.status(500).json({ ok: false, error: delErr.message });
				return res.status(200).json({ ok: true });
			}

			res.setHeader('Allow', 'GET, PUT, POST, DELETE');
			return res.status(405).json({ ok: false, error: 'Método não permitido' });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}

