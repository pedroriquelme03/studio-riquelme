import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white/90 backdrop-blur-sm sticky top-0 z-50 border-b border-gray-300 shadow-sm">
      <div className="container mx-auto flex justify-center items-center p-4">
        <h1 className="text-xl md:text-2xl font-bold tracking-wider text-gray-900">
          Agendamento Online Studio Riquelme
        </h1>
      </div>
    </header>
  );
};

export default Header;
