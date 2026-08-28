import React, { useState } from 'react';
import Sidebar from './Sidebar';
import AppointmentsView from './AppointmentsView';
import ServicesView from './ServicesView';
import ProfessionalsView from './ProfessionalsView';
import ScheduleView from './ScheduleView';
import ReportsView from './ReportsView';
import UsersView from './UsersView';
import HoursSettingsView from './HoursSettingsView';
import PromotionsView from './PromotionsView';
import BioLinksView from './BioLinksView';
import MonthlyPlansView from './MonthlyPlansView';

export type AdminView = 'appointments' | 'services' | 'promotions' | 'monthly_plans' | 'professionals' | 'schedule' | 'reports' | 'users' | 'hours' | 'bio';

const Admin: React.FC = () => {
  const [activeView, setActiveView] = useState<AdminView>('appointments');

  const renderContent = () => {
    switch (activeView) {
      case 'appointments':
        return <AppointmentsView />;
      case 'services':
        return <ServicesView />;
      case 'promotions':
        return <PromotionsView />;
      case 'monthly_plans':
        return <MonthlyPlansView />;
      case 'professionals':
        return <ProfessionalsView />;
      case 'schedule':
        return <ScheduleView />;
      case 'reports':
        return <ReportsView />;
      case 'users':
        return <UsersView />;
      case 'hours':
        return <HoursSettingsView />;
      case 'bio':
        return <BioLinksView />;
      default:
        return <AppointmentsView />;
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Sidebar fixa na borda esquerda (desktop) */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-40 md:w-64">
        <Sidebar activeView={activeView} setActiveView={setActiveView} />
      </aside>

      {/* Menu horizontal no mobile */}
      <div className="md:hidden border-b border-line bg-surface-raised sticky top-0 z-40">
        <Sidebar activeView={activeView} setActiveView={setActiveView} variant="mobile" />
      </div>

      {/* Conteúdo com offset da sidebar */}
      <div className="md:pl-64 min-h-screen">
        <div className="p-4 md:p-8">{renderContent()}</div>
      </div>
    </div>
  );
};

export default Admin;
