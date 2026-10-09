import React, { useEffect, useState } from 'react';

const DISMISS_KEY = 'sr_admin_pwa_install_dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const chromeOrCriOS = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit && !chromeOrCriOS;
}

/**
 * Banner de instalação do PWA do painel admin.
 * Chrome/Android: beforeinstallprompt. iOS Safari: instrução "Adicionar à Tela de Início".
 */
const AdminPwaInstall: React.FC = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosTip, setIosTip] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {}

    if (dismissed) return;

    if (isIosSafari()) {
      setIosTip(true);
      setVisible(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {}
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      // usuário cancelou ou navegador bloqueou
    } finally {
      setInstalling(false);
      setDeferred(null);
      setVisible(false);
    }
  };

  if (!visible) return null;
  if (!iosTip && !deferred) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[60]">
      <div className="bg-surface-raised border border-line rounded-xl shadow-xl p-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Instalar Painel Admin</p>
          {iosTip ? (
            <p className="text-xs text-zinc-400 mt-1">
              No Safari, toque em <span className="text-gold">Compartilhar</span> e depois em{' '}
              <span className="text-gold">Adicionar à Tela de Início</span>.
            </p>
          ) : (
            <p className="text-xs text-zinc-400 mt-1">
              Adicione o app à tela inicial para abrir como aplicativo, sem barra do navegador.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-2 px-3 rounded-lg border border-line text-zinc-300 text-sm hover:bg-surface-muted"
          >
            Agora não
          </button>
          {!iosTip && (
            <button
              type="button"
              onClick={install}
              disabled={installing}
              className="flex-1 py-2 px-3 rounded-lg bg-gold text-[#111] font-bold text-sm hover:brightness-110 disabled:opacity-50"
            >
              {installing ? 'Abrindo...' : 'Instalar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPwaInstall;
