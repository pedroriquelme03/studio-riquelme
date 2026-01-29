// API para contatos do rodapé (WhatsApp e endereço)
// GET: retorna contact1_name, contact1_phone, contact2_name, contact2_phone, address
// PUT: atualiza (body com os mesmos campos)

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const KEYS = [
  'footer_contact1_name',
  'footer_contact1_phone',
  'footer_contact2_name',
  'footer_contact2_phone',
  'footer_address',
] as const;

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
    if (req.method !== 'GET' && req.method !== 'PUT') {
      res.setHeader('Allow', 'GET, PUT');
      return res.status(405).json({ ok: false, error: 'Método não permitido' });
    }

    const supabase = getSupabaseServer();

    if (req.method === 'GET') {
      const { data: rows, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [...KEYS]);

      if (error) return res.status(500).json({ ok: false, error: error.message });

      const map: Record<string, string> = {};
      (rows || []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value || ''; });

      return res.status(200).json({
        ok: true,
        contact1_name: map.footer_contact1_name || '',
        contact1_phone: map.footer_contact1_phone || '',
        contact2_name: map.footer_contact2_name || '',
        contact2_phone: map.footer_contact2_phone || '',
        address: map.footer_address || '',
      });
    }

    if (req.method === 'PUT') {
      const raw = req.body ?? {};
      const body = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;

      const contact1_name = String(body?.contact1_name ?? '').trim();
      const contact1_phone = String(body?.contact1_phone ?? '').trim();
      const contact2_name = String(body?.contact2_name ?? '').trim();
      const contact2_phone = String(body?.contact2_phone ?? '').trim();
      const address = String(body?.address ?? '').trim();

      const toUpsert = [
        { key: 'footer_contact1_name', value: contact1_name },
        { key: 'footer_contact1_phone', value: contact1_phone },
        { key: 'footer_contact2_name', value: contact2_name },
        { key: 'footer_contact2_phone', value: contact2_phone },
        { key: 'footer_address', value: address },
      ];

      for (const row of toUpsert) {
        const { error: err } = await supabase
          .from('system_settings')
          .upsert({ key: row.key, value: row.value }, { onConflict: 'key' });
        if (err) return res.status(500).json({ ok: false, error: err.message });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
  }
}
