import React, { useState } from 'react';
import Sidebar from './Sidebar';
import AppointmentsView from './AppointmentsView';
import ServicesView from './ServicesView';
import ProfessionalsView from './ProfessionalsView';
import ScheduleView from './ScheduleView';
import ReportsView from './ReportsView';
import UsersView from './UsersView';

export type AdminView = 'appointments' | 'services' | 'professionals' | 'schedule' | 'reports' | 'users';

const Admin: React.FC = () => {
  const [activeView, setActiveView] = useState<AdminView>('appointments');

  const renderContent = () => {
    switch (activeView) {
      case 'appointments':
        return <AppointmentsView />;
      case 'services':
        return <ServicesView />;
      case 'professionals':
        return <ProfessionalsView />;
      case 'schedule':
        return <ScheduleView />;
      case 'reports':
        return <ReportsView />;
      case 'users':
        return <UsersView />;
      default:
        return <AppointmentsView />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="md:w-64 flex-shrink-0">
        <Sidebar activeView={activeView} setActiveView={setActiveView} />
      </div>
      <div className="flex-grow">
        {renderContent()}
      </div>
    </div>
  );
};

export default Admin;
