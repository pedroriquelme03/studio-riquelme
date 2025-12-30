import React from 'react';
import { Link } from 'react-router-dom';
import { ScissorsIcon, UserCogIcon } from './icons';
import { BARBERSHOP_NAME } from '../constants';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-50 border-b border-gray-700">
      <div className="container mx-auto flex justify-between items-center p-4">
        <div className="flex items-center space-x-3">
          <ScissorsIcon className="h-8 w-8 text-amber-400" />
          <Link to="/" className="text-xl md:text-2xl font-bold tracking-wider text-white hover:text-amber-400 transition-colors duration-300">
            {BARBERSHOP_NAME}
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            to="/admin"
            title="Painel Admin"
            className="text-gray-300 hover:text-amber-400 transition-colors duration-300"
          >
            <UserCogIcon className="h-6 w-6"/>
          </Link>
          <Link to="/" className="bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold py-2 px-4 rounded-lg transition-colors duration-300">
            Agendar agora
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
