import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WhatsAppIcon, LocationIcon, whatsAppNumber } from './icons';

type FooterContact = {
  contact1_name: string;
  contact1_phone: string;
  contact2_name: string;
  contact2_phone: string;
  address: string;
};

const Footer: React.FC = () => {
  const [contact, setContact] = useState<FooterContact | null>(null);

  useEffect(() => {
    fetch('/api/schedule-settings?footer=1')
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && data) {
          setContact({
            contact1_name: data.contact1_name ?? '',
            contact1_phone: data.contact1_phone ?? '',
            contact2_name: data.contact2_name ?? '',
            contact2_phone: data.contact2_phone ?? '',
            address: data.address ?? '',
          });
        }
      })
      .catch(() => {});
  }, []);

  const hasWhatsApp1 = contact && (contact.contact1_name.trim() || contact.contact1_phone.trim());
  const hasWhatsApp2 = contact && (contact.contact2_name.trim() || contact.contact2_phone.trim());
  const addressText = (contact?.address || '').trim();
  const addressMapUrl = addressText
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`
    : '';
  const hasAddress = Boolean(addressText);

  return (
    <footer className="py-[50px] border-t border-line mt-auto">
      <div className="container mx-auto px-4">
        {(hasWhatsApp1 || hasWhatsApp2 || hasAddress) && (
          <div className="flex flex-col items-center gap-4 mb-8">
            {hasWhatsApp1 && contact.contact1_phone && (
              <a
                href={`https://wa.me/${whatsAppNumber(contact.contact1_phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-zinc-200 hover:text-gold transition-colors"
              >
                <span className="text-gold flex-shrink-0 flex items-center justify-center" aria-hidden>
                  <WhatsAppIcon className="w-6 h-6" />
                </span>
                <span className="flex flex-col items-start">
                  <span className="font-medium">{contact.contact1_name || 'WhatsApp'}</span>
                  <span className="text-zinc-300 text-sm mt-0.5">{contact.contact1_phone}</span>
                </span>
              </a>
            )}
            {hasWhatsApp2 && contact.contact2_phone && (
              <a
                href={`https://wa.me/${whatsAppNumber(contact.contact2_phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-zinc-200 hover:text-gold transition-colors"
              >
                <span className="text-gold flex-shrink-0 flex items-center justify-center" aria-hidden>
                  <WhatsAppIcon className="w-6 h-6" />
                </span>
                <span className="flex flex-col items-start">
                  <span className="font-medium">{contact.contact2_name || 'WhatsApp'}</span>
                  <span className="text-zinc-300 text-sm mt-0.5">{contact.contact2_phone}</span>
                </span>
              </a>
            )}
            {hasAddress && (
              <a
                href={addressMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-zinc-200 hover:text-gold transition-colors"
              >
                <span className="text-gold flex-shrink-0">
                  <LocationIcon className="w-6 h-6" />
                </span>
                <span className="text-zinc-200">{addressText}</span>
              </a>
            )}
          </div>
        )}
        <nav className="text-center text-xs text-zinc-300 mb-3" aria-label="Documentos jurídicos">
          <Link to="/politica-de-privacidade" className="text-zinc-300 hover:text-gold underline underline-offset-2">
            Política de Privacidade
          </Link>
          <span className="mx-2 text-zinc-400" aria-hidden>
            ·
          </span>
          <Link to="/termos-de-servicos" className="text-zinc-300 hover:text-gold underline underline-offset-2">
            Termos de Serviço
          </Link>
        </nav>
        <p className="text-center text-xs text-zinc-300">
          Desenvolvido por{' '}
          <a
            href="https://pedroriquelme.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:text-gold-light underline transition-colors"
          >
            Pedro Riquelme
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
