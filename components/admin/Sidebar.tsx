import React from 'react';
import { AdminView } from './Admin';
import { CalendarDaysIcon, ScissorsIcon, UserIcon, CalendarIcon } from '../icons';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  activeView: AdminView;
  setActiveView: (view: AdminView) => void;
}

const NavItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors duration-200 ${
      isActive ? 'bg-pink-600 text-white font-bold' : 'text-gray-700 hover:bg-gray-100'
    }`}
  >
    {icon}
    <span className="hidden md:inline">{label}</span>
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
  const { logout, admin } = useAuth();

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-300 shadow-sm flex flex-col h-full">
      {admin && (
        <div className="mb-4 pb-4 border-b border-gray-300">
          <p className="text-sm text-gray-600">Logado como:</p>
          <p className="font-semibold text-gray-900">{admin.name || admin.username}</p>
        </div>
      )}
      <nav className="flex md:flex-col justify-around md:justify-start md:space-y-2 flex-grow">
        <NavItem
          label="Agendamentos"
          icon={<CalendarDaysIcon className="w-6 h-6" />}
          isActive={activeView === 'appointments'}
          onClick={() => setActiveView('appointments')}
        />
        <NavItem
          label="Serviços"
          icon={<ScissorsIcon className="w-6 h-6" />}
          isActive={activeView === 'services'}
          onClick={() => setActiveView('services')}
        />
        <NavItem
          label="Profissionais"
          icon={<UserIcon className="w-6 h-6" />}
          isActive={activeView === 'professionals'}
          onClick={() => setActiveView('professionals')}
        />
        <NavItem
          label="Usuários"
          icon={<UserIcon className="w-6 h-6" />}
          isActive={activeView === 'users'}
          onClick={() => setActiveView('users')}
        />
        <NavItem
          label="Agenda"
          icon={<CalendarIcon className="w-6 h-6" />}
          isActive={activeView === 'schedule'}
          onClick={() => setActiveView('schedule')}
        />
        <NavItem
          label="Relatórios"
          icon={<CalendarDaysIcon className="w-6 h-6" />}  // reutilizando ícone
          isActive={activeView === 'reports'}
          onClick={() => setActiveView('reports')}
        />
      </nav>
      <div className="mt-4 pt-4 border-t border-gray-300">
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors duration-200 text-gray-700 hover:bg-red-50 hover:text-red-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden md:inline">Sair</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
