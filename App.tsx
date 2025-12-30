import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Service, Booking, Client } from './types';
import Header from './components/Header';
import StepIndicator from './components/StepIndicator';
import ServiceSelector from './components/ServiceSelector';
import DateTimePicker from './components/DateTimePicker';
import UserDetailsForm from './components/UserDetailsForm';
import ConfirmationPage from './components/ConfirmationPage';
import Admin from './components/admin/Admin';
import ProtectedRoute from './components/admin/ProtectedRoute';
import ProfilesList from './components/ProfilesList';
import TestSupabaseConnection from './components/TestSupabaseConnection';
import Footer from './components/Footer';

type Step = 'services' | 'datetime' | 'details' | 'confirmation';

const App: React.FC = () => {
  const [step, setStep] = useState<Step>('services');
  const [booking, setBooking] = useState<Partial<Booking>>({
    services: [],
  });
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [servicesLoading, setServicesLoading] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      setServicesLoading(true);
      setServicesError(null);
      try {
        const res = await fetch('/api/services');
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Erro ao carregar serviços');
        setAvailableServices((data.services || []) as Service[]);
      } catch (e: any) {
        setServicesError(e?.message || 'Erro ao carregar serviços');
      } finally {
        setServicesLoading(false);
      }
    })();
  }, []);

  const totalDuration = useMemo(() => 
    booking.services?.reduce((total, s) => total + s.duration, 0) || 0,
    [booking.services]
  );

  const totalPrice = useMemo(() => 
    booking.services?.reduce((total, s) => total + s.price, 0) || 0,
    [booking.services]
  );

  const handleSelectServices = (selectedServices: Service[]) => {
    setBooking(prev => ({ ...prev, services: selectedServices }));
  };

  const handleDateTimeSelect = (date: Date, time: string) => {
    setBooking(prev => ({ ...prev, date, time }));
    setStep('details');
  };

  const handleUserDetailsSubmit = async (client: Client) => {
    console.log('handleUserDetailsSubmit chamado', { client, booking });
    
    // Persistir agendamento antes de confirmar
    const current = { ...booking, client };
    try {
      const dateObj = current.date as Date | undefined;
      const timeStr = (current.time as string | undefined) || '';
      const services = current.services || [];
      
      console.log('Dados do agendamento:', { dateObj, timeStr, services });
      
      if (!dateObj || !timeStr || services.length === 0) {
        alert('Selecione serviços, data e hora antes de confirmar.');
        return;
      }
      
      const date = dateObj.toISOString().slice(0, 10); // yyyy-mm-dd
      // Garantir formato HH:MM para a API
      const time = timeStr.length === 5 ? timeStr : timeStr.slice(0, 5); // HH:MM
      
      const body = {
        date,
        time,
        professional_id: null as string | null,
        client,
        services: services.map(s => ({ id: s.id, quantity: 1 })),
      };
      
      console.log('Enviando requisição para /api/bookings:', body);
      
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      console.log('Resposta recebida:', res.status, res.statusText);
      
      if (!res.ok) {
        let message = 'Falha ao criar agendamento';
        try {
          const text = await res.text();
          console.error('Erro da API:', text);
          try {
            const j = JSON.parse(text);
            message = j?.error || message;
          } catch {
            if (text) message = text;
          }
        } catch {}
        throw new Error(message);
      }
      
      const responseData = await res.json();
      console.log('Agendamento criado com sucesso:', responseData);
      
      setBooking(prev => ({ ...prev, client }));
      setStep('confirmation');
    } catch (e: any) {
      console.error('Erro ao confirmar agendamento:', e);
      alert(e?.message || 'Erro ao confirmar agendamento. Verifique o console para mais detalhes.');
    }
  };

  const startNewBooking = () => {
    setBooking({ services: [] });
    setStep('services');
  };

  const renderStep = () => {
    switch (step) {
      case 'services':
        return (
          <ServiceSelector
            services={availableServices}
            selectedServices={booking.services || []}
            onSelectServices={handleSelectServices}
            onNext={() => setStep('datetime')}
            totalDuration={totalDuration}
            totalPrice={totalPrice}
          />
        );
      case 'datetime':
        return (
          <DateTimePicker
            onBack={() => setStep('services')}
            onDateTimeSelect={handleDateTimeSelect}
            serviceDuration={totalDuration}
          />
        );
      case 'details':
        return (
          <UserDetailsForm
            onBack={() => setStep('datetime')}
            onSubmit={handleUserDetailsSubmit}
          />
        );
      case 'confirmation':
        return (
          <ConfirmationPage
            booking={booking as Booking}
            onNewBooking={startNewBooking}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
      <Header />
      <main className="container mx-auto p-4 md:p-8 flex-grow">
        <Routes>
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } 
          />
          <Route path="/profiles" element={<ProfilesList />} />
          <Route path="/supabase-test" element={<TestSupabaseConnection />} />
          <Route
            path="/"
            element={
              <>
                {step !== 'confirmation' && <StepIndicator currentStep={step} />}
                <div className="mt-8">
                  {renderStep()}
                </div>
              </>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

export default App;
