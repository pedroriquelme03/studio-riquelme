// Tipos afrouxados para evitar dependência de @vercel/node em build local
import { Client } from 'pg';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

async function getClient() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('DATABASE_URL não configurada');
	}
	const client = new Client({
		connectionString: databaseUrl,
		ssl: { rejectUnauthorized: false },
	});
	await client.connect();
	return client;
}

export default async function handler(req: any, res: any) {
	if (req.method === 'GET') {
		try {
			// Criar cliente Supabase com credenciais de servidor
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

			// Ler query string com fallback seguro
			const urlObj = new URL(req?.url || '/', 'http://localhost');
			const professionalId = urlObj.searchParams.get('professional_id') || undefined;
			const serviceId = urlObj.searchParams.get('service_id') || undefined;
			const clientQuery = urlObj.searchParams.get('client') || undefined;
			const time = urlObj.searchParams.get('time') || undefined;            // HH:MM
			const timeFrom = urlObj.searchParams.get('time_from') || undefined;   // HH:MM
			const timeTo = urlObj.searchParams.get('time_to') || undefined;       // HH:MM
			const from = urlObj.searchParams.get('from') || undefined;            // yyyy-mm-dd (opcional)
			const to = urlObj.searchParams.get('to') || undefined;                // yyyy-mm-dd (opcional)

			// Montar query base
			let query = supabase
				.from('bookings')
				.select(`
          id,
          date,
          time,
          professional_id,
          clients:client_id ( id, name, phone, email ),
          booking_services (
            quantity,
            services:service_id ( id, name, price, duration_minutes )
          ),
          booking_cancellations ( id )
        `)
				.order('date', { ascending: true })
				.order('time', { ascending: true });

			if (professionalId) {
				query = query.eq('professional_id', professionalId);
			}
			if (from) {
				query = query.gte('date', from);
			}
			if (to) {
				query = query.lte('date', to);
			}
			if (time) {
				query = query.eq('time', `${time}:00`);
			} else {
				if (timeFrom) query = query.gte('time', `${timeFrom}:00`);
				if (timeTo) query = query.lte('time', `${timeTo}:00`);
			}

			const { data, error } = await query;
			if (error) {
				return res.status(500).json({ ok: false, error: error.message });
			}

			// Mapear e aplicar filtros de serviço/cliente no app
			const rows = (data || []).map((b: any) => {
				const services = (b.booking_services || []).map((bs: any) => ({
					id: bs?.services?.id,
					name: bs?.services?.name,
					price: bs?.services?.price,
					duration_minutes: bs?.services?.duration_minutes,
					quantity: bs?.quantity ?? 1,
				})).filter((s: any) => s.id != null);

				const total_price = services.reduce((sum: number, s: any) => sum + Number(s.price || 0) * Number(s.quantity || 1), 0);
				const total_duration_minutes = services.reduce((sum: number, s: any) => sum + Number(s.duration_minutes || 0) * Number(s.quantity || 1), 0);

				return {
					booking_id: b.id,
					date: b.date,
					time: b.time,
					professional_id: b.professional_id,
					client_id: b.clients?.id,
					client_name: b.clients?.name,
					client_phone: b.clients?.phone,
					client_email: b.clients?.email,
					total_price: total_price.toFixed(2),
					total_duration_minutes,
					services,
					is_cancelled: Array.isArray(b.booking_cancellations) && b.booking_cancellations.length > 0,
				};
			});

      const filtered = rows.filter((r: any) => {
        // Ocultar agendamentos cancelados do painel
        if (r.is_cancelled) return false;
				if (serviceId && !(r.services || []).some((s: any) => String(s.id) === String(serviceId))) {
					return false;
				}
				if (clientQuery) {
          const q = clientQuery.toLowerCase();
          const hay = `${r.client_name || ''} ${r.client_email || ''} ${r.client_phone || ''}`.toLowerCase();
          // Busca textual
          let match = hay.includes(q);
          // Busca por telefone normalizado (apenas dígitos)
          const qDigits = q.replace(/\D/g, '');
          if (!match && qDigits) {
            const hayDigits = String(r.client_phone || '').replace(/\D/g, '');
            match = hayDigits.includes(qDigits);
          }
          if (!match) return false;
				}
				return true;
			});

			return res.status(200).json({ ok: true, bookings: filtered });
		} catch (err: any) {
			return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
		}
	}

	if (req.method === 'POST') {
		try {
			// Parse robusto do corpo (Vercel pode entregar string ou objeto)
			const raw = (req.body ?? {}) as unknown;
			const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;

			const body = (parsed || {}) as {
				date?: string; // yyyy-mm-dd
				time?: string; // HH:MM or HH:MM:SS
				professional_id?: string | null;
				client?: { name?: string; email?: string; phone?: string; notes?: string | null };
				services?: Array<{ id: number; quantity?: number }>;
			};

			const date = body.date;
			const timeRaw = body.time;
			const professionalId = body.professional_id ?? null;
			const clientPayload = body.client || {};
			const services = body.services || [];

			if (!date || !timeRaw) {
				return res.status(400).json({ ok: false, error: 'date e time são obrigatórios' });
			}
			if (!clientPayload.name || !clientPayload.phone) {
				return res.status(400).json({ ok: false, error: 'client.name e client.phone são obrigatórios' });
			}
			// Se não houver email, usar telefone como fallback para compatibilidade
			const clientEmail = clientPayload.email || `whatsapp_${clientPayload.phone.replace(/\D/g, '')}@temp.local`;
			if (!services.length) {
				return res.status(400).json({ ok: false, error: 'services não pode ser vazio' });
			}

			const time = timeRaw.length === 5 ? `${timeRaw}:00` : timeRaw;

			// Supabase server client (usa service role se disponível)
			const supabaseUrl =
				process.env.SUPABASE_URL ||
				process.env.VITE_SUPABASE_URL;
			const supabaseKey =
				process.env.SUPABASE_SERVICE_ROLE_KEY || // recomendado para server
				process.env.VITE_SUPABASE_ANON_KEY;

			if (!supabaseUrl || !supabaseKey) {
				return res.status(500).json({
					ok: false,
					code: 'SUPABASE_ENV_MISSING',
					error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados',
				});
			}

			const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

			// validar profissional (se informado)
			if (professionalId) {
				const { data: prof, error: profErr } = await supabase
					.from('professionals')
					.select('id')
					.eq('id', professionalId)
					.limit(1)
					.single();
				if (profErr || !prof) {
					return res.status(400).json({
						ok: false,
						code: 'PROFESSIONAL_NOT_FOUND',
						error: `Profissional não encontrado: ${professionalId}`,
					});
				}
			}

			// validar serviços e coletar profissional responsável por serviço (quando existir)
			const serviceIds = services.map(s => s.id);
			let inferredProfessionalId: string | null = null;
			if (serviceIds.length) {
				const { data: foundServices, error: svcErr } = await supabase
					.from('services')
					.select('id, responsible_professional_id')
					.in('id', serviceIds);
				if (svcErr) {
					return res.status(500).json({ ok: false, error: svcErr.message });
				}
				const foundIds = new Set<number>((foundServices || []).map(r => Number(r.id)));
				const missing = serviceIds.filter(id => !foundIds.has(Number(id)));
				if (missing.length) {
					return res.status(400).json({
						ok: false,
						code: 'SERVICES_NOT_FOUND',
						error: `IDs de serviços inexistentes: ${missing.join(', ')}`,
						details: { sent: serviceIds, found: Array.from(foundIds) }
					});
				}
				// inferir profissional se não foi passado e todos os serviços apontam para o mesmo responsável não-nulo
				const distinctPros = Array.from(new Set((foundServices || [])
					.map((r: any) => r.responsible_professional_id)
					.filter((v: any) => v != null)));
				if (!professionalId) {
					if (distinctPros.length === 1) {
						inferredProfessionalId = String(distinctPros[0]);
					} else if (distinctPros.length > 1) {
						return res.status(400).json({
							ok: false,
							code: 'SERVICES_WITH_DIFFERENT_PROFESSIONALS',
							error: 'Os serviços selecionados possuem profissionais responsáveis diferentes. Escolha um profissional.',
							details: { serviceIds, distinctPros }
						});
					}
				}
			}

			// obter ou criar cliente por telefone (agora é o identificador principal)
			let clientId: string | null = null;
			const { data: existingClient, error: findClientErr } = await supabase
				.from('clients')
				.select('id')
				.eq('phone', clientPayload.phone)
				.limit(1)
				.single();
			if (existingClient?.id) {
				clientId = existingClient.id as unknown as string;
				// atualizar dados básicos
				await supabase
					.from('clients')
					.update({
						name: clientPayload.name,
						phone: clientPayload.phone,
						email: clientEmail,
						notes: clientPayload.notes ?? null,
						updated_at: new Date().toISOString(),
					})
					.eq('id', clientId);
			} else {
				const { data: insertedClient, error: insClientErr } = await supabase
					.from('clients')
					.insert({
						name: clientPayload.name,
						phone: clientPayload.phone,
						email: clientEmail,
						notes: clientPayload.notes ?? null,
					})
					.select('id')
					.single();
				if (insClientErr) {
					return res.status(500).json({ ok: false, error: insClientErr.message });
				}
				clientId = (insertedClient as any).id as string;
			}

			// criar booking
			const { data: bookingData, error: bookingErr } = await supabase
				.from('bookings')
				.insert({
					date,
					time,
					professional_id: professionalId || inferredProfessionalId,
					client_id: clientId,
				})
				.select('id')
				.single();
			if (bookingErr) {
				return res.status(500).json({ ok: false, error: bookingErr.message });
			}
			const bookingId = (bookingData as any).id as string;

			// inserir serviços
			const rows = services.map(s => ({
				booking_id: bookingId,
				service_id: s.id,
				quantity: s.quantity ?? 1,
			}));
			if (rows.length) {
				const { error: bsErr } = await supabase
					.from('booking_services')
					.insert(rows);
				if (bsErr) {
					return res.status(500).json({ ok: false, error: bsErr.message });
				}
			}

			return res.status(201).json({ ok: true, booking_id: bookingId });
		} catch (err: any) {
			return res.status(500).json({
				ok: false,
				error: err?.message || 'Erro inesperado',
			});
		}
	}

	if (req.method === 'PUT') {
		try {
			const raw = req.body ?? {};
			const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
			const body = (parsed || {}) as {
				booking_id?: string;
				status?: string; // 'completed', 'cancelled', etc.
			};

			const bookingId = body.booking_id;
			const status = body.status;

			if (!bookingId) {
				return res.status(400).json({ ok: false, error: 'booking_id é obrigatório' });
			}
			if (!status) {
				return res.status(400).json({ ok: false, error: 'status é obrigatório' });
			}

			const supabaseUrl =
				process.env.SUPABASE_URL ||
				process.env.VITE_SUPABASE_URL;
			const supabaseKey =
				process.env.SUPABASE_SERVICE_ROLE_KEY ||
				process.env.VITE_SUPABASE_ANON_KEY;
			if (!supabaseUrl || !supabaseKey) {
				return res.status(500).json({
					ok: false,
					error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados',
				});
			}

			const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

			// Buscar dados completos do agendamento
			const { data: bookingData, error: bookingErr } = await supabase
				.from('bookings')
				.select(`
					id,
					date,
					time,
					professional_id,
					clients:client_id ( id, name, phone, email ),
					professionals:professional_id ( id, name, phone, email ),
					booking_services (
						quantity,
						services:service_id ( id, name, price, duration_minutes )
					)
				`)
				.eq('id', bookingId)
				.single();

			if (bookingErr || !bookingData) {
				return res.status(404).json({ ok: false, error: 'Agendamento não encontrado' });
			}

			// Atualizar status do agendamento
			// Nota: Se a tabela não tiver coluna 'status', você precisará adicioná-la no Supabase
			// Por enquanto, vamos usar uma coluna 'completed_at' ou similar
			const updateData: any = {
				updated_at: new Date().toISOString(),
			};

			// Se o status for 'completed', adicionar timestamp de conclusão
			if (status === 'completed') {
				updateData.completed_at = new Date().toISOString();
			}
			// Se o status for 'cancelled', adicionar timestamp de cancelamento (se a coluna existir)
			if (status === 'cancelled') {
				updateData.cancelled_at = new Date().toISOString();
			}

			const { error: updateErr } = await supabase
				.from('bookings')
				.update(updateData)
				.eq('id', bookingId);

			if (updateErr) {
				// Se a coluna não existir, apenas logamos o erro mas continuamos
				console.warn('Erro ao atualizar status (coluna pode não existir):', updateErr.message);
			}

			// Registrar cancelamento em booking_cancellations (histórico)
			if (status === 'cancelled') {
				try {
					const cancelledBy = (body as any)?.cancelled_by || 'client';
					await supabase
						.from('booking_cancellations')
						.insert({
							booking_id: bookingId,
							cancelled_by: cancelledBy,
						});
				} catch {}
			}

			// Removido: envio de mensagens WhatsApp ao marcar como concluído

			return res.status(200).json({ ok: true, message: 'Status atualizado com sucesso' });
		} catch (err: any) {
			return res.status(500).json({
				ok: false,
				error: err?.message || 'Erro inesperado',
			});
		}
	}

	if (req.method === 'PATCH') {
		// Reagendar (trocar data/hora) de um agendamento existente
		try {
			const raw = req.body ?? {};
			const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
			const body = (parsed || {}) as {
				action?: string;
				booking_id?: string;
				date?: string; // yyyy-mm-dd
				time?: string; // HH:MM or HH:MM:SS
			};

			if ((body.action || '').toLowerCase() !== 'reschedule') {
				return res.status(400).json({ ok: false, error: 'Ação inválida. Use action=reschedule' });
			}

			const bookingId = body.booking_id;
			const date = body.date;
			const timeRaw = body.time;

			if (!bookingId) {
				return res.status(400).json({ ok: false, error: 'booking_id é obrigatório' });
			}
			if (!date || !timeRaw) {
				return res.status(400).json({ ok: false, error: 'date e time são obrigatórios' });
			}

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

			const time = timeRaw.length === 5 ? `${timeRaw}:00` : timeRaw;

			const { error: updateErr } = await supabase
				.from('bookings')
				.update({ date, time, updated_at: new Date().toISOString() })
				.eq('id', bookingId);

			if (updateErr) {
				return res.status(500).json({ ok: false, error: updateErr.message });
			}

			// Registrar histórico de reagendamento quando feito diretamente pelo admin
			try {
				await supabase
					.from('reschedule_requests')
					.insert({
						booking_id: bookingId,
						requested_date: date,
						requested_time: time,
						status: 'approved',
						response_note: 'Ajustado pelo profissional',
						responded_at: new Date().toISOString(),
					});
			} catch {}

			return res.status(200).json({ ok: true, message: 'Agendamento reagendado com sucesso' });
		} catch (err: any) {
			return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
		}
	}

	res.setHeader('Allow', 'GET, POST, PUT');
	return res.status(405).json({ ok: false, error: 'Método não permitido' });
}

