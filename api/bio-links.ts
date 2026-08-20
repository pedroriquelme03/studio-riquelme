// API dos botões da página /bio (link-in-bio).
// - GET            : público, retorna botões ativos + cabeçalho (título/descrição)
// - GET ?all=1     : admin, retorna todos os botões (inclusive inativos)
// - POST           : admin, cria um botão
// - PUT            : admin, atualiza um botão | cabeçalho (type:'header') | ordem (action:'reorder')
// - DELETE ?id=... : admin, remove um botão

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from './_lib/session.js';

function getSupabaseServer() {
	const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
	const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseKey) {
		throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados');
	}
	return createSupabaseClient(supabaseUrl, supabaseKey);
}

const HEADER_KEYS = ['bio_title', 'bio_subtitle'] as const;
const ALLOWED_ICONS = ['calendar', 'whatsapp', 'location', 'link', 'instagram'];
const ALLOWED_KINDS = ['link', 'header'];

/** Grava uma configuração sem depender de ON CONFLICT (mesmo padrão de schedule-settings). */
async function setSetting(supabase: any, key: string, value: string): Promise<string | null> {
	const { data: updated, error: updErr } = await supabase
		.from('system_settings')
		.update({ value })
		.eq('key', key)
		.select('key');
	if (updErr) return updErr.message;
	if (updated?.length) return null;
	const { error: insErr } = await supabase.from('system_settings').insert({ key, value });
	return insErr ? insErr.message : null;
}

function parseBody(req: any): any {
	const raw = req.body ?? {};
	return typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
}

export default async function handler(req: any, res: any) {
	try {
		// GET é público (a página /bio lista os botões). Escritas exigem admin.
		if (req.method !== 'GET' && !requireAdmin(req, res)) return;

		const supabase = getSupabaseServer();
		const urlObj = new URL(req?.url || '/', 'http://localhost');

		if (req.method === 'GET') {
			const wantAll = urlObj.searchParams.get('all') === '1';
			// A visão do admin (todos os itens, inclusive inativos) exige sessão.
			if (wantAll && !requireAdmin(req, res)) return;

			let query = supabase
				.from('bio_links')
				.select('id, kind, title, subtitle, url, icon, sort_order, is_active')
				.order('sort_order', { ascending: true });
			if (!wantAll) query = query.eq('is_active', true);

			const { data: links, error } = await query;
			if (error) return res.status(500).json({ ok: false, error: error.message });

			const { data: rows } = await supabase
				.from('system_settings')
				.select('key, value')
				.in('key', [...HEADER_KEYS]);
			const map: Record<string, string> = {};
			(rows || []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value || ''; });

			return res.status(200).json({
				ok: true,
				title: map.bio_title || 'Studio Riquelme',
				subtitle: map.bio_subtitle || '',
				links: (links || []).map((l: any) => ({
					id: l.id,
					kind: l.kind,
					title: l.title,
					subtitle: l.subtitle || '',
					url: l.url || '',
					icon: l.icon || 'link',
					sortOrder: l.sort_order,
					isActive: l.is_active,
				})),
			});
		}

		if (req.method === 'POST') {
			const body = parseBody(req);
			const kind = ALLOWED_KINDS.includes(body?.kind) ? body.kind : 'link';
			const title = String(body?.title ?? '').trim();
			if (!title) return res.status(400).json({ ok: false, error: 'title é obrigatório' });
			const icon = ALLOWED_ICONS.includes(body?.icon) ? body.icon : 'link';

			// Novo item vai para o fim da lista.
			const { data: last } = await supabase
				.from('bio_links')
				.select('sort_order')
				.order('sort_order', { ascending: false })
				.limit(1);
			const nextOrder = ((last?.[0]?.sort_order as number) ?? 0) + 10;

			const { data, error } = await supabase
				.from('bio_links')
				.insert({
					kind,
					title,
					subtitle: kind === 'header' ? null : (String(body?.subtitle ?? '').trim() || null),
					url: kind === 'header' ? null : (String(body?.url ?? '').trim() || null),
					icon,
					sort_order: nextOrder,
					is_active: body?.isActive !== false,
				})
				.select('id')
				.single();
			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(201).json({ ok: true, id: data?.id });
		}

		if (req.method === 'PUT') {
			const body = parseBody(req);

			// Atualização do cabeçalho da página.
			if (body?.type === 'header') {
				const title = String(body?.title ?? '').trim();
				const subtitle = String(body?.subtitle ?? '').trim();
				for (const row of [
					{ key: 'bio_title', value: title },
					{ key: 'bio_subtitle', value: subtitle },
				]) {
					const err = await setSetting(supabase, row.key, row.value);
					if (err) return res.status(500).json({ ok: false, error: err });
				}
				return res.status(200).json({ ok: true });
			}

			// Reordenação: recebe lista de ids na nova ordem.
			if (body?.action === 'reorder') {
				const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
				if (!ids.length) return res.status(400).json({ ok: false, error: 'ids é obrigatório' });
				let order = 10;
				for (const id of ids) {
					const { error } = await supabase
						.from('bio_links')
						.update({ sort_order: order, updated_at: new Date().toISOString() })
						.eq('id', id);
					if (error) return res.status(500).json({ ok: false, error: error.message });
					order += 10;
				}
				return res.status(200).json({ ok: true });
			}

			// Atualização de um botão.
			const id = String(body?.id ?? '').trim();
			if (!id) return res.status(400).json({ ok: false, error: 'id é obrigatório' });
			const kind = ALLOWED_KINDS.includes(body?.kind) ? body.kind : 'link';
			const title = String(body?.title ?? '').trim();
			if (!title) return res.status(400).json({ ok: false, error: 'title é obrigatório' });
			const icon = ALLOWED_ICONS.includes(body?.icon) ? body.icon : 'link';

			const { error } = await supabase
				.from('bio_links')
				.update({
					kind,
					title,
					subtitle: kind === 'header' ? null : (String(body?.subtitle ?? '').trim() || null),
					url: kind === 'header' ? null : (String(body?.url ?? '').trim() || null),
					icon,
					is_active: body?.isActive !== false,
					updated_at: new Date().toISOString(),
				})
				.eq('id', id);
			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(200).json({ ok: true });
		}

		if (req.method === 'DELETE') {
			const id = urlObj.searchParams.get('id') || parseBody(req)?.id || '';
			if (!id) return res.status(400).json({ ok: false, error: 'id é obrigatório' });
			const { error } = await supabase.from('bio_links').delete().eq('id', String(id));
			if (error) return res.status(500).json({ ok: false, error: error.message });
			return res.status(200).json({ ok: true });
		}

		res.setHeader('Allow', 'GET, POST, PUT, DELETE');
		return res.status(405).json({ ok: false, error: 'Método não permitido' });
	} catch (err: any) {
		return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
	}
}
