// API para configurar horários usando Supabase (service role)
// - GET: lista business_hours (por professional_id se fornecido), manual_slots e booking_limit_month
// - PUT: upsert de business_hours (7 dias) para um professional_id e booking_limit_month (opcional, 'YYYY-MM')
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
				const urlObj = new URL(req?.url || '/', 'http://localhost');
				const professionalId = urlObj.searchParams.get('professional_id') || null;
				
				// Buscar horários: se professional_id fornecido, buscar desse profissional; senão, buscar globais (professional_id IS NULL)
				let hoursQuery = supabase
					.from('business_hours')
					.select('id, weekday, enabled, open_time, close_time, professional_id')
					.order('weekday', { ascending: true });
				
				if (professionalId) {
					hoursQuery = hoursQuery.eq('professional_id', professionalId);
				} else {
					hoursQuery = hoursQuery.is('professional_id', null);
				}
				
				const { data: hours, error: hErr } = await hoursQuery;
				
				const { data: slots, error: sErr } = await supabase
					.from('manual_slots')
					.select('id, date, time, professional_id, note, available, created_at')
					.order('date', { ascending: true })
					.order('time', { ascending: true });
				const { data: setting, error: setErr } = await supabase
					.from('system_settings')
					.select('key, value')
					.eq('key', 'booking_limit_month')
					.single();
				if (hErr) return res.status(500).json({ ok: false, error: hErr.message });
				if (sErr) return res.status(500).json({ ok: false, error: sErr.message });
				if (setErr && setErr.code !== 'PGRST116') {
					// ignore missing row error
					console.warn('settings read error', setErr.message);
				}
				return res.status(200).json({
					ok: true,
					business_hours: hours || [],
					manual_slots: slots || [],
					booking_limit_month: setting?.value || null
				});
			}

			if (req.method === 'PUT') {
				const raw = req.body ?? {};
				const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
				const hours = Array.isArray(body?.business_hours) ? body.business_hours : [];
				const professionalId = body?.professional_id || null; // UUID do profissional ou null para horários globais
				const limitMonth = (body?.booking_limit_month || '').toString(); // 'YYYY-MM' ou ''
				if (hours.length !== 7) {
					return res.status(400).json({ ok: false, error: 'business_hours deve conter 7 itens (0=domingo ... 6=sábado)' });
				}
				
				// Validar professional_id se fornecido
				if (professionalId) {
					const { data: prof, error: profErr } = await supabase
						.from('professionals')
						.select('id')
						.eq('id', professionalId)
						.single();
					if (profErr || !prof) {
						return res.status(400).json({ ok: false, error: 'Profissional não encontrado' });
					}
				}
				
				// Remover horários antigos do profissional (se houver)
				if (professionalId) {
					const { error: delErr } = await supabase
						.from('business_hours')
						.delete()
						.eq('professional_id', professionalId);
					if (delErr) {
						console.warn('Erro ao remover horários antigos:', delErr.message);
					}
				} else {
					// Se for null, remover horários globais antigos
					const { error: delErr } = await supabase
						.from('business_hours')
						.delete()
						.is('professional_id', null);
					if (delErr) {
						console.warn('Erro ao remover horários globais antigos:', delErr.message);
					}
				}
				
				// Upsert em lote
				const payload = hours.map((h: any) => ({
					weekday: Number(h?.weekday),
					enabled: !!h?.enabled,
					open_time: (String(h?.open_time || '09:00')).length === 5 ? `${h.open_time}:00` : String(h?.open_time || '09:00'),
					close_time: (String(h?.close_time || '20:00')).length === 5 ? `${h.close_time}:00` : String(h?.close_time || '20:00'),
					professional_id: professionalId,
					updated_at: new Date().toISOString(),
				}));
				if (payload.some((p: any) => !(p.weekday >= 0 && p.weekday <= 6))) {
					return res.status(400).json({ ok: false, error: 'weekday inválido' });
				}
				const { error: upErr } = await supabase
					.from('business_hours')
					.insert(payload);
				if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

				// Salvar mês limite opcionalmente
				if (limitMonth) {
					// validar formato YYYY-MM simples
					const okFmt = /^\d{4}-\d{2}$/.test(limitMonth);
					if (!okFmt) return res.status(400).json({ ok: false, error: 'booking_limit_month deve ser no formato YYYY-MM' });
					const { error: setErr } = await supabase
						.from('system_settings')
						.upsert({ key: 'booking_limit_month', value: limitMonth }, { onConflict: 'key' });
					if (setErr) return res.status(500).json({ ok: false, error: setErr.message });
				}

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

