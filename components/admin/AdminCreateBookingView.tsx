import React, { useEffect, useMemo, useState } from 'react';
import { Service, ServicePriceSelection } from '../../types';
import DateTimePicker from '../DateTimePicker';
import { PlusCircleIcon } from '../icons';
import { applyPriceSelection, serviceRequiresHairSize } from '../../lib/priceVariations';

type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
};

type Professional = {
  id: string;
  name: string;
  is_active?: boolean;
};

type SelectedLine = {
  key: string;
  service: Service;
  priceSelection: ServicePriceSelection | null;
};

type Step = 'details' | 'datetime' | 'success';

function todayYmdLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function newLineKey() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function lineLabel(line: SelectedLine) {
  if (line.priceSelection) return `${line.service.name} (${line.priceSelection.label})`;
  return line.service.name;
}

function linePrice(line: SelectedLine) {
  if (line.priceSelection) return line.priceSelection.price;
  return line.service.price;
}

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(res.status >= 500 ? `Erro do servidor (${res.status})` : `Erro ${res.status}`);
  }
}

const AdminCreateBookingView: React.FC = () => {
  const [step, setStep] = useState<Step>('details');
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientRow[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);

  const [professionalId, setProfessionalId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [priceSelection, setPriceSelection] = useState<ServicePriceSelection | null>(null);
  const [selectedLines, setSelectedLines] = useState<SelectedLine[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    date: string;
    time: string;
    clientName: string;
    serviceNames: string[];
    totalDuration: number;
    totalPrice: number;
  } | null>(null);

  const activeProfessionals = useMemo(
    () => professionals.filter((p) => p.is_active !== false).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [professionals],
  );

  const cartProfessionalId = useMemo(() => {
    const pros = Array.from(
      new Set(selectedLines.map((l) => l.service.responsibleProfessionalId).filter(Boolean)),
    ) as string[];
    return pros.length === 1 ? pros[0] : null;
  }, [selectedLines]);

  const filteredServices = useMemo(() => {
    let list = services;
    if (professionalId) {
      list = list.filter((s) => s.responsibleProfessionalId === professionalId);
    } else if (cartProfessionalId) {
      list = list.filter(
        (s) => !s.responsibleProfessionalId || s.responsibleProfessionalId === cartProfessionalId,
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [services, professionalId, cartProfessionalId]);

  const servicesByProfessional = useMemo(() => {
    if (professionalId) return null;
    const groups = new Map<string, { label: string; items: Service[] }>();
    for (const s of filteredServices) {
      const key = s.responsibleProfessionalId || '__none__';
      const label = s.responsibleProfessionalName || 'Sem profissional';
      const g = groups.get(key) || { label, items: [] };
      g.items.push(s);
      groups.set(key, g);
    }
    return Array.from(groups.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label, 'pt-BR'));
  }, [filteredServices, professionalId]);

  const draftService = useMemo(
    () => services.find((s) => String(s.id) === serviceId) || null,
    [services, serviceId],
  );

  const needsVariant = serviceRequiresHairSize(draftService);

  const totalDuration = useMemo(
    () => selectedLines.reduce((sum, l) => sum + Number(l.service.duration || 0), 0),
    [selectedLines],
  );

  const totalPrice = useMemo(
    () => selectedLines.reduce((sum, l) => sum + linePrice(l), 0),
    [selectedLines],
  );

  const bookingProfessionalId = useMemo(() => {
    if (cartProfessionalId) return cartProfessionalId;
    const first = selectedLines.find((l) => l.service.responsibleProfessionalId);
    return first?.service.responsibleProfessionalId || null;
  }, [selectedLines, cartProfessionalId]);

  useEffect(() => {
    (async () => {
      setLoadingMeta(true);
      try {
        const [svcRes, proRes] = await Promise.all([
          fetch('/api/services', { credentials: 'same-origin' }),
          fetch('/api/professionals', { credentials: 'same-origin' }),
        ]);
        const [svcData, proData] = await Promise.all([parseJson(svcRes), parseJson(proRes)]);
        if (!svcRes.ok) throw new Error(svcData?.error || 'Erro ao carregar serviços');
        setServices((svcData.services || []) as Service[]);
        if (proRes.ok) {
          setProfessionals((proData.professionals || []) as Professional[]);
        }
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar serviços');
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, []);

  useEffect(() => {
    const q = clientSearch.trim();
    if (q.length < 2) {
      setClientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingClients(true);
      try {
        const qs = new URLSearchParams({ q });
        const res = await fetch(`/api/clients?${qs}`, { credentials: 'same-origin' });
        const data = await parseJson(res);
        if (res.ok && data?.ok) {
          setClientResults((data.clients || []).slice(0, 8) as ClientRow[]);
        } else {
          setClientResults([]);
        }
      } catch {
        setClientResults([]);
      } finally {
        setSearchingClients(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  useEffect(() => {
    setPriceSelection(null);
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId) return;
    const stillVisible = filteredServices.some((s) => String(s.id) === serviceId);
    if (!stillVisible) {
      setServiceId('');
      setPriceSelection(null);
    }
  }, [professionalId, filteredServices, serviceId]);

  const selectClient = (c: ClientRow) => {
    setClientName(c.name || '');
    setClientPhone(c.phone || '');
    setClientEmail(c.email || '');
    setClientSearch('');
    setClientResults([]);
  };

  const canAddService =
    !!draftService && (!needsVariant || !!priceSelection);

  const addServiceLine = () => {
    if (!draftService || !canAddService) return;

    if (cartProfessionalId && draftService.responsibleProfessionalId
      && draftService.responsibleProfessionalId !== cartProfessionalId) {
      setError('Todos os serviços do agendamento precisam ser do mesmo profissional.');
      return;
    }

    const distinctInCart = Array.from(
      new Set([
        ...selectedLines.map((l) => l.service.responsibleProfessionalId).filter(Boolean),
        draftService.responsibleProfessionalId,
      ].filter(Boolean)),
    );
    if (distinctInCart.length > 1) {
      setError('Os serviços selecionados possuem profissionais responsáveis diferentes.');
      return;
    }

    const priced = priceSelection ? applyPriceSelection(draftService, priceSelection) : draftService;
    setSelectedLines((prev) => [
      ...prev,
      {
        key: newLineKey(),
        service: priced,
        priceSelection,
      },
    ]);
    setServiceId('');
    setPriceSelection(null);
    setError(null);
  };

  const removeLine = (key: string) => {
    setSelectedLines((prev) => prev.filter((l) => l.key !== key));
  };

  const canGoDatetime =
    clientName.trim().length >= 2 &&
    clientPhone.replace(/\D/g, '').length >= 8 &&
    selectedLines.length > 0;

  const resetForm = () => {
    setStep('details');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientNotes('');
    setClientSearch('');
    setProfessionalId('');
    setServiceId('');
    setPriceSelection(null);
    setSelectedLines([]);
    setError(null);
    setSuccessInfo(null);
  };

  const handleCreate = async (date: Date, time: string) => {
    if (selectedLines.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const phoneDigits = clientPhone.replace(/\D/g, '');
      const body: Record<string, unknown> = {
        date: todayYmdLocal(date),
        time,
        professional_id: bookingProfessionalId,
        client: {
          name: clientName.trim(),
          phone: phoneDigits,
          email: clientEmail.trim() || undefined,
          notes: clientNotes.trim() || undefined,
        },
        services: selectedLines.map((line) => ({
          id: line.service.id,
          quantity: 1,
          ...(line.priceSelection
            ? {
                variation_type: line.priceSelection.variationType,
                variant_key: line.priceSelection.variantKey,
              }
            : {}),
        })),
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await parseJson(res);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Não foi possível criar o agendamento');
      }

      setSuccessInfo({
        date: todayYmdLocal(date),
        time,
        clientName: clientName.trim(),
        serviceNames: selectedLines.map(lineLabel),
        totalDuration,
        totalPrice,
      });
      setStep('success');
    } catch (e: any) {
      setError(e?.message || 'Erro ao criar agendamento');
      setStep('details');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMeta) {
    return <div className="text-zinc-300">Carregando...</div>;
  }

  if (step === 'datetime' && selectedLines.length > 0) {
    const names = selectedLines.map(lineLabel).join(', ');
    return (
      <div>
        <h2 className="text-2xl font-bold gold-text text-center mb-2">Novo Agendamento</h2>
        <p className="text-center text-zinc-300 mb-6 text-sm px-2">
          {clientName} · {names} · {totalDuration} min
        </p>
        {error && (
          <div className="mb-4 bg-red-950/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {submitting ? (
          <div className="text-center text-zinc-300 py-12">Salvando agendamento...</div>
        ) : (
          <DateTimePicker
            onBack={() => setStep('details')}
            onDateTimeSelect={handleCreate}
            serviceDuration={totalDuration}
            professionalId={bookingProfessionalId}
          />
        )}
      </div>
    );
  }

  if (step === 'success' && successInfo) {
    const [y, m, d] = successInfo.date.split('-').map(Number);
    const dateLabel = new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
    return (
      <div className="max-w-lg mx-auto text-center space-y-6">
        <h2 className="text-2xl font-bold gold-text">Agendamento criado</h2>
        <div className="bg-surface-raised border border-line rounded-xl p-6 text-left space-y-2">
          <p className="text-white"><span className="text-zinc-400">Cliente:</span> {successInfo.clientName}</p>
          <div className="text-white">
            <span className="text-zinc-400">Serviços:</span>
            <ul className="mt-1 list-disc list-inside text-sm space-y-0.5">
              {successInfo.serviceNames.map((name, idx) => (
                <li key={`${idx}-${name}`}>{name}</li>
              ))}
            </ul>
          </div>
          <p className="text-white"><span className="text-zinc-400">Duração:</span> {successInfo.totalDuration} min</p>
          <p className="text-white"><span className="text-zinc-400">Valor:</span> R$ {successInfo.totalPrice.toFixed(2)}</p>
          <p className="text-white"><span className="text-zinc-400">Data:</span> {dateLabel}</p>
          <p className="text-white"><span className="text-zinc-400">Horário:</span> {successInfo.time.slice(0, 5)}</p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="bg-gold hover:brightness-110 font-bold py-3 px-6 rounded-lg"
        >
          Criar outro agendamento
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold gold-text text-center mb-2">Novo Agendamento</h2>
      <p className="text-center text-zinc-300 mb-8 text-sm">
        Lance um horário pelo painel. Você pode incluir vários serviços no mesmo agendamento.
      </p>

      {error && (
        <div className="mb-4 bg-red-950/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-surface-raised border border-line rounded-xl p-5 md:p-6 space-y-5">
        <div>
          <label className="block text-sm text-zinc-300 mb-1">Buscar cliente cadastrado</label>
          <input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Nome ou telefone..."
            className="w-full bg-surface-overlay border border-line rounded-lg px-3 py-2 text-white"
          />
          {searchingClients && <p className="text-xs text-zinc-400 mt-1">Buscando...</p>}
          {clientResults.length > 0 && (
            <ul className="mt-2 border border-line rounded-lg overflow-hidden divide-y divide-line">
              {clientResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectClient(c)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-muted text-sm"
                  >
                    <span className="text-white font-medium">{c.name}</span>
                    <span className="text-zinc-400 ml-2">{c.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm text-zinc-300 mb-1">Nome do cliente *</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full bg-surface-overlay border border-line rounded-lg px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1">Telefone / WhatsApp *</label>
            <input
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="w-full bg-surface-overlay border border-line rounded-lg px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-1">E-mail (opcional)</label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full bg-surface-overlay border border-line rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-zinc-300 mb-1">Observações (opcional)</label>
            <textarea
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              rows={2}
              className="w-full bg-surface-overlay border border-line rounded-lg px-3 py-2 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-300 mb-1">Filtrar por profissional</label>
          <select
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            className="w-full bg-surface-overlay border border-line rounded-lg px-3 py-2 text-white"
          >
            <option value="">Todos os profissionais</option>
            {activeProfessionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="border border-line rounded-lg p-4 space-y-3">
          <h3 className="text-white font-semibold text-sm">Adicionar serviços</h3>
          <div>
            <label className="block text-sm text-zinc-300 mb-1">Serviço</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full bg-surface-overlay border border-line rounded-lg px-3 py-2 text-white"
            >
              <option value="">Selecione um serviço</option>
              {professionalId ? (
                filteredServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration} min)
                  </option>
                ))
              ) : (
                (servicesByProfessional || []).map(([key, group]) => (
                  <optgroup key={key} label={group.label}>
                    {group.items.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.duration} min)
                      </option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
            {professionalId && filteredServices.length === 0 && (
              <p className="text-xs text-zinc-400 mt-1">Nenhum serviço vinculado a este profissional.</p>
            )}
          </div>

          {needsVariant && draftService && (
            <div>
              <label className="block text-sm text-zinc-300 mb-2">Variação / tamanho *</label>
              <div className="space-y-2">
                {(draftService.priceVariants || []).map((v) => {
                  const active = priceSelection?.variantKey === v.variantKey;
                  return (
                    <button
                      key={v.variantKey}
                      type="button"
                      onClick={() =>
                        setPriceSelection({
                          variationType: v.variationType,
                          variantKey: v.variantKey,
                          label: v.label,
                          price: v.price,
                        })
                      }
                      className={`w-full text-left px-3 py-2 rounded-lg border ${
                        active ? 'border-gold bg-gold/10' : 'border-line hover:border-gold/50'
                      }`}
                    >
                      <span className="text-white font-medium">{v.label}</span>
                      <span className="text-gold ml-2">R$ {v.price.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {draftService && !needsVariant && (
            <p className="text-sm text-zinc-300">
              Valor: <span className="text-gold font-semibold">R$ {draftService.price.toFixed(2)}</span>
              {draftService.responsibleProfessionalName
                ? ` · ${draftService.responsibleProfessionalName}`
                : ''}
            </p>
          )}

          <button
            type="button"
            disabled={!canAddService}
            onClick={addServiceLine}
            className="w-full flex items-center justify-center gap-2 border border-gold text-gold hover:bg-gold/10 font-semibold py-2.5 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusCircleIcon className="w-5 h-5" />
            Adicionar serviço
          </button>
        </div>

        {selectedLines.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-white font-semibold text-sm">
              Serviços no agendamento ({selectedLines.length})
            </h3>
            <ul className="divide-y divide-line border border-line rounded-lg overflow-hidden">
              {selectedLines.map((line) => (
                <li key={line.key} className="flex items-start justify-between gap-3 px-3 py-3 bg-surface-overlay">
                  <div className="min-w-0">
                    <p className="text-white font-medium break-words">{lineLabel(line)}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {line.service.duration} min · R$ {linePrice(line).toFixed(2)}
                      {line.service.responsibleProfessionalName
                        ? ` · ${line.service.responsibleProfessionalName}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="text-red-400 hover:text-red-300 text-sm flex-shrink-0"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-between text-sm pt-1">
              <span className="text-zinc-400">Total</span>
              <span className="text-gold font-semibold">
                {totalDuration} min · R$ {totalPrice.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!canGoDatetime}
          onClick={() => {
            setError(null);
            setStep('datetime');
          }}
          className="w-full flex items-center justify-center gap-2 bg-gold hover:brightness-110 font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Escolher data e horário
        </button>
      </div>
    </div>
  );
};

export default AdminCreateBookingView;
