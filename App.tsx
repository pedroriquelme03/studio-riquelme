import React, { useState, useMemo, useEffect, useCallback } from 'react';

import { Routes, Route, useLocation } from 'react-router-dom';

import { Service, Booking, Client, BookingCartItem } from './types';

import Header from './components/Header';

import StepIndicator from './components/StepIndicator';

import ServiceSelector from './components/ServiceSelector';

import PromotionSelector from './components/PromotionSelector';

import DateTimePicker from './components/DateTimePicker';

import PromotionDateTimePicker from './components/PromotionDateTimePicker';

import BookingCartModal from './components/BookingCartModal';

import UserDetailsForm from './components/UserDetailsForm';

import ConfirmationPage from './components/ConfirmationPage';

import Admin from './components/admin/Admin';

import ProtectedRoute from './components/admin/ProtectedRoute';

import ForgotPasswordPage from './components/admin/ForgotPasswordPage';

import LoginPage from './components/admin/LoginPage';

import Footer from './components/Footer';

import ClientLoginPage from './components/client/ClientLoginPage';

import ClientBookingsPage from './components/client/ClientBookingsPage';
import MonthlyPlansPage from './components/MonthlyPlansPage';
import ClientMyPlanPage from './components/client/ClientMyPlanPage';

import PoliticaPrivacidadePage from './components/legal/PoliticaPrivacidadePage';

import TermosServicosPage from './components/legal/TermosServicosPage';

import BioPage from './components/bio/BioPage';

import { conflictsWithCart, formatDateYmd, validateSlotOnServer } from './lib/bookingCart';

import HairSizeSelector from './components/HairSizeSelector';

import { applyPriceSelection, serviceRequiresHairSize } from './lib/priceVariations';

import type { ServicePriceSelection } from './types';



type Step = 'services' | 'variation' | 'datetime' | 'details' | 'confirmation';

type BookingMode = 'services' | 'promotion';



function newCartItemId() {

  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

}



