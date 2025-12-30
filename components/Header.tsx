import React from 'react';

// Importar a imagem como módulo
const iconPath = '/icone-rosa.png';

const Header: React.FC = () => {
  return (
    <header className="bg-white/90 backdrop-blur-sm sticky top-0 z-50 border-b border-gray-300 shadow-sm">
      <div className="container mx-auto flex justify-center items-center gap-3 p-4">
        <img 
          src={iconPath} 
          alt="Studio Riquelme" 
          className="h-8 w-8 md:h-10 md:w-10 object-contain"
          onError={(e) => {
            // Se a imagem não carregar, ocultar o elemento para não mostrar o ícone de erro
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
        <h1 className="text-xl md:text-2xl font-bold tracking-wider text-gray-900 text-center">
          Agendamento Online <br />
          Studio Riquelme
        </h1>
      </div>
    </header>
  );
};

export default Header;
