
import React, { useState } from 'react';
import { Client } from '../types';

interface UserDetailsFormProps {
  onBack: () => void;
  onSubmit: (client: Client) => void;
}

const UserDetailsForm: React.FC<UserDetailsFormProps> = ({ onBack, onSubmit }) => {
  const [formData, setFormData] = useState<Client>({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });
  
  const [errors, setErrors] = useState<Partial<Client>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Client> = {};
    if (!formData.name.trim()) newErrors.name = "Nome é obrigatório";
    if (!formData.phone.trim()) newErrors.phone = "Telefone é obrigatório";
    if (!formData.email.trim()) {
      newErrors.email = "E-mail é obrigatório";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Formato de e-mail inválido";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-gray-800/50 p-6 md:p-8 rounded-2xl border border-gray-700 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6">Seus Dados</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Nome Completo</label>
          <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-amber-500 focus:border-amber-500" />
          {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">Telefone (WhatsApp)</label>
          <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-amber-500 focus:border-amber-500" />
          {errors.phone && <p className="text-red-400 text-sm mt-1">{errors.phone}</p>}
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">E-mail</label>
          <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-amber-500 focus:border-amber-500" />
          {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">Observações (opcional)</label>
          <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} rows={3} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-amber-500 focus:border-amber-500"></textarea>
        </div>
        <div className="flex justify-between mt-8 border-t border-gray-700 pt-6">
          <button type="button" onClick={onBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors">Voltar</button>
          <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold py-3 px-6 rounded-lg transition-colors">Confirmar Agendamento</button>
        </div>
      </form>
    </div>
  );
};

export default UserDetailsForm;
