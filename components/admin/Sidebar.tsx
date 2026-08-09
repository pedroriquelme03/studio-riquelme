import React from 'react';
import { AdminView } from './Admin';
import { CalendarDaysIcon, ScissorsIcon, UserIcon, CalendarIcon, ClockIcon } from '../icons';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  activeView: AdminView;
  setActiveView: (view: AdminView) => void;
  variant?: 'desktop' | 'mobile';
}

const NavItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}> = ({ label, icon, isActive, onClick, compact }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors duration-200 ${
      isActive ? 'bg-gold font-bold' : 'text-zinc-200 hover:bg-surface-muted'
    } ${compact ? 'justify-center' : ''}`}
  >
    {icon}
    {!compact && <span>{label}</span>}
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, variant = 'desktop' }) => {
  const { logout, admin } = useAuth();
  const isMobile = variant === 'mobile';

  return (
    <div
      className={
        isMobile
          ? 'bg-surface-raised p-2 flex flex-col'
          : 'bg-surface-raised h-full min-h-screen w-full border-r border-line flex flex-col p-4'
      }
    >
      {!isMobile && (
        <div className="mb-6 pb-4 border-b border-line">
          <p className="text-xs font-semibold tracking-wide gold-text uppercase">Studio Riquelme</p>
          <p className="text-sm text-zinc-400 mt-0.5">Painel Admin</p>
          {admin && (
            <p className="mt-3 font-semibold text-white truncate">
              {admin.name || admin.username}
            </p>
          )}
        </div>
      )}

      <nav
        className={
          isMobile
            ? 'flex justify-around gap-1 overflow-x-auto'
            : 'flex flex-col space-y-1 flex-grow'
        }
      >
        <NavItem
          label="Agendamentos"
          icon={<CalendarDaysIcon className="w-6 h-6" />}
          isActive={activeView === 'appointments'}
          onClick={() => setActiveView('appointments')}
          compact={isMobile}
        />
        <NavItem
          label="Serviços"
          icon={<ScissorsIcon className="w-6 h-6" />}
          isActive={activeView === 'services'}
          onClick={() => setActiveView('services')}
          compact={isMobile}
        />
        <NavItem
          label="Profissionais"
          icon={<UserIcon className="w-6 h-6" />}
          isActive={activeView === 'professionals'}
          onClick={() => setActiveView('professionals')}
          compact={isMobile}
        />
        <NavItem
          label="Usuários"
          icon={<UserIcon className="w-6 h-6" />}
          isActive={activeView === 'users'}
          onClick={() => setActiveView('users')}
          compact={isMobile}
        />
        <NavItem
          label="Agenda"
          icon={<CalendarIcon className="w-6 h-6" />}
          isActive={activeView === 'schedule'}
          onClick={() => setActiveView('schedule')}
          compact={isMobile}
        />
        <NavItem
          label="Horários"
          icon={<ClockIcon className="w-6 h-6" />}
          isActive={activeView === 'hours'}
          onClick={() => setActiveView('hours')}
          compact={isMobile}
        />
        <NavItem
          label="Relatórios"
          icon={<CalendarDaysIcon className="w-6 h-6" />}
          isActive={activeView === 'reports'}
          onClick={() => setActiveView('reports')}
          compact={isMobile}
        />
      </nav>

      <div className={isMobile ? 'hidden' : 'mt-4 pt-4 border-t border-line'}>
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors duration-200 text-zinc-200 hover:bg-red-950/40 hover:text-red-400"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