const App: React.FC = () => {

  const location = useLocation();

  const isAdminShell = location.pathname === '/admin';

  const isBareShell = isAdminShell || location.pathname === '/bio';

  const [step, setStep] = useState<Step>('services');

  const [bookingMode, setBookingMode] = useState<BookingMode>('services');

  const [booking, setBooking] = useState<Partial<Booking>>({

    services: [],

    bookingMode: 'services',

    cartItems: [],

  });

  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const [selectedPriceSelection, setSelectedPriceSelection] = useState<ServicePriceSelection | null>(null);

  const [usePlanBenefit, setUsePlanBenefit] = useState(false);

  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null);

  const [draftDate, setDraftDate] = useState<Date | null>(null);

  const [draftTime, setDraftTime] = useState<string | null>(null);

  const [showCartModal, setShowCartModal] = useState(false);

  const [availableServices, setAvailableServices] = useState<Service[]>([]);

  const [servicesError, setServicesError] = useState<string | null>(null);

  const [servicesLoading, setServicesLoading] = useState<boolean>(false);

  const [professionalsMap, setProfessionalsMap] = useState<Record<string, string>>({});



  useEffect(() => {

    (async () => {

      setServicesLoading(true);

      setServicesError(null);

      try {

        const [svcRes, profRes] = await Promise.all([

          fetch('/api/services'),

          fetch('/api/professionals'),

        ]);

        const parseJson = async (res: Response) => {
          const text = await res.text();
          try {
            return text ? JSON.parse(text) : {};
          } catch {
            throw new Error(
              res.ok
                ? 'Resposta inválida do servidor'
                : text.slice(0, 120) || `Erro HTTP ${res.status}`,
            );
          }
        };

        const [svcData, profData] = await Promise.all([parseJson(svcRes), parseJson(profRes)]);

        if (!svcRes.ok) throw new Error(svcData?.error || 'Erro ao carregar serviços');

        setAvailableServices((svcData.services || []) as Service[]);

        if (profRes.ok) {

          const map: Record<string, string> = {};

          (profData.professionals || []).forEach((p: { id: string; name: string }) => {

            map[p.id] = p.name;

          });

          setProfessionalsMap(map);

        }

      } catch (e: any) {

        setServicesError(e?.message || 'Erro ao carregar serviços');

      } finally {

        setServicesLoading(false);

      }

    })();

  }, []);



  const cartItems = booking.cartItems || [];



  const effectiveSelectedService = useMemo(() => {

    if (!selectedService) return null;

    if (selectedPriceSelection) return applyPriceSelection(selectedService, selectedPriceSelection);

    return selectedService;

  }, [selectedService, selectedPriceSelection]);



  const cartTotalPrice = useMemo(

    () => cartItems.reduce((sum, item) => sum + item.service.price, 0),

    [cartItems],

  );



  const resolveProfessionalId = useCallback((service: Service) => {

    return service.responsibleProfessionalId || selectedProfessionalId || null;

  }, [selectedProfessionalId]);



  const resolveProfessionalName = useCallback((service: Service) => {

    const id = resolveProfessionalId(service);

    if (id && professionalsMap[id]) return professionalsMap[id];

    return service.responsibleProfessionalName || null;

  }, [resolveProfessionalId, professionalsMap]);



  const heldCartSlots = useMemo(() => cartItems.map((item) => ({

    date: formatDateYmd(item.date),

    time: item.time,

    duration: item.service.duration,

    professionalId: item.professionalId,

  })), [cartItems]);



  const validateDraftItem = async (
    service: Service,
    date: Date,
    time: string,
    excludeCartId?: string,
    professionalIdOverride?: string | null,
  ) => {
    const professionalId = professionalIdOverride !== undefined
      ? professionalIdOverride
      : resolveProfessionalId(service);
    const dateStr = formatDateYmd(date);
    if (conflictsWithCart(cartItems, date, time, service.duration, professionalId, excludeCartId)) {
      throw new Error('Este horário conflita com outro item do seu carrinho.');
    }
    const server = await validateSlotOnServer(dateStr, time, service.id, professionalId);
    if (!server.available) {
      throw new Error(server.error || 'Horário indisponível. Escolha outro horário.');
    }
  };



  const buildCartItem = (service: Service, date: Date, time: string, priceSelection?: ServicePriceSelection | null, withPlanBenefit?: boolean): BookingCartItem => {

    const pricedService = priceSelection ? applyPriceSelection(service, priceSelection) : service;
    const finalService = withPlanBenefit ? { ...pricedService, price: 0 } : pricedService;

    return {

    id: newCartItemId(),

    service: finalService,

    priceSelection: priceSelection ?? null,

    usePlanBenefit: Boolean(withPlanBenefit),

    date,

    time,

    professionalId: resolveProfessionalId(service),

    professionalName: resolveProfessionalName(service),

  };

  };



  const handleDateTimeSelect = (date: Date, time: string) => {

    setDraftDate(date);

    setDraftTime(time);

    setShowCartModal(true);

  };



  const clearDraft = () => {

    setSelectedService(null);

    setSelectedPriceSelection(null);

    setUsePlanBenefit(false);

    setDraftDate(null);

    setDraftTime(null);

    setShowCartModal(false);

  };



  const handleSelectService = (service: Service | null) => {

    setSelectedService(service);

    setSelectedPriceSelection(null);

    setUsePlanBenefit(false);

  };



  const goToNextFromService = () => {

    if (!selectedService) return;

    if (serviceRequiresHairSize(selectedService)) {

      setStep('variation');

      return;

    }

    setStep('datetime');

  };



  const handleAddMore = async () => {

    if (!selectedService || !draftDate || !draftTime) return;

    const serviceForBooking = effectiveSelectedService || selectedService;

    await validateDraftItem(serviceForBooking, draftDate, draftTime);

    const item = buildCartItem(selectedService, draftDate, draftTime, selectedPriceSelection, usePlanBenefit);

    setBooking((prev) => ({

      ...prev,

      cartItems: [...(prev.cartItems || []), item],

    }));

    clearDraft();

    setStep('services');

  };



  const handleFinalizeFromModal = async () => {

    if (!selectedService || !draftDate || !draftTime) return;

    const serviceForBooking = effectiveSelectedService || selectedService;

    await validateDraftItem(serviceForBooking, draftDate, draftTime);

    const item = buildCartItem(selectedService, draftDate, draftTime, selectedPriceSelection, usePlanBenefit);

    const allItems = [...cartItems, item];

    setBooking((prev) => ({

      ...prev,

      cartItems: allItems,

      services: allItems.map((i) => i.service),

      date: allItems[0].date,

      time: allItems[0].time,

    }));

    clearDraft();

    setStep('details');

  };



  const handleFinalizeCartOnly = async () => {
    if (cartItems.length === 0) return;
    try {
      for (const item of cartItems) {
        await validateDraftItem(item.service, item.date, item.time, item.id, item.professionalId);
      }
      setBooking((prev) => ({
        ...prev,
        services: cartItems.map((i) => i.service),
        date: cartItems[0].date,
        time: cartItems[0].time,
      }));
      setStep('details');
    } catch (e: any) {
      alert(e?.message || 'Erro ao validar itens do carrinho.');
    }
  };

  const handleRemoveCartItem = (id: string) => {
    setBooking((prev) => ({
      ...prev,
      cartItems: (prev.cartItems || []).filter((item) => item.id !== id),
    }));
  };



  const handleUserDetailsSubmit = async (client: Client) => {

    const current = { ...booking, client };

    try {

      if (current.bookingMode === 'promotion' && current.promotion) {

        const dateObj = current.date as Date;

        const timeStr = current.time as string;

        const date = dateObj.toISOString().slice(0, 10);

        const time = timeStr.length === 5 ? timeStr : timeStr.slice(0, 5);

        const res = await fetch('/api/bookings', {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({ date, time, promotion_id: current.promotion.id, client }),

        });

        if (!res.ok) {

          const data = await res.json().catch(() => ({}));

          throw new Error(data?.error || 'Falha ao criar agendamento da promoção');

        }

        setBooking((prev) => ({ ...prev, client }));

        setStep('confirmation');

        return;

      }



      const items = current.cartItems || [];

      if (items.length === 0) {

        alert('Nenhum item no agendamento.');

        return;

      }



      for (const item of items) {

        await validateDraftItem(item.service, item.date, item.time, item.id, item.professionalId);

        const date = formatDateYmd(item.date);

        const time = item.time.length === 5 ? item.time : item.time.slice(0, 5);

        const res = await fetch('/api/bookings', {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({

            date,

            time,

            professional_id: item.professionalId,

            client,

            services: [{
              id: item.service.id,
              quantity: 1,
              variation_type: item.priceSelection?.variationType,
              variant_key: item.priceSelection?.variantKey,
              use_plan_benefit: item.usePlanBenefit || false,
            }],

          }),

        });

        if (!res.ok) {

          const data = await res.json().catch(() => ({}));

          throw new Error(data?.error || `Falha ao agendar ${item.service.name}`);

        }

      }



      setBooking((prev) => ({

        ...prev,

        client,

        services: items.map((i) => i.service),

        date: items[0].date,

        time: items[0].time,

      }));

      setStep('confirmation');

    } catch (e: any) {

      alert(e?.message || 'Erro ao confirmar agendamento.');

    }

  };



  const startNewBooking = () => {

    setBooking({ services: [], bookingMode: 'services', cartItems: [] });

    setBookingMode('services');

    setSelectedService(null);

    setSelectedPriceSelection(null);

    setUsePlanBenefit(false);

    setSelectedProfessionalId(null);

    clearDraft();

    setStep('services');

  };



  const renderStep = () => {

    switch (step) {

      case 'services':

        return (

          <div>

            <div className="flex justify-center mb-6">

              <div className="inline-flex rounded overflow-hidden border border-line">

                <button

                  type="button"

                  onClick={() => { setBookingMode('services'); setBooking((p) => ({ ...p, bookingMode: 'services', promotion: null })); }}

                  className={`px-4 py-2 ${bookingMode === 'services' ? 'bg-gold text-white' : 'bg-surface-raised text-zinc-200'}`}

                >

                  Serviços

                </button>

                <button

                  type="button"

                  onClick={() => { setBookingMode('promotion'); setBooking((p) => ({ ...p, bookingMode: 'promotion', services: [], cartItems: [] })); clearDraft(); }}

                  className={`px-4 py-2 ${bookingMode === 'promotion' ? 'bg-gold text-white' : 'bg-surface-raised text-zinc-200'}`}

                >

                  Promoções

                </button>

              </div>

            </div>

            {servicesError && <div className="text-red-400 text-center mb-4">{servicesError}</div>}

            {servicesLoading && <div className="text-zinc-300 text-center mb-4">Carregando...</div>}

            {bookingMode === 'promotion' ? (

              <PromotionSelector

                selectedPromotion={booking.promotion || null}

                onSelectPromotion={(promotion) => setBooking((p) => ({ ...p, promotion, bookingMode: 'promotion' }))}

                onNext={() => setStep('datetime')}

              />

            ) : (

              <ServiceSelector

                services={availableServices}

                selectedService={selectedService}

                onSelectService={handleSelectService}

                selectedProfessionalId={selectedProfessionalId}

                onProfessionalChange={setSelectedProfessionalId}

                onNext={goToNextFromService}

                usePlanBenefit={usePlanBenefit}

                onUsePlanBenefitChange={setUsePlanBenefit}

                cartItems={cartItems}

                onRemoveCartItem={handleRemoveCartItem}

                cartTotalPrice={cartTotalPrice}
                onFinalizeCart={handleFinalizeCartOnly}
              />

            )}

          </div>

        );

      case 'variation':

        if (!selectedService) {

          setStep('services');

          return null;

        }

        return (

          <HairSizeSelector

            service={selectedService}

            selected={selectedPriceSelection}

            onSelect={setSelectedPriceSelection}

            onBack={() => setStep('services')}

            onNext={() => setStep('datetime')}

          />

        );

      case 'datetime':

        if (booking.bookingMode === 'promotion' && booking.promotion) {

          return (

            <PromotionDateTimePicker

              promotion={booking.promotion}

              onBack={() => setStep('services')}

              onDateTimeSelect={(date, time) => {

                setBooking((p) => ({ ...p, date, time }));

                setStep('details');

              }}

            />

          );

        }

        if (!effectiveSelectedService) {

          setStep('services');

          return null;

        }

        if (selectedService && serviceRequiresHairSize(selectedService) && !selectedPriceSelection) {

          setStep('variation');

          return null;

        }

        return (

          <>

            <DateTimePicker

              onBack={() => setStep(serviceRequiresHairSize(selectedService) ? 'variation' : 'services')}

              onDateTimeSelect={handleDateTimeSelect}

              serviceDuration={effectiveSelectedService.duration}

              professionalId={resolveProfessionalId(effectiveSelectedService)}

              heldCartItems={heldCartSlots}

            />

            {showCartModal && draftDate && draftTime && (

              <BookingCartModal

                service={effectiveSelectedService}

                date={draftDate}

                time={draftTime}

                priceSelection={selectedPriceSelection}

                professionalName={resolveProfessionalName(effectiveSelectedService)}

                cartItems={cartItems}

                cartTotal={cartTotalPrice}

                onClose={() => setShowCartModal(false)}

                onAddMore={handleAddMore}

                onFinalize={handleFinalizeFromModal}

              />

            )}

          </>

        );

      case 'details':

        return (

          <UserDetailsForm

            onBack={() => {

              if (cartItems.length > 0) {

                setStep('services');

                return;

              }

              if (selectedService && serviceRequiresHairSize(selectedService)) {

                setStep('variation');

                return;

              }

              setStep('datetime');

            }}

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

    <div className="min-h-screen bg-surface text-white font-sans flex flex-col">

      {!isBareShell && <Header />}

      <main

        className={

          isBareShell

            ? 'flex-grow w-full min-h-screen p-0 m-0'

            : 'container mx-auto p-4 md:p-8 flex-grow'

        }

      >

        <Routes>

          <Route 

            path="/admin" 

            element={

              <ProtectedRoute>

                <Admin />

              </ProtectedRoute>

            } 

          />

          <Route path="/admin/login" element={<LoginPage />} />

          <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />

          <Route path="/admin/reset-password" element={<ForgotPasswordPage />} />

          <Route path="/login-cliente" element={<ClientLoginPage />} />

          <Route path="/meus-agendamentos" element={<ClientBookingsPage />} />

          <Route path="/meu-plano" element={<ClientMyPlanPage />} />

          <Route path="/planos-mensais" element={<MonthlyPlansPage />} />

          <Route path="/politica-de-privacidade" element={<PoliticaPrivacidadePage />} />

          <Route path="/termos-de-servicos" element={<TermosServicosPage />} />

          <Route path="/bio" element={<BioPage />} />

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

      {!isBareShell && <Footer />}

    </div>

  );

};



export default App;


