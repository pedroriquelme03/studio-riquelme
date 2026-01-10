import React from 'react';
import { UserIcon, BellIcon } from './icons';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Importar a imagem como módulo
const iconPath = '/icone-rosa.png';

const Header: React.FC = () => {
  const { isAuthenticated } = useAuth();
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
    </header>
  );
};

export default Header;
