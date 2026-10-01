import React from 'react';

// Origem do agendamento, gravada pela API em bookings.source.
const SOURCES: Record<string, { label: string; title: string; className: string }> = {
  whatsapp_agent: {
    label: 'WhatsApp automatizado',
    title: 'Agendado pelo agente de WhatsApp',
    className: 'text-green-300 bg-green-950/40 border-green-800',
  },
  site: {
    label: 'Cliente via site',
    title: 'Agendado pelo próprio cliente no site',
    className: 'text-sky-300 bg-sky-950/40 border-sky-800',
  },
  professional: {
    label: 'Lançado pelo profissional',
    title: 'Lançado manualmente por um profissional logado no painel',
    className: 'text-amber-300 bg-amber-950/40 border-amber-800',
  },
};

/** Agendamentos anteriores à coluna `source` não têm origem e não exibem tag. */
const BookingSourceTag: React.FC<{ source?: string | null; className?: string }> = ({ source, className = '' }) => {
  const info = source ? SOURCES[source] : undefined;
  if (!info) return null;
  return (
    <span
      title={info.title}
      className={`inline-block text-xs border rounded px-2 py-0.5 ${info.className} ${className}`}
    >
      {info.label}
    </span>
  );
};

export default BookingSourceTag;
