import React, { useEffect, useState } from 'react';
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
    fetch('/api/footer-contact')
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
  const hasAddress = contact && contact.address.trim();

  return (
    <footer className="py-[50px] border-t border-gray-300 mt-auto">
      <div className="container mx-auto px-4">
        {(hasWhatsApp1 || hasWhatsApp2 || hasAddress) && (
          <div className="flex flex-col items-center gap-4 mb-8">
            {hasWhatsApp1 && contact.contact1_phone && (
              <a
                href={`https://wa.me/${whatsAppNumber(contact.contact1_phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-gray-700 hover:text-pink-600 transition-colors"
              >
                <span className="text-pink-600 flex-shrink-0">
                  <WhatsAppIcon className="w-6 h-6" />
                </span>
                <span className="font-medium">{contact.contact1_name || 'WhatsApp'}</span>
                <span className="text-gray-600">{contact.contact1_phone}</span>
              </a>
            )}
            {hasWhatsApp2 && contact.contact2_phone && (
              <a
                href={`https://wa.me/${whatsAppNumber(contact.contact2_phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-gray-700 hover:text-pink-600 transition-colors"
              >
                <span className="text-pink-600 flex-shrink-0">
                  <WhatsAppIcon className="w-6 h-6" />
                </span>
                <span className="font-medium">{contact.contact2_name || 'WhatsApp'}</span>
                <span className="text-gray-600">{contact.contact2_phone}</span>
              </a>
            )}
            {hasAddress && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact!.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 text-gray-700 hover:text-pink-600 transition-colors"
              >
                <span className="text-pink-600 flex-shrink-0">
                  <LocationIcon className="w-6 h-6" />
                </span>
                <span className="text-gray-700">{contact!.address}</span>
              </a>
            )}
          </div>
        )}
        <p className="text-center text-xs text-gray-600">
          Desenvolvido por{' '}
          <a
            href="https://pedroriquelme.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink-600 hover:text-pink-700 underline transition-colors"
          >
            Pedro Riquelme
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
