import React, { useEffect, useState } from 'react';

type Professional = { id: string; name: string };
type ServerSub = { endpoint: string; professional_id: string | null };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  // Em desenvolvimento o service worker não é registrado; ready ficaria pendente para sempre.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);
}

const AdminPushNotifications: React.FC = () => {
  const [supported, setSupported] = useState(true);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unknown'>('unknown');
  const [publicKey, setPublicKey] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [active, setActive] = useState(false);
  const [professionalId, setProfessionalId] = useState('');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const tick = () => {
      fetch('/api/notifications?job=reminders', { credentials: 'same-origin' }).catch(() => {});
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const iosInstall = isIos() && !isStandalone();
      if (!cancelled) setNeedsInstall(iosInstall);

      const pushOk = 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator;
      if (!pushOk) {
        if (!cancelled) setSupported(false);
        return;
      }
      if (!cancelled) setPermission(Notification.permission);

      try {
        const [configRes, profRes] = await Promise.all([
          fetch('/api/notifications?push=config', { credentials: 'same-origin' }),
          fetch('/api/professionals', { credentials: 'same-origin' }),
        ]);
        const config = await configRes.json().catch(() => null);
        const profData = await profRes.json().catch(() => null);
        if (cancelled) return;
        if (config?.publicKey) setPublicKey(config.publicKey);
        if (config?.setupRequired) setSetupRequired(true);
        const list = ((profData?.professionals || []) as Professional[]).filter((p) => p?.id && p?.name);
        setProfessionals(list);

        if (iosInstall) return;
        const reg = await getReadyRegistration();
        if (!reg || cancelled) return;
        const local = await reg.pushManager.getSubscription();
        const serverSubs = (config?.subscriptions || []) as ServerSub[];
        const known = local ? serverSubs.find((s) => s.endpoint === local.endpoint) : undefined;
        if (known) {
          setActive(true);
          setProfessionalId(known.professional_id || '');
        }
      } catch {
        if (!cancelled) setError('Não foi possível carregar as notificações.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveSubscription = async (professional: string) => {
    const reg = await getReadyRegistration();
    if (!reg) throw new Error('O app ainda não está pronto para notificações. Atualize a página.');
    if (!publicKey) throw new Error('Chave de notificação indisponível.');

    const appKey = urlBase64ToUint8Array(publicKey);
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey as BufferSource });
      } catch {
        await (await reg.pushManager.getSubscription())?.unsubscribe();
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey as BufferSource });
      }
    }
    const res = await fetch('/api/notifications', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'subscribe',
        professional_id: professional || null,
        subscription: sub.toJSON(),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Não foi possível ativar as notificações.');
  };

  const enable = async () => {
    setError('');
    if (setupRequired) {
      setError('Falta criar as tabelas no banco. Execute sql/push-notifications-schema.sql no Supabase.');
      return;
    }
    if (needsInstall) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Permissão de notificação negada.');
        return;
      }
      await saveSubscription(professionalId);
      setActive(true);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível ativar as notificações.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setError('');
    setBusy(true);
    try {
      const reg = await getReadyRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/notifications', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setActive(false);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível desativar.');
    } finally {
      setBusy(false);
    }
  };

  const changeProfessional = async (value: string) => {
    setProfessionalId(value);
    if (!active) return;
    setBusy(true);
    setError('');
    try {
      await saveSubscription(value);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível atualizar o profissional.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface-raised p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            {active ? 'Notificações ativas neste aparelho' : 'Notificações do app'}
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Aviso quando entrar um agendamento novo e lembrete 1 hora antes de cada atendimento.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {professionals.length > 0 && (
            <select
              value={professionalId}
              onChange={(e) => changeProfessional(e.target.value)}
              disabled={busy}
              aria-label="Receber avisos de"
              className="bg-surface text-white border border-line rounded px-3 py-2 text-sm"
            >
              <option value="">Todos os profissionais</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {active ? (
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="py-2 px-3 rounded-lg border border-line text-zinc-200 text-sm hover:bg-surface-muted disabled:opacity-50"
            >
              {busy ? 'Salvando...' : 'Desativar'}
            </button>
          ) : (
            <button
              type="button"
              onClick={enable}
              disabled={busy || !supported || needsInstall}
              className="py-2 px-3 rounded-lg bg-gold text-[#111] font-bold text-sm hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Ativando...' : 'Ativar notificações'}
            </button>
          )}
        </div>
      </div>
      {needsInstall && (
        <p className="text-xs text-gold mt-3">
          No iPhone, instale o painel na Tela de Início e abra por esse ícone para receber notificações.
        </p>
      )}
      {!supported && (
        <p className="text-xs text-zinc-400 mt-3">Este navegador não envia notificações do app.</p>
      )}
      {permission === 'denied' && (
        <p className="text-xs text-red-300 mt-3">
          O navegador bloqueou as notificações. Libere nas configurações do site e tente de novo.
        </p>
      )}
      {setupRequired && (
        <p className="text-xs text-gold mt-3">
          Falta criar as tabelas no banco. Execute sql/push-notifications-schema.sql no Supabase.
        </p>
      )}
      {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
    </div>
  );
};

export default AdminPushNotifications;
