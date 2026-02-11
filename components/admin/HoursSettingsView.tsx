import React, { useEffect, useMemo, useState } from 'react';

type Professional = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
};

type BusinessHour = {
  id?: string;
  weekday: number; // 0..6 (domingo..sábado)
  enabled: boolean;
  open_time: string;  // HH:MM:SS or HH:MM
  close_time: string; // HH:MM:SS or HH:MM
  professional_id?: string | null;
};

type ManualSlot = {
  id: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:MM:SS
  professional_id?: string | null;
  note?: string | null;
  available: boolean;
  created_at?: string;
};

type SpecialDateHour = {
  id: string;
  date: string; // yyyy-mm-dd
  open_time: string;
  close_time: string;
  enabled: boolean;
  professional_id?: string | null;
};

const WEEKDAYS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

const normalizeTime = (t: string) => (t || '').slice(0,5);

const HoursSettingsView: React.FC = () => {
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [slots, setSlots] = useState<ManualSlot[]>([]);
  const [specialHours, setSpecialHours] = useState<SpecialDateHour[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [limitMonth, setLimitMonth] = useState<string>('');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null);

  // Form de slot manual
  const [slotDate, setSlotDate] = useState<string>('');
  const [slotTime, setSlotTime] = useState<string>('09:00');
  const [slotNote, setSlotNote] = useState<string>('');

  // Form de horário especial (dia ou período)
  const [specialDateFrom, setSpecialDateFrom] = useState<string>('');
  const [specialDateTo, setSpecialDateTo] = useState<string>('');
  const [specialOpen, setSpecialOpen] = useState<string>('09:00');
  const [specialClose, setSpecialClose] = useState<string>('18:00');
  const [specialEnabled, setSpecialEnabled] = useState<boolean>(true);
  const [specialSaving, setSpecialSaving] = useState(false);

  // Carregar profissionais
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/professionals');
        const data = await res.json();
        if (res.ok && data.professionals) {
          setProfessionals(data.professionals.filter((p: Professional) => p.is_active));
        }
      } catch (e) {
        console.error('Erro ao carregar profissionais:', e);
      }
    })();
  }, []);

  // Carregar horários quando o profissional selecionado mudar
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const url = selectedProfessionalId 
          ? `/api/schedule-settings?professional_id=${selectedProfessionalId}`
          : '/api/schedule-settings';
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao carregar');
        const incoming: BusinessHour[] = (data.business_hours || []).map((h: any) => ({
          id: h.id,
          weekday: h.weekday,
          enabled: !!h.enabled,
          open_time: normalizeTime(h.open_time),
          close_time: normalizeTime(h.close_time),
          professional_id: h.professional_id || null,
        }));
        setLimitMonth((data.booking_limit_month || '') as string);
        // Garantir 7 dias
        const map = new Map<number, BusinessHour>();
        incoming.forEach(h => map.set(h.weekday, h));
        const normalized: BusinessHour[] = [];
        for (let w = 0; w < 7; w++) {
          normalized.push(map.get(w) || { 
            weekday: w, 
            enabled: w !== 0, 
            open_time: '09:00', 
            close_time: w === 6 ? '16:00' : '20:00',
            professional_id: selectedProfessionalId,
          });
        }
        setHours(normalized);
        setSlots((data.manual_slots || []) as ManualSlot[]);
        const special = (data.special_date_hours || []).map((s: any) => ({
          id: s.id,
          date: s.date,
          open_time: normalizeTime(s.open_time),
          close_time: normalizeTime(s.close_time),
          enabled: !!s.enabled,
          professional_id: s.professional_id || null,
        }));
        setSpecialHours(special);
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedProfessionalId]);

  const addSpecialDateHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSpecialSaving(true);
    try {
      if (!specialDateFrom) throw new Error('Informe a data inicial');
      const res = await fetch('/api/schedule-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'special_date',
          date: specialDateFrom,
          date_to: specialDateTo || specialDateFrom,
          open_time: specialOpen,
          close_time: specialClose,
          enabled: specialEnabled,
          professional_id: selectedProfessionalId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao adicionar horário especial');
      setSpecialDateFrom('');
      setSpecialDateTo('');
      setMessage(`Horário especial adicionado${data.count > 1 ? ` (${data.count} dias)` : ''}`);
      const url = selectedProfessionalId
        ? `/api/schedule-settings?professional_id=${selectedProfessionalId}`
        : '/api/schedule-settings';
      const r = await fetch(url);
      const j = await r.json();
      if (r.ok && j.special_date_hours) {
        setSpecialHours(j.special_date_hours.map((s: any) => ({
          id: s.id,
          date: s.date,
          open_time: normalizeTime(s.open_time),
          close_time: normalizeTime(s.close_time),
          enabled: !!s.enabled,
          professional_id: s.professional_id || null,
        })));
      }
    } catch (e: any) {
      setError(e?.message || 'Erro ao adicionar horário especial');
    } finally {
      setSpecialSaving(false);
    }
  };

  const removeSpecialDateHour = async (id: string) => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/schedule-settings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ special_id: id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao remover');
      setSpecialHours(prev => prev.filter(s => s.id !== id));
      setMessage('Horário especial removido');
    } catch (e: any) {
      setError(e?.message || 'Erro ao remover');
    }
  };

  const saveHours = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        professional_id: selectedProfessionalId,
        business_hours: hours.map(h => ({
          weekday: h.weekday,
          enabled: h.enabled,
          open_time: h.open_time,
          close_time: h.close_time,
        })),
        booking_limit_month: limitMonth || undefined,
      };
      const res = await fetch('/api/schedule-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao salvar horários');
      const profName = selectedProfessionalId 
        ? professionals.find(p => p.id === selectedProfessionalId)?.name || 'Profissional'
        : 'Global';
      setMessage(`Horários de ${profName} salvos com sucesso`);
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const addManualSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      if (!slotDate || !slotTime) throw new Error('Informe data e hora');
      const res = await fetch('/api/schedule-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: slotDate, time: slotTime, note: slotNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao adicionar horário');
      // Atualizar lista local
      setSlots(prev => [
        ...prev,
        { id: data.id, date: slotDate, time: `${slotTime}:00`, professional_id: null, note: slotNote, available: true }
      ].sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)));
      setSlotDate('');
      setSlotTime('09:00');
      setSlotNote('');
      setMessage('Horário manual adicionado');
    } catch (e: any) {
      setError(e?.message || 'Erro ao adicionar horário manual');
    }
  };

  const removeSlot = async (id: string) => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/schedule-settings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Falha ao remover horário');
      setSlots(prev => prev.filter(s => s.id !== id));
      setMessage('Horário removido');
    } catch (e: any) {
      setError(e?.message || 'Erro ao remover horário');
    }
  };

  if (loading) return <div className="text-gray-700">Carregando...</div>;

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-300 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Controle de Horários</h2>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {message && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{message}</div>}

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecionar Profissional
        </label>
        <select
          value={selectedProfessionalId || ''}
          onChange={(e) => setSelectedProfessionalId(e.target.value || null)}
          className="bg-gray-50 border border-gray-300 rounded px-3 py-2 text-gray-900 w-full md:w-auto min-w-[250px]"
        >
          <option value="">Horários Globais (todos os profissionais)</option>
          {professionals.map(prof => (
            <option key={prof.id} value={prof.id}>{prof.name}</option>
          ))}
        </select>
        <p className="text-xs text-gray-600 mt-2">
          {selectedProfessionalId 
            ? `Configurando horários para: ${professionals.find(p => p.id === selectedProfessionalId)?.name || 'Profissional'}`
            : 'Configurando horários globais (aplicados quando o serviço não tem profissional específico)'}
        </p>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Janela por dia da semana</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hours.map((h, idx) => (
            <div key={h.weekday} className="border border-gray-300 rounded-lg p-3 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="text-gray-800 font-medium sm:w-28">{WEEKDAYS[h.weekday]}</div>
                <label className="flex items-center gap-2 text-gray-800">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setHours(prev => prev.map((x, i) => i === idx ? { ...x, enabled: v } : x));
                    }}
                  />
                  Ativo
                </label>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <input
                  type="time"
                  value={normalizeTime(h.open_time)}
                  onChange={(e) => setHours(prev => prev.map((x, i) => i === idx ? { ...x, open_time: e.target.value } : x))}
                  className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-gray-900"
                />
                <span className="text-gray-700">às</span>
                <input
                  type="time"
                  value={normalizeTime(h.close_time)}
                  onChange={(e) => setHours(prev => prev.map((x, i) => i === idx ? { ...x, close_time: e.target.value } : x))}
                  className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-gray-900"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <button
            onClick={saveHours}
            disabled={saving}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar horários'}
          </button>
        </div>
      </div>

      <div className="mb-6 bg-white border border-gray-300 rounded-lg p-3">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Limite de mês para agendamentos</h3>
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
          <label className="block w-full sm:w-auto">
            <span className="block text-sm text-gray-700 mb-1">Mês limite</span>
            <input
              type="month"
              value={limitMonth}
              onChange={(e) => setLimitMonth(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-gray-900"
            />
          </label>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={saveHours}
              className="w-full sm:w-auto px-4 py-2 bg-gray-900 hover:bg-black text-white rounded"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Aplicar'}
            </button>
            {limitMonth && (
              <button
                onClick={() => setLimitMonth('')}
                className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-900 rounded"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2">O calendário do cliente não permitirá agendamentos após o mês selecionado.</p>
      </div>

      <div className="mb-6 bg-white border border-gray-300 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Horário especial por dia ou período</h3>
        <p className="text-sm text-gray-600 mb-4">
          Defina um horário de funcionamento diferente para uma data específica ou um intervalo (ex.: feriado, dia de folga, horário reduzido).
        </p>
        <form onSubmit={addSpecialDateHours} className="flex flex-col gap-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Data inicial</label>
              <input
                type="date"
                value={specialDateFrom}
                onChange={(e) => setSpecialDateFrom(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Data final (opcional)</label>
              <input
                type="date"
                value={specialDateTo}
                onChange={(e) => setSpecialDateTo(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-gray-900"
                min={specialDateFrom}
              />
              <p className="text-xs text-gray-500 mt-0.5">Deixe em branco para um único dia</p>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Abertura</label>
              <input
                type="time"
                value={specialOpen}
                onChange={(e) => setSpecialOpen(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Fechamento</label>
              <input
                type="time"
                value={specialClose}
                onChange={(e) => setSpecialClose(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-gray-900"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-gray-700">
              <input
                type="checkbox"
                checked={specialEnabled}
                onChange={(e) => setSpecialEnabled(e.target.checked)}
              />
              Dia disponível para agendamento
            </label>
            <button
              type="submit"
              disabled={specialSaving}
              className="bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
            >
              {specialSaving ? 'Salvando...' : 'Adicionar horário especial'}
            </button>
          </div>
        </form>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Abertura</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fechamento</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {specialHours.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-sm text-gray-500">Nenhum horário especial definido.</td>
                </tr>
              )}
              {specialHours.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{s.date}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{normalizeTime(s.open_time)}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{normalizeTime(s.close_time)}</td>
                  <td className="px-4 py-2 text-sm">{s.enabled ? <span className="text-green-600">Ativo</span> : <span className="text-red-600">Fechado</span>}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" onClick={() => removeSpecialDateHour(s.id)} className="text-red-600 hover:text-red-700 text-sm">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Adicionar horário manual</h3>
        <form onSubmit={addManualSlot} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Data</label>
            <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} className="bg-gray-50 border border-gray-300 rounded px-3 py-2 text-gray-900" required />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Hora</label>
            <input type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)} className="bg-gray-50 border border-gray-300 rounded px-3 py-2 text-gray-900" required />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-700 mb-1">Observação (opcional)</label>
            <input value={slotNote} onChange={(e) => setSlotNote(e.target.value)} placeholder="ex.: horário extra" className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-gray-900" />
          </div>
          <button type="submit" className="bg-gray-900 hover:bg-black text-white font-semibold py-2 px-4 rounded-lg">Adicionar</button>
        </form>

        <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Obs</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {slots.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-sm text-gray-500">Nenhum horário manual adicionado.</td>
                </tr>
              )}
              {slots.map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{s.date}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{normalizeTime(s.time)}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{s.note || '-'}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => removeSlot(s.id)} className="text-red-600 hover:text-red-700 text-sm">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HoursSettingsView;

