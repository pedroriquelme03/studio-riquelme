import React from 'react';
import { UserIcon, BellIcon } from './icons';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Importar a imagem como módulo
const iconPath = '/icone-rosa.png';

const Header: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [showNotif, setShowNotif] = React.useState(false);
  const [notifLoading, setNotifLoading] = React.useState(false);
  const [notifItems, setNotifItems] = React.useState<Array<any>>([]);

  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch(`/api/notifications?since=${encodeURIComponent(since)}`);
      const data = await res.json();
      if (res.ok && data?.ok) {
        setNotifItems(data.items || []);
      } else {
        setNotifItems([]);
      }
    } catch {
      setNotifItems([]);
    } finally {
      setNotifLoading(false);
    }
  };
  return (
    <header className="bg-white/90 backdrop-blur-sm sticky top-0 z-50 border-b border-gray-300 shadow-sm">
      <div className="container mx-auto flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Link to="/" title="Início" className="inline-block">
            <img 
              src={iconPath} 
              alt="Studio Riquelme" 
              className="h-8 w-8 md:h-10 md:w-10 object-contain cursor-pointer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </Link>
          <h1 className="text-base md:text-lg font-bold tracking-wider text-gray-900 leading-tight">
            Agendamento Online <br />
            Studio Riquelme
          </h1>
        </div>

        <div className="flex items-center">
          {isAuthenticated ? (
            <button
              type="button"
              aria-label="Notificações"
              title="Notificações"
              className="inline-flex items-center justify-center text-gray-900 hover:text-pink-600 transition-colors"
              onClick={() => { setShowNotif(true); loadNotifications(); }}
            >
              <BellIcon className="w-6 h-6" />
            </button>
          ) : (
            <Link
              to="/login-cliente"
              className="inline-flex items-center gap-2 text-gray-900 hover:text-pink-600 transition-colors"
              title="Acessar meus agendamentos"
            >
              <UserIcon className="w-6 h-6" />
              <span className="hidden sm:inline font-medium">Minha conta</span>
            </Link>
          )}
        </div>
      </div>

      {isAuthenticated && showNotif && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowNotif(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-gray-300 shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900">Notificações (últimas 24h)</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadNotifications}
                  className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-900"
                  disabled={notifLoading}
                >
                  {notifLoading ? 'Atualizando...' : 'Atualizar'}
                </button>
                <button onClick={() => setShowNotif(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {!notifLoading && notifItems.length === 0 && (
                <div className="text-gray-600 text-sm">Sem notificações recentes.</div>
              )}
              <ul className="divide-y divide-gray-200">
                {notifItems.map((n, idx) => (
                  <li key={n.id || idx} className="py-2 text-sm">
                    {n.type === 'booking' && (
                      <div className="flex items-center justify-between">
                        <div className="text-gray-800">
                          <span className="font-semibold">Novo agendamento</span> — {n.client_name || 'Cliente'} em {new Date(n.date).toLocaleDateString('pt-BR')} às {String(n.time || '').slice(0,5)}
                        </div>
                        <div className="text-xs text-gray-500">{new Date(n.at).toLocaleString('pt-BR')}</div>
                      </div>
                    )}
                    {n.type === 'cancellation' && (
                      <div className="flex items-center justify-between">
                        <div className="text-gray-800">
                          <span className="font-semibold text-red-700">Cancelamento</span> — {n.client_name || 'Cliente'} ( {new Date(n.date).toLocaleDateString('pt-BR')} às {String(n.time || '').slice(0,5)} )
                        </div>
                        <div className="text-xs text-gray-500">{new Date(n.at).toLocaleString('pt-BR')}</div>
                      </div>
                    )}
                    {n.type === 'reschedule_request' && (
                      <div className="flex items-center justify-between">
                        <div className="text-gray-800">
                          <span className="font-semibold">Solicitação de troca</span> — para {new Date(n.requested_date).toLocaleDateString('pt-BR')} às {String(n.requested_time || '').slice(0,5)} ({n.status === 'pending' ? 'Pendente' : n.status === 'approved' ? 'Aprovada' : 'Negada'})
                        </div>
                        <div className="text-xs text-gray-500">{new Date(n.at).toLocaleString('pt-BR')}</div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
