import React from 'react';
import { UserIcon } from './icons';
import { Link } from 'react-router-dom';

// Importar a imagem como módulo
const iconPath = '/icone-rosa.png';

const Header: React.FC = () => {
  return (
    <header className="bg-white/90 backdrop-blur-sm sticky top-0 z-50 border-b border-gray-300 shadow-sm">
      <div className="container mx-auto flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <img 
            src={iconPath} 
            alt="Studio Riquelme" 
            className="h-8 w-8 md:h-10 md:w-10 object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <h1 className="text-xl md:text-2xl font-bold tracking-wider text-gray-900">
            Agendamento Online <br className="hidden md:block" />
            Studio Riquelme
          </h1>
        </div>

        <div className="flex items-center">
          <Link
            to="/login-cliente"
            className="inline-flex items-center gap-2 text-gray-900 hover:text-pink-600 transition-colors"
            title="Acessar meus agendamentos"
          >
            <UserIcon className="w-6 h-6" />
            <span className="hidden sm:inline font-medium">Minha conta</span>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
