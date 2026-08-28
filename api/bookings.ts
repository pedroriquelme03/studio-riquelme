// Tipos afrouxados para evitar dependência de @vercel/node em build local
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSession, requireAdmin } from './_lib/session.js';
import { sendWhatsAppText, waMessages, formatDateToPtBr, formatTimeToHHMM } from './_lib/whatsapp.js';
import {
	assertBookingSlotAvailable,
	getBookingDurationForId,
	getServicesDurationMinutes,
} from './_lib/booking-conflicts.js';
import { getBookingServicesDurationMinutes } from './_lib/time-slots.js';
import {
	buildPromotionSegments,
	getPromotionAvailableSlots,
	getPromotionGroupBookingIds,
	isPromotionValidOnDate,
	loadPromotionWithItems,
	validatePromotionSequence,
} from './_lib/promotions.js';
import { resolveBookingServicePrice } from './_lib/price-variations.js';
import { reservePlanBenefit, consumePlanBenefitForBooking, releasePlanBenefitForBooking } from './_lib/monthly-plans.js';
import { randomUUID } from 'crypto';

export default async function handler(req: any, res: any) {
	const sendJson = (status: number, body: object) => {
		try {
			res.status(status).json(body);
		} catch (_) {
			res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));
		}
	};

	if (req.method === 'GET') {
		try {
			const urlObj = new URL(req?.url || '/', 'http://localhost');

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

			const professionalId = urlObj.searchParams.get('professional_id') || undefined;
			const serviceId = urlObj.searchParams.get('service_id') || undefined;
			const time = urlObj.searchParams.get('time') || undefined;            // HH:MM
			const timeFrom = urlObj.searchParams.get('time_from') || undefined;   // HH:MM
			const timeTo = urlObj.searchParams.get('time_to') || undefined;       // HH:MM
			const from = urlObj.searchParams.get('from') || undefined;            // yyyy-mm-dd
			const to = urlObj.searchParams.get('to') || undefined;                // yyyy-mm-dd

			// Quem está pedindo define o escopo. São três modos distintos:
			//  - admin     → tudo, com os filtros da query string
			//  - cliente   → apenas os próprios agendamentos
			//  - anônimo   → apenas ocupação de horários, sem nenhum dado pessoal
			const session = getSession(req);
			const isAdmin = session?.role === 'admin';
			const isClient = session?.role === 'client';

			// O parâmetro `client` era uma busca textual livre aberta a qualquer um:
			// agora só o admin pode usá-lo. O cliente é sempre escopado pela sessão.
			const clientQuery = isAdmin ? urlObj.searchParams.get('client') || undefined : undefined;

			// `availability=1` é sempre atendido no modo público, mesmo com sessão:
			// o calendário precisa enxergar a ocupação de TODOS, não só a do usuário.
			const wantsAvailability = urlObj.searchParams.get('availability') === '1';
			const wantsPromotionSlots = urlObj.searchParams.get('promotion_slots') === '1';
			const wantsValidateSlot = urlObj.searchParams.get('validate_slot') === '1';

			if (wantsValidateSlot) {
				const date = urlObj.searchParams.get('date') || '';
				const timeRaw = urlObj.searchParams.get('time') || '';
				const serviceId = Number(urlObj.searchParams.get('service_id') || '0');
				const professionalId = urlObj.searchParams.get('professional_id') || null;
				if (!date || !timeRaw || !serviceId) {
					return res.status(400).json({ ok: false, error: 'date, time e service_id são obrigatórios' });
				}
				const time = timeRaw.length === 5 ? `${timeRaw}:00` : timeRaw;
				const durationMinutes = await getServicesDurationMinutes(supabase, [{ id: serviceId, quantity: 1 }]);
				try {
					await assertBookingSlotAvailable(supabase, {
						date,
						time,
						professionalId,
						durationMinutes,
					});
					return res.status(200).json({ ok: true, available: true });
				} catch (slotErr: any) {
					if (slotErr?.code === 'SLOT_UNAVAILABLE') {
						return res.status(200).json({ ok: true, available: false, error: slotErr.message });
					}
					throw slotErr;
				}
			}

			if (wantsPromotionSlots) {
				const promotionId = urlObj.searchParams.get('promotion_id') || '';
				const date = urlObj.searchParams.get('date') || '';
				if (!promotionId || !date) {
					return res.status(400).json({ ok: false, error: 'promotion_id e date são obrigatórios' });
				}
				const promotion = await loadPromotionWithItems(supabase, promotionId);
				if (!promotion) return res.status(404).json({ ok: false, error: 'Promoção não encontrada' });
				if (!isPromotionValidOnDate(promotion, date)) {
					return res.status(200).json({ ok: true, slots: [] });
				}
				const slots = await getPromotionAvailableSlots(supabase, promotion, date);
				return res.status(200).json({ ok: true, slots });
			}

			if (wantsAvailability || (!isAdmin && !isClient)) {
				// Modo disponibilidade: exige uma janela de datas explícita e devolve
				// somente o necessário para calcular slots livres — sem dado pessoal.
				if (!from || !to) {
					return res.status(wantsAvailability ? 400 : 401).json({
						ok: false,
						error: wantsAvailability ? 'from e to são obrigatórios' : 'Não autorizado',
					});
				}
				const fromDate = new Date(`${from}T00:00:00Z`);
				const toDate = new Date(`${to}T00:00:00Z`);
				if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || toDate < fromDate) {
					return res.status(400).json({ ok: false, error: 'Intervalo de datas inválido' });
				}
				const rangeDays = (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);
				if (rangeDays > 92) {
					return res.status(400).json({ ok: false, error: 'Intervalo máximo de 92 dias' });
				}

				let availabilityQuery = supabase
					.from('bookings')
					.select(`
          id,
          date,
          time,
          professional_id,
          booking_services ( quantity, services:service_id ( duration_minutes ) ),
          booking_cancellations ( id )
        `)
					.gte('date', from)
					.lte('date', to)
					.order('date', { ascending: true })
					.order('time', { ascending: true });

				if (professionalId) {
					availabilityQuery = availabilityQuery.eq('professional_id', professionalId);
				}

				const { data, error } = await availabilityQuery;
				if (error) return res.status(500).json({ ok: false, error: error.message });

				const slots = (data || [])
					.filter((b: any) => !(Array.isArray(b.booking_cancellations) && b.booking_cancellations.length > 0))
					.map((b: any) => ({
						date: b.date,
						time: b.time,
						professional_id: b.professional_id,
						total_duration_minutes: getBookingServicesDurationMinutes(b.booking_services || []),
					}));

				return res.status(200).json({ ok: true, bookings: slots });
			}

			let query = supabase
				.from('bookings')
				.select(`
          id,
          date,
          time,
          professional_id,
          promotion_id,
          promotion_group_id,
          segment_order,
          allocated_price,
          clients:client_id ( id, name, phone, email ),
          booking_services (
            quantity,
            unit_price,
            variation_type,
            variant_key,
            variant_label,
            services:service_id ( id, name, price, duration_minutes )
          ),
          booking_cancellations ( id )
        `)
				.order('date', { ascending: true })
				.order('time', { ascending: true });

			// Escopo obrigatório do cliente: filtrado no banco, não em memória.
			if (isClient) {
				query = query.eq('client_id', (session as any).sub);
			}

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

			const rows = (data || []).map((b: any) => {
				const services = (b.booking_services || []).map((bs: any) => ({
					id: bs?.services?.id,
					name: bs?.services?.name,
					price: bs?.unit_price != null ? Number(bs.unit_price) : bs?.services?.price,
					duration_minutes: bs?.services?.duration_minutes,
					quantity: bs?.quantity ?? 1,
					variation_type: bs?.variation_type || null,
					variant_key: bs?.variant_key || null,
					variant_label: bs?.variant_label || null,
				})).filter((s: any) => s.id != null);

				const total_price = services.reduce((sum: number, s: any) => sum + Number(s.price || 0) * Number(s.quantity || 1), 0);
				const total_duration_minutes = services.reduce((sum: number, s: any) => sum + Number(s.duration_minutes || 0) * Number(s.quantity || 1), 0);

				return {
					booking_id: b.id,
					date: b.date,
					time: b.time,
					professional_id: b.professional_id,
					promotion_id: b.promotion_id || null,
					promotion_group_id: b.promotion_group_id || null,
					segment_order: b.segment_order ?? null,
					allocated_price: b.allocated_price != null ? Number(b.allocated_price) : null,
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
				// O cliente vê o próprio histórico, inclusive cancelados.
				// A listagem administrativa esconde cancelados (eles têm aba própria).
				if (isAdmin && !clientQuery && r.is_cancelled) return false;
				if (serviceId && !(r.services || []).some((s: any) => String(s.id) === String(serviceId))) {
					return false;
				}
				if (clientQuery) {
					const q = clientQuery.toLowerCase();
					const hay = `${r.client_name || ''} ${r.client_email || ''} ${r.client_phone || ''}`.toLowerCase();
					let match = hay.includes(q);
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
			sendJson(500, { ok: false, error: err?.message || 'Erro inesperado (GET)' });
			return;
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
				promotion_id?: string;
				client?: { name?: string; email?: string; phone?: string; notes?: string | null };
				services?: Array<{ id: number; quantity?: number }>;
			};

			const date = body.date;
			const timeRaw = body.time;
			const professionalId = body.professional_id ?? null;
			const promotionId = body.promotion_id ? String(body.promotion_id) : '';
			const clientPayload = body.client || {};
			const services = body.services || [];

			if (!date || !timeRaw) {
				return res.status(400).json({ ok: false, error: 'date e time são obrigatórios' });
			}
			if (!clientPayload.name || !clientPayload.phone) {
				return res.status(400).json({ ok: false, error: 'client.name e client.phone são obrigatórios' });
			}
			const clientEmail = clientPayload.email || `whatsapp_${clientPayload.phone.replace(/\D/g, '')}@temp.local`;
			const time = timeRaw.length === 5 ? `${timeRaw}:00` : timeRaw;

			const supabaseUrl =
				process.env.SUPABASE_URL ||
				process.env.VITE_SUPABASE_URL;
			const supabaseKey =
				process.env.SUPABASE_SERVICE_ROLE_KEY ||
				process.env.VITE_SUPABASE_ANON_KEY;

			if (!supabaseUrl || !supabaseKey) {
				return res.status(500).json({
					ok: false,
					code: 'SUPABASE_ENV_MISSING',
					error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados',
				});
			}

			const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

			// ── Agendamento de promoção (sequência multi-profissional) ──────────
			if (promotionId) {
				const promotion = await loadPromotionWithItems(supabase, promotionId);
				if (!promotion) return res.status(404).json({ ok: false, error: 'Promoção não encontrada' });
				if (!isPromotionValidOnDate(promotion, date)) {
					return res.status(400).json({ ok: false, error: 'Promoção não válida nesta data' });
				}
				const items = promotion.items || [];
				const segments = buildPromotionSegments(
					items,
					Number(promotion.total_price),
					Number(promotion.gap_minutes || 0),
					time,
				);
				const conflict = await validatePromotionSequence(supabase, date, segments);
				if (conflict) {
					return res.status(409).json({ ok: false, code: 'SLOT_UNAVAILABLE', error: conflict });
				}

				let clientId: string | null = null;
				const { data: existingClient } = await supabase
					.from('clients')
					.select('id')
					.eq('phone', clientPayload.phone)
					.limit(1)
					.single();
				if (existingClient?.id) {
					clientId = existingClient.id as string;
					await supabase.from('clients').update({
						name: clientPayload.name,
						phone: clientPayload.phone,
						email: clientEmail,
						notes: clientPayload.notes ?? null,
						updated_at: new Date().toISOString(),
					}).eq('id', clientId);
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
					if (insClientErr) return res.status(500).json({ ok: false, error: insClientErr.message });
					clientId = (insertedClient as any).id as string;
				}

				const groupId = randomUUID();
				const bookingIds: string[] = [];

				for (const segment of segments) {
					const { data: bookingData, error: bookingErr } = await supabase
						.from('bookings')
						.insert({
							date,
							time: segment.time,
							professional_id: segment.professionalId,
							client_id: clientId,
							promotion_id: promotionId,
							promotion_group_id: groupId,
							segment_order: segment.sortOrder,
							allocated_price: segment.allocatedPrice,
						})
						.select('id')
						.single();
					if (bookingErr) return res.status(500).json({ ok: false, error: bookingErr.message });
					const bookingId = (bookingData as any).id as string;
					bookingIds.push(bookingId);

					const { error: bsErr } = await supabase.from('booking_services').insert({
						booking_id: bookingId,
						service_id: segment.serviceId,
						quantity: 1,
						unit_price: segment.allocatedPrice,
					});
					if (bsErr) return res.status(500).json({ ok: false, error: bsErr.message });
				}

				try {
					const serviceNames = items.map((item: any) => {
						const svc = item.services;
						return Array.isArray(svc) ? svc[0]?.name : svc?.name;
					}).filter(Boolean).join(' → ') || promotion.name;
					const dataBr = formatDateToPtBr(date);
					const horaBr = formatTimeToHHMM(time);
					sendWhatsAppText(
						clientPayload.phone!,
						waMessages.bookingRequestClient({ nome: clientPayload.name!, servico: `Promoção: ${promotion.name} (${serviceNames})`, data: dataBr, hora: horaBr }),
					).catch(() => {});
				} catch { /* silencioso */ }

				return res.status(201).json({
					ok: true,
					booking_id: bookingIds[0],
					promotion_group_id: groupId,
					booking_ids: bookingIds,
				});
			}

			if (!services.length) {
				return res.status(400).json({ ok: false, error: 'services não pode ser vazio' });
			}

			// ── Agendamento padrão (serviços avulsos) ───────────────────────────
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

			const finalProfessionalId = professionalId || inferredProfessionalId;
			const durationMinutes = await getServicesDurationMinutes(supabase, services);
			try {
				await assertBookingSlotAvailable(supabase, {
					date,
					time,
					professionalId: finalProfessionalId,
					durationMinutes,
				});
			} catch (slotErr: any) {
				if (slotErr?.code === 'SLOT_UNAVAILABLE') {
					return res.status(409).json({ ok: false, code: 'SLOT_UNAVAILABLE', error: slotErr.message });
				}
				throw slotErr;
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
					professional_id: finalProfessionalId,
					client_id: clientId,
				})
				.select('id')
				.single();
			if (bookingErr) {
				return res.status(500).json({ ok: false, error: bookingErr.message });
			}
			const bookingId = (bookingData as any).id as string;

			// inserir serviços
			const bookingServiceRows = [];
			for (const s of services) {
				try {
					const usePlanBenefit = Boolean((s as any).use_plan_benefit ?? (s as any).usePlanBenefit);
					const resolved = await resolveBookingServicePrice(
						supabase,
						Number(s.id),
						(s as any).variation_type ?? (s as any).variationType ?? null,
						(s as any).variant_key ?? (s as any).variantKey ?? null,
					);
					const row: any = {
						booking_id: bookingId,
						service_id: s.id,
						quantity: s.quantity ?? 1,
						unit_price: resolved.unitPrice,
						variation_type: resolved.variationType,
						variant_key: resolved.variantKey,
						variant_label: resolved.variantLabel,
					};

					if (usePlanBenefit) {
						const benefit = await reservePlanBenefit(supabase, clientId, Number(s.id), bookingId);
						row.unit_price = 0;
						row.subscription_benefit_usage_id = benefit.usageId;
					}

					bookingServiceRows.push(row);
				} catch (priceErr: any) {
					const code = priceErr?.code;
					if (code === 'VARIATION_REQUIRED' || code === 'INVALID_VARIANT' || code === 'PLAN_BENEFIT_UNAVAILABLE') {
						return res.status(400).json({ ok: false, error: priceErr.message });
					}
					throw priceErr;
				}
			}
			if (bookingServiceRows.length) {
				const { error: bsErr } = await supabase
					.from('booking_services')
					.insert(bookingServiceRows);
				if (bsErr) {
					return res.status(500).json({ ok: false, error: bsErr.message });
				}
			}

			// ── Disparar WhatsApp no momento da criação/solicitação ────────────
			try {
				// Nome dos serviços para compor a mensagem.
				const { data: serviceRows } = await supabase
					.from('services')
					.select('id, name')
					.in('id', services.map(s => s.id));
				const serviceMap = new Map<number, string>(
					(serviceRows || []).map((r: any) => [Number(r.id), String(r.name || '').trim()]),
				);
				const serviceLabel = services
					.map(s => serviceMap.get(Number(s.id)))
					.filter((name): name is string => Boolean(name))
					.join(', ') || 'serviço selecionado';
				const dataBr = formatDateToPtBr(date);
				const horaBr = formatTimeToHHMM(time);

				// Cliente: aviso de solicitação recebida (não-bloqueante).
				sendWhatsAppText(
					clientPayload.phone!,
					waMessages.bookingRequestClient({ nome: clientPayload.name!, servico: serviceLabel, data: dataBr, hora: horaBr }),
				).catch(() => {/* silencioso */ });

				// Profissional responsável: aviso de nova solicitação.
				if (finalProfessionalId) {
					const { data: profData } = await supabase
						.from('professionals')
						.select('name, phone')
						.eq('id', finalProfessionalId)
						.single();
					const professionalPhone = String(profData?.phone || '').trim();
					if (professionalPhone) {
						sendWhatsAppText(
							professionalPhone,
							waMessages.bookingRequestProfessional({ cliente: clientPayload.name!, servico: serviceLabel, data: dataBr, hora: horaBr }),
						).catch(() => {/* silencioso */ });
					} else {
						console.warn('[whatsapp] Profissional sem telefone; notificação ao profissional ignorada.');
					}
				}
			} catch (whatsErr) {
				// Nunca deixar erro de notificação impedir o retorno do agendamento
				console.error('[whatsapp] Erro ao preparar envio na criação:', whatsErr);
			}
			// ──────────────────────────────────────────────────────────────────

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

			// Autorização: o cliente só pode cancelar o próprio agendamento.
			// Qualquer outra transição de status é exclusiva do painel.
			const requestedBy = String((body as any)?.cancelled_by || '').toLowerCase();
			const isClientCancelling = status === 'cancelled' && requestedBy === 'client';

			const session = getSession(req);
			if (isClientCancelling) {
				if (session?.role !== 'client') {
					return res.status(401).json({ ok: false, error: 'Não autorizado' });
				}
			} else if (!requireAdmin(req, res)) {
				return;
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

			const { groupId, bookingIds: groupBookingIds } = await getPromotionGroupBookingIds(supabase, bookingId);

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

			// Verificação de posse: sem isso, qualquer UUID cancelaria o agendamento alheio.
			if (isClientCancelling) {
				const ownerId = String((bookingData as any)?.clients?.id || '');
				if (!ownerId || ownerId !== (session as any).sub) {
					return res.status(403).json({ ok: false, error: 'Não autorizado' });
				}
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
				.in('id', groupBookingIds);

			if (updateErr) {
				console.warn('Erro ao atualizar status (coluna pode não existir):', updateErr.message);
			} else {
				for (const bid of groupBookingIds) {
					if (status === 'completed') {
						await consumePlanBenefitForBooking(supabase, bid).catch(() => {});
					}
					if (status === 'cancelled') {
						await releasePlanBenefitForBooking(supabase, bid).catch(() => {});
					}
				}
			}

			// Disparar confirmação de WhatsApp quando status for confirmado
			if (status === 'confirmed' || status === 'confirmado') {
				try {
					const bd = bookingData as any;
					const clientPhone = String(bd?.clients?.phone || '').trim();
					const serviceLabel = ((bd?.booking_services || []) as any[])
						.map((bs: any) => String(bs?.services?.name || '').trim())
						.filter(Boolean)
						.join(', ') || 'serviço selecionado';
					if (clientPhone) {
						sendWhatsAppText(
							clientPhone,
							waMessages.bookingConfirmed({
								nome: bd?.clients?.name || 'Cliente',
								servico: serviceLabel,
								data: formatDateToPtBr(bd.date),
								hora: formatTimeToHHMM(bd.time),
							}),
						).catch(() => { /* silencioso */ });
					}
				} catch (waErr) {
					console.error('[whatsapp] Erro ao preparar payload de confirmação:', waErr);
				}
			}

			// Registrar cancelamento em booking_cancellations (histórico)
			if (status === 'cancelled') {
				try {
					const cancelledBy = isClientCancelling
						? 'client'
						: requestedBy === 'professional' ? 'professional' : 'admin';
					for (const bid of groupBookingIds) {
						await supabase.from('booking_cancellations').insert({
							booking_id: bid,
							cancelled_by: cancelledBy,
						});
					}

					// Notificar cliente quando o cancelamento for feito pelo profissional/admin.
					try {
						if (cancelledBy === 'admin' || cancelledBy === 'professional') {
							const bd = bookingData as any;
							const clientName = String(bd?.clients?.name || 'Cliente').trim();
							const clientPhone = String(bd?.clients?.phone || '').trim();
							const serviceLabel = ((bd?.booking_services || []) as any[])
								.map((bs: any) => String(bs?.services?.name || '').trim())
								.filter(Boolean)
								.join(', ') || 'serviço selecionado';

							if (clientPhone) {
								sendWhatsAppText(
									clientPhone,
									waMessages.bookingCancelledClient({
										nome: clientName,
										servico: serviceLabel,
										data: formatDateToPtBr(String(bd?.date || '')),
										hora: formatTimeToHHMM(String(bd?.time || '')),
									}),
								).catch(() => { /* silencioso */ });
							}
						}
					} catch (notifyErr: any) {
						console.error('[whatsapp] Erro ao preparar aviso de cancelamento para cliente:', notifyErr?.message || notifyErr);
					}

					// Notificar profissional quando o cancelamento for feito pelo cliente.
					try {
						if (cancelledBy === 'client') {
							const bd = bookingData as any;
							const professionalPhone = String(bd?.professionals?.phone || '').trim();
							const clientName = String(bd?.clients?.name || 'Cliente').trim();
							const serviceLabel = ((bd?.booking_services || []) as any[])
								.map((bs: any) => String(bs?.services?.name || '').trim())
								.filter(Boolean)
								.join(', ') || 'serviço selecionado';

							if (professionalPhone) {
								sendWhatsAppText(
									professionalPhone,
									waMessages.bookingCancelledProfessional({
										cliente: clientName,
										servico: serviceLabel,
										data: formatDateToPtBr(String(bd?.date || '')),
										hora: formatTimeToHHMM(String(bd?.time || '')),
									}),
								).catch(() => { /* silencioso */ });
							}
						}
					} catch (notifyErr: any) {
						console.error('[whatsapp] Erro ao preparar aviso de cancelamento para profissional:', notifyErr?.message || notifyErr);
					}

				} catch { }
			}

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

			// Reagendar diretamente é ação de painel. O cliente usa /api/reschedule-requests.
			if (!requireAdmin(req, res)) return;

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

			const { groupId, bookingIds: groupBookingIds } = await getPromotionGroupBookingIds(supabase, bookingId);

			// Reagendamento de promoção: move toda a sequência
			if (groupId) {
				const { data: leadBooking } = await supabase
					.from('bookings')
					.select('promotion_id')
					.eq('id', bookingId)
					.single();
				const promotionId = (leadBooking as any)?.promotion_id;
				if (!promotionId) {
					return res.status(400).json({ ok: false, error: 'Promoção não encontrada no agendamento' });
				}
				const promotion = await loadPromotionWithItems(supabase, String(promotionId));
				if (!promotion) return res.status(404).json({ ok: false, error: 'Promoção não encontrada' });

				const segments = buildPromotionSegments(
					promotion.items || [],
					Number(promotion.total_price),
					Number(promotion.gap_minutes || 0),
					time,
				);
				const conflict = await validatePromotionSequence(supabase, date, segments, groupBookingIds);
				if (conflict) {
					return res.status(409).json({ ok: false, code: 'SLOT_UNAVAILABLE', error: conflict });
				}

				const { data: groupBookings } = await supabase
					.from('bookings')
					.select('id, segment_order')
					.eq('promotion_group_id', groupId)
					.order('segment_order', { ascending: true });

				for (const segment of segments) {
					const row = (groupBookings || []).find((b: any) => Number(b.segment_order) === segment.sortOrder);
					if (!row) continue;
					const { error: segErr } = await supabase
						.from('bookings')
						.update({ date, time: segment.time, updated_at: new Date().toISOString() })
						.eq('id', row.id);
					if (segErr) return res.status(500).json({ ok: false, error: segErr.message });
				}

				try {
					await supabase.from('reschedule_requests').insert({
						booking_id: bookingId,
						requested_date: date,
						requested_time: time,
						status: 'approved',
						response_note: 'Promoção reagendada pelo profissional',
						responded_at: new Date().toISOString(),
					});
				} catch { }

				return res.status(200).json({ ok: true, message: 'Promoção reagendada com sucesso' });
			}

			const { durationMinutes, professionalId } = await getBookingDurationForId(supabase, bookingId);
			try {
				await assertBookingSlotAvailable(supabase, {
					date,
					time,
					professionalId,
					durationMinutes,
					excludeBookingId: bookingId,
				});
			} catch (slotErr: any) {
				if (slotErr?.code === 'SLOT_UNAVAILABLE') {
					return res.status(409).json({ ok: false, code: 'SLOT_UNAVAILABLE', error: slotErr.message });
				}
				throw slotErr;
			}

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
			} catch { }

			return res.status(200).json({ ok: true, message: 'Agendamento reagendado com sucesso' });
		} catch (err: any) {
			return res.status(500).json({ ok: false, error: err?.message || 'Erro inesperado' });
		}
	}

	res.setHeader('Allow', 'GET, POST, PUT, PATCH');
	return res.status(405).json({ ok: false, error: 'Método não permitido' });
}

