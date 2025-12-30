
import React, { useState } from 'react';
import { Client } from '../types';

interface UserDetailsFormProps {
  onBack: () => void;
  onSubmit: (client: Client) => void | Promise<void>;
}

// Função para aplicar máscara de telefone (XX) XXXXX-XXXX
const applyPhoneMask = (value: string): string => {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  // Aplica a máscara conforme o tamanho
  if (numbers.length <= 2) {
    return numbers.length > 0 ? `(${numbers}` : numbers;
  } else if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  } else if (numbers.length <= 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  } else {
    // Limita a 11 dígitos
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  }
};

// Função para remover máscara e obter apenas números
const removePhoneMask = (value: string): string => {
  return value.replace(/\D/g, '');
};

const UserDetailsForm: React.FC<UserDetailsFormProps> = ({ onBack, onSubmit }) => {
  const [formData, setFormData] = useState<Client>({
    name: '',
    phone: '',
    email: '', // Mantido para compatibilidade, mas não será usado
    notes: '',
  });
  
  const [errors, setErrors] = useState<Partial<Client>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Aplicar máscara apenas no campo de telefone
    if (name === 'phone') {
      // Remove caracteres não numéricos e aplica máscara
      const masked = applyPhoneMask(value);
      setFormData(prev => ({ ...prev, [name]: masked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Limpar erro do campo quando o usuário começar a digitar
    if (errors[name as keyof Client]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof Client];
        return newErrors;
      });
    }
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Permitir backspace, delete, tab, escape, enter e setas
    if ([8, 9, 27, 13, 46, 35, 36, 37, 38, 39, 40].indexOf(e.keyCode) !== -1 ||
      // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      (e.keyCode === 65 && e.ctrlKey === true) ||
      (e.keyCode === 67 && e.ctrlKey === true) ||
      (e.keyCode === 86 && e.ctrlKey === true) ||
      (e.keyCode === 88 && e.ctrlKey === true)) {
      return;
    }
    // Garantir que é um número e não uma tecla especial
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  };

  const validate = (): { isValid: boolean; errors: Partial<Client> } => {
    const newErrors: Partial<Client> = {};
    if (!formData.name.trim()) newErrors.name = "Nome é obrigatório";
    
    const phoneNumbers = removePhoneMask(formData.phone);
    if (!phoneNumbers || phoneNumbers.length < 10 || phoneNumbers.length > 11) {
      newErrors.phone = "Telefone inválido. Use o formato (XX) XXXXX-XXXX";
    }
    
    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSubmitting) {
      return; // Prevenir múltiplos cliques
    }
    
    console.log('Formulário submetido', formData);
    
    const validation = validate();
    
    if (validation.isValid) {
      console.log('Validação passou, chamando onSubmit');
      setIsSubmitting(true);
      try {
        // Remover máscara do telefone antes de enviar
        const phoneWithoutMask = removePhoneMask(formData.phone);
        const dataToSubmit = {
          ...formData,
          phone: phoneWithoutMask,
          email: '', // Email não é mais usado, mas mantido para compatibilidade com API
        };
        const result = onSubmit(dataToSubmit);
        // Se for uma Promise, aguardar
        if (result && typeof result === 'object' && 'then' in result) {
          await result;
        }
        // Se chegou aqui sem erro, o submit foi bem-sucedido
        // O estado será resetado quando o componente for desmontado ou quando houver erro
      } catch (error) {
        console.error('Erro ao submeter:', error);
        setIsSubmitting(false);
        // Re-throw para que o App.tsx possa tratar o erro também
        throw error;
      }
    } else {
      console.log('Validação falhou', validation.errors);
      // Scroll para o primeiro erro após um pequeno delay para garantir que os erros foram renderizados
      setTimeout(() => {
        const firstErrorField = Object.keys(validation.errors)[0];
        if (firstErrorField) {
          const element = document.getElementById(firstErrorField);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.focus();
          }
        }
      }, 100);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-2xl border border-gray-300 shadow-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Seus Dados</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
          <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-pink-600 focus:border-pink-600" />
          {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Telefone (WhatsApp)</label>
          <input 
            type="tel" 
            id="phone" 
            name="phone" 
            value={formData.phone} 
            onChange={handleChange}
            onKeyDown={handlePhoneKeyDown}
            maxLength={15}
            className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-pink-600 focus:border-pink-600" 
          />
          {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone}</p>}
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Observações (opcional)</label>
          <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} rows={3} className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-pink-600 focus:border-pink-600"></textarea>
        </div>
        <div className="flex flex-col gap-3 mt-8 border-t border-gray-300 pt-6">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Confirmando...
              </>
            ) : (
              'Confirmar Agendamento'
            )}
          </button>
          <button 
            type="button" 
            onClick={onBack} 
            disabled={isSubmitting}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Voltar
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserDetailsForm;
