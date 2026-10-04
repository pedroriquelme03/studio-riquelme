import React, { useEffect, useMemo, useState } from 'react';
import { Service, ServicePriceSelection } from '../../types';
import DateTimePicker from '../DateTimePicker';
import { PlusCircleIcon } from '../icons';

type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
};

type Step = 'details' | 'datetime' | 'success';

function todayYmdLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientRow[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);

  const [serviceId, setServiceId] = useState<string>('');
  const [priceSelection, setPriceSelection] = useState<ServicePriceSelection | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    date: string;
    time: string;
    clientName: string;
    serviceName: string;
  } | null>(null);

  const selectedService = useMemo(
    () => services.find((s) => String(s.id) === serviceId) || null,
    [services, serviceId],
  );

  const needsVariant = Boolean(
    selectedService?.priceVariationEnabled && (selectedService?.priceVariants?.length || 0) > 0,
  );

  useEffect(() => {
    (async () => {
      setLoadingMeta(true);
      try {
        const res = await fetch('/api/services', { credentials: 'same-origin' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar serviços');
        setServices((data.services || []) as Service[]);
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

  const selectClient = (c: ClientRow) => {
    setClientName(c.name || '');
    setClientPhone(c.phone || '');
    setClientEmail(c.email || '');
    setClientSearch('');
    setClientResults([]);
  };

  const canGoDatetime =
    clientName.trim().length >= 2 &&
    clientPhone.replace(/\D/g, '').length >= 8 &&
    !!selectedService &&
    (!needsVariant || !!priceSelection);

  const resetForm = () => {
    setStep('details');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientNotes('');
    setClientSearch('');
    setServiceId('');
    setPriceSelection(null);
    setError(null);
    setSuccessInfo(null);
  };

  const handleCreate = async (date: Date, time: string) => {
    if (!selectedService) return;
    setSubmitting(true);
    setError(null);
    try {
      const phoneDigits = clientPhone.replace(/\D/g, '');
      const body: Record<string, unknown> = {
        date: todayYmdLocal(date),
        time,
        professional_id: selectedService.responsibleProfessionalId || null,
        client: {
          name: clientName.trim(),
          phone: phoneDigits,
          email: clientEmail.trim() || undefined,
          notes: clientNotes.trim() || undefined,
        },
        services: [
          {
            id: selectedService.id,
            quantity: 1,
            ...(priceSelection
              ? {
                  variation_type: priceSelection.variationType,
                  variant_key: priceSelection.variantKey,
                }
              : {}),
          },
        ],
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
        serviceName: priceSelection
          ? `${selectedService.name} (${priceSelection.label})`
          : selectedService.name,
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

  if (step === 'datetime' && selectedService) {
    return (
      <div>
        <h2 className="text-2xl font-bold gold-text text-center mb-2">Novo Agendamento</h2>
        <p className="text-center text-zinc-300 mb-6 text-sm">
          {clientName} · {selectedService.name}
          {priceSelection ? ` (${priceSelection.label})` : ''} · {selectedService.duration} min
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
            serviceDuration={selectedService.duration}
            professionalId={selectedService.responsibleProfessionalId || null}
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
          <p className="text-white"><span className="text-zinc-400">Serviço:</span> {successInfo.serviceName}</p>
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
        Lance um horário pelo painel, sem usar o agendamento público do site.
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
          <label className="block text-sm text-zinc-300 mb-1">Serviço *</label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="w-full bg-surface-overlay border border-line rounded-lg px-3 py-2 text-white"
          >
            <option value="">Selecione um serviço</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.responsibleProfessionalName ? ` — ${s.responsibleProfessionalName}` : ''}
                {` (${s.duration} min)`}
              </option>
            ))}
          </select>
        </div>

        {needsVariant && selectedService && (
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Variação / tamanho *</label>
            <div className="space-y-2">
              {(selectedService.priceVariants || []).map((v) => {
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

        {selectedService && !needsVariant && (
          <p className="text-sm text-zinc-300">
            Valor: <span className="text-gold font-semibold">R$ {selectedService.price.toFixed(2)}</span>
            {selectedService.responsibleProfessionalName
              ? ` · Profissional: ${selectedService.responsibleProfessionalName}`
              : ''}
          </p>
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
          <PlusCircleIcon className="w-5 h-5" />
          Escolher data e horário
        </button>
      </div>
    </div>
  );
};

export default AdminCreateBookingView;
