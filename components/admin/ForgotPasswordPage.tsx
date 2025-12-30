import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ForgotPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  // Estado para solicitar reset
  const [email, setEmail] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestError, setRequestError] = useState('');

  // Estado para redefinir senha
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  // Se tiver token, mostrar formulário de redefinição
  if (token) {
    const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setResetError('');

      if (newPassword !== confirmPassword) {
        setResetError('As senhas não coincidem');
        return;
      }

      if (newPassword.length < 6) {
        setResetError('A senha deve ter pelo menos 6 caracteres');
        return;
      }

      setIsResetting(true);

      try {
        const res = await fetch('/api/auth', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset-password',
            token,
            newPassword,
          }),
        });

        const data = await res.json();

        if (data.ok) {
          setResetSuccess(true);
          setTimeout(() => {
            navigate('/admin');
          }, 2000);
        } else {
          setResetError(data.error || 'Erro ao redefinir senha');
        }
      } catch (err) {
        setResetError('Erro ao redefinir senha. Tente novamente.');
      } finally {
        setIsResetting(false);
      }
    };

    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-gray-300 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Redefinir Senha</h1>
            <p className="text-gray-600">Digite sua nova senha</p>
          </div>

          {resetSuccess ? (
            <div className="text-center">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                Senha redefinida com sucesso! Redirecionando...
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Nova Senha
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-pink-600 focus:border-pink-600"
                  placeholder="Digite sua nova senha"
                  required
                  minLength={6}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-pink-600 focus:border-pink-600"
                  placeholder="Confirme sua nova senha"
                  required
                  minLength={6}
                />
              </div>

              {resetError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {resetError}
                </div>
              )}

              <button
                type="submit"
                disabled={isResetting}
                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isResetting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Redefinindo...
                  </>
                ) : (
                  'Redefinir Senha'
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="w-full text-gray-600 hover:text-gray-800 text-sm"
              >
                Voltar para login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Formulário para solicitar reset
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError('');
    setIsRequesting(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request-reset',
          email,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setRequestSuccess(true);
        // Em desenvolvimento, mostrar o link
        if (data.dev_link) {
          console.log('Link de reset (dev):', data.dev_link);
        }
      } else {
        setRequestError(data.error || 'Erro ao solicitar reset');
      }
    } catch (err) {
      setRequestError('Erro ao solicitar reset. Tente novamente.');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-gray-300 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Esqueci minha senha</h1>
          <p className="text-gray-600">Digite seu email para receber um link de redefinição</p>
        </div>

        {requestSuccess ? (
          <div className="text-center space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              Se o email existir em nosso sistema, você receberá um link para redefinir sua senha.
            </div>
            <button
              onClick={() => navigate('/admin')}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md"
            >
              Voltar para login
            </button>
          </div>
        ) : (
          <form onSubmit={handleRequestReset} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-pink-600 focus:border-pink-600"
                placeholder="Digite seu email"
                required
                autoFocus
              />
            </div>

            {requestError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {requestError}
              </div>
            )}

            <button
              type="submit"
              disabled={isRequesting}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isRequesting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Enviando...
                </>
              ) : (
                'Enviar Link de Redefinição'
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="w-full text-gray-600 hover:text-gray-800 text-sm"
            >
              Voltar para login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

