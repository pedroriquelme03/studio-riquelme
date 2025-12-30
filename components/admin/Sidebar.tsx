import React from 'react';
import { AdminView } from './Admin';
import { CalendarDaysIcon, ScissorsIcon, UserIcon, CalendarIcon } from '../icons';

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
      isActive ? 'bg-amber-500 text-gray-900 font-bold' : 'text-gray-300 hover:bg-gray-700'
    }`}
  >
    {icon}
    <span className="hidden md:inline">{label}</span>
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
      <nav className="flex md:flex-col justify-around md:justify-start md:space-y-2">
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
    </div>
  );
};

export default Sidebar;
