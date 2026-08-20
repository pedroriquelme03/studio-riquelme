import React, { useEffect, useState } from 'react';
import {
  CalendarDaysIcon,
  WhatsAppIcon,
  LocationIcon,
  LinkIcon,
  InstagramIcon,
  ChevronRightIcon,
} from '../icons';

type BioLink = {
  id: string;
  kind: 'link' | 'header';
  title: string;
  subtitle: string;
  url: string;
  icon: string;
  isActive: boolean;
};

type BioData = {
  title: string;
  subtitle: string;
  links: BioLink[];
};

const iconFor = (icon: string) => {
  const cls = 'w-6 h-6';
  switch (icon) {
    case 'calendar':
      return <CalendarDaysIcon className={cls} />;
    case 'whatsapp':
      return <WhatsAppIcon className={cls} />;
    case 'location':
      return <LocationIcon className={cls} />;
    case 'instagram':
      return <InstagramIcon className={cls} />;
    default:
      return <LinkIcon className={cls} />;
  }
};

const logoPath = '/icone-rosa.png';

const BioPage: React.FC = () => {
  const [data, setData] = useState<BioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Studio Riquelme · Links';
    (async () => {
      try {
        const res = await fetch('/api/bio-links');
        const json = await res.json();
        if (res.ok && json?.ok) {
          setData({ title: json.title, subtitle: json.subtitle, links: json.links || [] });
        } else {
          setData({ title: 'Studio Riquelme', subtitle: '', links: [] });
        }
      } catch {
        setData({ title: 'Studio Riquelme', subtitle: '', links: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-surface text-white flex flex-col items-center px-4 py-10 sm:py-14 relative overflow-hidden">
      {/* Brilho dourado sutil no topo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full blur-3xl opacity-25"
        style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.35) 0%, rgba(212,175,55,0) 70%)' }}
      />

      <div className="relative w-full max-w-md flex flex-col items-center">
        {/* Cabeçalho */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-24 h-24 rounded-full border-2 border-gold shadow-gold flex items-center justify-center bg-surface-raised overflow-hidden">
            <img
              src={logoPath}
              alt={data?.title || 'Studio Riquelme'}
              className="w-16 h-16 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-wide gold-text">
            {data?.title || 'Studio Riquelme'}
          </h1>
          {data?.subtitle ? (
            <p className="mt-2 text-sm text-zinc-300 max-w-xs leading-relaxed">{data.subtitle}</p>
          ) : null}
        </div>

        {/* Botões */}
        <div className="w-full flex flex-col gap-3">
          {loading && (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-2xl bg-surface-raised border border-line animate-pulse" />
              ))}
            </>
          )}

          {!loading &&
            data?.links.map((link) => {
              if (link.kind === 'header') {
                return (
                  <div key={link.id} className="mt-4 mb-1 first:mt-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/80">
                      {link.title}
                    </span>
                  </div>
                );
              }

              const hasUrl = !!link.url;
              const content = (
                <>
                  <span className="flex-shrink-0 w-11 h-11 rounded-xl bg-gold/10 border border-gold/30 text-gold flex items-center justify-center">
                    {iconFor(link.icon)}
                  </span>
                  <span className="flex flex-col text-left min-w-0 flex-1">
                    <span className="font-semibold text-white truncate">{link.title}</span>
                    {link.subtitle ? (
                      <span className="text-sm text-zinc-400 truncate">{link.subtitle}</span>
                    ) : null}
                  </span>
                  <span className="flex-shrink-0 text-gold/60 group-hover:text-gold group-hover:translate-x-0.5 transition-all">
                    <ChevronRightIcon className="w-5 h-5" />
                  </span>
                </>
              );

              const baseClass =
                'group w-full flex items-center gap-3 p-3 rounded-2xl border border-line bg-surface-raised transition-all';

              return hasUrl ? (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${baseClass} hover:border-gold/60 hover:bg-surface-overlay hover:shadow-gold`}
                >
                  {content}
                </a>
              ) : (
                <div key={link.id} className={`${baseClass} opacity-60 cursor-default`} title="Link ainda não configurado">
                  {content}
                </div>
              );
            })}

          {!loading && data && data.links.length === 0 && (
            <p className="text-center text-zinc-400 text-sm py-8">Nenhum link cadastrado ainda.</p>
          )}
        </div>

        {/* Rodapé */}
        <div className="mt-12 text-center">
          <a
            href="https://pedroriquelme.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-gold transition-colors"
          >
            Desenvolvido por Pedro Riquelme
          </a>
        </div>
      </div>
    </div>
  );
};

export default BioPage;
