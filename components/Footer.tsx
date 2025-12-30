import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="py-[50px] border-t border-gray-300 mt-auto">
      <div className="container mx-auto px-4 text-center">
        <p className="text-xs text-gray-600">
          Desenvolvido por{' '}
          <a
            href="https://pedroriquelme.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink-600 hover:text-pink-700 underline transition-colors"
          >
            Pedro Riquelme
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;

