import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  MessageCircle,
  Mail,
  CalendarPlus,
  Copy,
  Check,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Service, Professional, Appointment, ClinicSettings } from '../types';
import {
  createAppointment,
  getAvailableSlots,
  getStoredAppointments,
  buildWhatsAppLink,
  formatWhatsAppConfirmationMessage,
  downloadCalendarEvent,
} from '../services/storage';

interface BookingFlowProps {
  services: Service[];
  professionals: Professional[];
  settings: ClinicSettings;
  onAppointmentCreated: (appointment: Appointment) => void;
  onOpenEmailPreview: (appointment: Appointment, service: Service, professional: Professional) => void;
  onNavigateToLookup: (code: string) => void;
}

export const BookingFlow: React.FC<BookingFlowProps> = ({
  services,
  professionals,
  settings,
  onAppointmentCreated,
  onOpenEmailPreview,
  onNavigateToLookup,
}) => {
  // Wizard steps: 1: Service, 2: Date & Slot, 3: Patient Info, 4: Confirmed
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Selected state
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || 'srv-1');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>(professionals[0]?.id || 'prof-1');
  
  // Date selection (default today or tomorrow)
  const todayStr = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Form inputs
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientBirthDate, setClientBirthDate] = useState('');
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [notes, setNotes] = useState('');
  const [confirmationChannel, setConfirmationChannel] = useState<'whatsapp' | 'email' | 'ambos'>('whatsapp');
  const [validationError, setValidationError] = useState('');

  // Post-booking state
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Compute selected entities
  const selectedService = services.find((s) => s.id === selectedServiceId) || services[0];
  const selectedProfessional = professionals.find((p) => p.id === selectedProfessionalId) || professionals[0];

  // Available slots for selected date & professional
  const slots = useMemo(() => {
    return getAvailableSlots(selectedDate, selectedProfessionalId, settings.openHour, settings.closeHour);
  }, [selectedDate, selectedProfessionalId, settings.openHour, settings.closeHour, confirmedAppointment]);

  const [returningPatientNotice, setReturningPatientNotice] = useState<string | null>(null);

  // Phone masking helper & automatic recognition of returning patient
  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length > 7) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    setClientPhone(formatted);

    // Auto-detect returning patient if phone has 10 or 11 digits
    if (digits.length >= 10) {
      const allApts = getStoredAppointments();
      const pastApt = allApts.find((a) => a.clientPhone.replace(/\D/g, '') === digits);
      if (pastApt) {
        setIsFirstVisit(false);
        const pastVisitsCount = allApts.filter((a) => a.clientPhone.replace(/\D/g, '') === digits).length;
        setReturningPatientNotice(
          `Identificamos seu cadastro! Seja bem-vindo(a) de volta para sua ${pastVisitsCount + 1}ª consulta.`
        );
        if (!clientName && pastApt.clientName) {
          setClientName(pastApt.clientName);
        }
        if (!clientEmail && pastApt.clientEmail) {
          setClientEmail(pastApt.clientEmail);
        }
        if (!clientBirthDate && pastApt.clientBirthDate) {
          setClientBirthDate(pastApt.clientBirthDate);
        }
      } else {
        setReturningPatientNotice(null);
      }
    } else {
      setReturningPatientNotice(null);
    }
  };

  // Next 14 dates for easy horizontal chip selection
  const upcomingDates = useMemo(() => {
    const list = [];
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' });
      const dayNum = d.toLocaleDateString('pt-BR', { day: '2-digit' });
      const monthShort = d.toLocaleDateString('pt-BR', { month: 'short' });
      list.push({ iso, weekday, dayNum, monthShort, isSunday: d.getDay() === 0 });
    }
    return list;
  }, []);

  // Validate step 3 & submit
  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!clientName.trim()) {
      setValidationError('Por favor, informe seu nome completo.');
      return;
    }
    if (!clientPhone.trim() || clientPhone.replace(/\D/g, '').length < 10) {
      setValidationError('Por favor, informe um número de telefone celular / WhatsApp válido com DDD.');
      return;
    }
    if (!clientEmail.trim() || !clientEmail.includes('@')) {
      setValidationError('Por favor, informe um endereço de e-mail válido.');
      return;
    }
    if (!selectedTime) {
      setValidationError('Selecione um horário disponível para continuar.');
      setStep(2);
      return;
    }

    try {
      const newApt = createAppointment({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim(),
        clientBirthDate: clientBirthDate || undefined,
        isFirstVisit,
        notes: notes.trim() || undefined,
        serviceId: selectedServiceId,
        professionalId: selectedProfessionalId,
        date: selectedDate,
        time: selectedTime,
        confirmationChannel,
        price: selectedService.price,
      });

      setConfirmedAppointment(newApt);
      onAppointmentCreated(newApt);
      setStep(4);
    } catch (err) {
      console.error(err);
      setValidationError('Não foi possível registrar o agendamento. Tente novamente.');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const resetForm = () => {
    setStep(1);
    setSelectedTime('');
    setConfirmedAppointment(null);
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setNotes('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Wizard Step Indicator */}
      {step < 4 && (
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= 1 ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                1
              </span>
              <span className={`text-xs sm:text-sm font-medium ${step >= 1 ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                Tratamento
              </span>
            </div>
            <div className={`h-0.5 flex-1 mx-3 ${step >= 2 ? 'bg-teal-600' : 'bg-slate-200'}`} />
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= 2 ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                2
              </span>
              <span className={`text-xs sm:text-sm font-medium ${step >= 2 ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                Data & Horário
              </span>
            </div>
            <div className={`h-0.5 flex-1 mx-3 ${step >= 3 ? 'bg-teal-600' : 'bg-slate-200'}`} />
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= 3 ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                3
              </span>
              <span className={`text-xs sm:text-sm font-medium ${step >= 3 ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                Seus Dados
              </span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 1: SERVICE SELECTION */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900" style={{ textWrap: 'balance' }}>
              Escolha o Tratamento Podológico
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600">
              Cuidado especializado e humanizado para a saúde e o bem-estar dos seus pés.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {services.map((service) => {
              const isSelected = selectedServiceId === service.id;
              return (
                <div
                  key={service.id}
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`p-5 rounded-2xl border text-left cursor-pointer transition-all relative ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/40 shadow-sm ring-1 ring-teal-600'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-xs font-medium text-teal-800 bg-teal-100/60 px-2.5 py-0.5 rounded-md">
                      {service.category}
                    </span>
                    <span className="text-base font-bold text-slate-900 tabular-nums">
                      R$ {service.price.toFixed(2)}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 mb-1.5 flex items-center gap-2">
                    {service.name}
                    {service.popular && (
                      <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                        Mais Procurado
                      </span>
                    )}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 mb-3">
                    {service.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Duração média: {service.durationMin} min
                    </span>
                    <span className={`text-xs font-semibold ${isSelected ? 'text-teal-700' : 'text-slate-400'}`}>
                      {isSelected ? '✓ Selecionado' : 'Selecionar'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-teal-700 text-white font-semibold rounded-xl hover:bg-teal-800 transition-colors shadow-sm"
            >
              <span>Avançar para Data e Horário</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PROFESSIONAL & DATE/TIME SELECTION */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Trocar tratamento ({selectedService.name})</span>
            </button>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Escolha o Especialista e o Horário
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Os horários são sincronizados em tempo real com a agenda da clínica.
            </p>
          </div>

          {/* Professional Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Profissional de Podologia
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {professionals.map((prof) => {
                const isSelected = selectedProfessionalId === prof.id;
                return (
                  <div
                    key={prof.id}
                    onClick={() => {
                      setSelectedProfessionalId(prof.id);
                      setSelectedTime(''); // reset slot when changing specialist
                    }}
                    className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/50 ring-1 ring-teal-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <img
                      src={prof.avatar}
                      alt={prof.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-200"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1594824813583-4a1705e49c71?w=150&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 truncate">{prof.name}</div>
                      <div className="text-xs text-teal-800 font-medium truncate">{prof.role}</div>
                      <div className="text-[11px] text-slate-400">{prof.registry}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Date Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Selecione o Dia
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  min={todayStr}
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      setSelectedTime('');
                    }
                  }}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-teal-600 bg-white"
                />
              </div>
            </div>

            {/* Quick date chips carousel */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {upcomingDates.map((item) => {
                const isSelected = selectedDate === item.iso;
                return (
                  <button
                    key={item.iso}
                    onClick={() => {
                      setSelectedDate(item.iso);
                      setSelectedTime('');
                    }}
                    className={`flex flex-col items-center justify-center min-w-[70px] sm:min-w-[80px] py-2 px-1 rounded-xl border text-center transition-all shrink-0 ${
                      isSelected
                        ? 'border-teal-700 bg-teal-700 text-white shadow-xs font-semibold'
                        : item.isSunday
                        ? 'border-slate-100 bg-slate-50 text-slate-400 opacity-60'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-[11px] uppercase tracking-wider">
                      {item.weekday}
                    </span>
                    <span className="text-base sm:text-lg font-bold tabular-nums">
                      {item.dayNum}
                    </span>
                    <span className="text-[10px] capitalize opacity-80">
                      {item.monthShort}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slots Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Horários Disponíveis ({selectedDate.split('-').reverse().join('/')})
              </label>
              <span className="text-xs text-slate-500">
                {slots.filter((s) => s.available).length} horários livres
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {slots.map((slot) => {
                const isSelected = selectedTime === slot.time;
                return (
                  <button
                    key={slot.time}
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.time)}
                    className={`py-2.5 px-3 rounded-xl text-center text-sm font-semibold transition-all ${
                      isSelected
                        ? 'bg-teal-700 text-white shadow-sm ring-2 ring-teal-600 ring-offset-1'
                        : slot.available
                        ? 'bg-white border border-slate-200 text-slate-800 hover:border-teal-600 hover:bg-teal-50/30'
                        : 'bg-slate-100 border border-slate-200/60 text-slate-400 cursor-not-allowed line-through'
                    }`}
                  >
                    <div className="tabular-nums">{slot.time}</div>
                    <div className="text-[10px] font-normal tracking-tight">
                      {slot.available ? (isSelected ? 'Escolhido' : 'Disponível') : 'Ocupado'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Voltar
            </button>
            <button
              disabled={!selectedTime}
              onClick={() => setStep(3)}
              className={`inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition-all shadow-sm ${
                selectedTime
                  ? 'bg-teal-700 text-white hover:bg-teal-800'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>Continuar para Dados Pessoais</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CLIENT PERSONAL DATA */}
      {step === 3 && (
        <form onSubmit={handleConfirmBooking} className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar para data e horário</span>
            </button>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Dados do Paciente para o Agendamento
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Você receberá a confirmação automática com as orientações do atendimento.
            </p>
          </div>

          {/* Summary pill */}
          <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
            <div>
              <span className="font-bold text-teal-950">{selectedService.name}</span>
              <span className="text-teal-800"> com {selectedProfessional.name}</span>
            </div>
            <div className="font-semibold text-teal-900 tabular-nums">
              {selectedDate.split('-').reverse().join('/')} às {selectedTime} · R$ {selectedService.price.toFixed(2)}
            </div>
          </div>

          {validationError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nome Completo do Paciente *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Maria Clara Souza"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-teal-600 bg-white text-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                WhatsApp / Celular com DDD *
              </label>
              <input
                type="tel"
                required
                placeholder="(11) 98765-4321"
                value={clientPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-teal-600 bg-white text-slate-900 text-sm tabular-nums"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Usado para confirmação e avisos de horário.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                E-mail para Confirmação *
              </label>
              <input
                type="email"
                required
                placeholder="seu.email@exemplo.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-teal-600 bg-white text-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Data de Nascimento (Opcional)
              </label>
              <input
                type="date"
                value={clientBirthDate}
                onChange={(e) => setClientBirthDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-teal-600 bg-white text-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                É sua primeira vez na clínica?
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsFirstVisit(true)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    isFirstVisit
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Sim, primeira vez
                </button>
                <button
                  type="button"
                  onClick={() => setIsFirstVisit(false)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    !isFirstVisit
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Já sou paciente
                </button>
              </div>
              {returningPatientNotice && (
                <div className="text-[11px] font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg mt-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{returningPatientNotice}</span>
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Queixa Principal ou Observações de Saúde (Opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Dor na lateral da unha direita, sou diabético(a), calosidade intensa nos calcanhares..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-teal-600 bg-white text-slate-900 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Canal Preferido de Confirmação Automática:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmationChannel('whatsapp')}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    confirmationChannel === 'whatsapp'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-800 font-bold'
                      : 'bg-white border-slate-300 text-slate-600'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmationChannel('email')}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    confirmationChannel === 'email'
                      ? 'bg-blue-50 border-blue-600 text-blue-800 font-bold'
                      : 'bg-white border-slate-300 text-slate-600'
                  }`}
                >
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span>E-mail</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmationChannel('ambos')}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    confirmationChannel === 'ambos'
                      ? 'bg-teal-50 border-teal-600 text-teal-900 font-bold'
                      : 'bg-white border-slate-300 text-slate-600'
                  }`}
                >
                  <span>Ambos (WhatsApp + E-mail)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Voltar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-7 py-3 bg-teal-700 text-white font-bold rounded-xl hover:bg-teal-800 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-5 h-5 text-teal-200" />
              <span>Confirmar Agendamento</span>
            </button>
          </div>
        </form>
      )}

      {/* STEP 4: SUCCESS CONFIRMATION & REAL-TIME SUMMARY */}
      {step === 4 && confirmedAppointment && (
        <div className="space-y-6">
          {/* Success Hero */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 text-center shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-teal-600" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Agendamento Confirmado com Sucesso!
            </h2>
            <p className="mt-2 text-slate-600 text-sm sm:text-base max-w-lg mx-auto">
              Seu horário está garantido na {settings.clinicName}. Uma confirmação automática foi emitida para você.
            </p>

            {/* Code Badge */}
            <div className="mt-5 inline-flex items-center gap-2 bg-slate-100 border border-slate-300/80 px-4 py-2 rounded-xl">
              <span className="text-xs uppercase font-semibold text-slate-500">
                Código do Agendamento:
              </span>
              <span className="text-base font-extrabold text-slate-900 tracking-wider font-mono">
                {confirmedAppointment.code}
              </span>
              <button
                onClick={() => handleCopyCode(confirmedAppointment.code)}
                title="Copiar código"
                className="p-1 text-slate-500 hover:text-slate-800"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Resumo da Consulta
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-500 block">Paciente:</span>
                <span className="font-semibold text-slate-900">{confirmedAppointment.clientName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Data e Horário:</span>
                <span className="font-semibold text-teal-800 tabular-nums">
                  {confirmedAppointment.date.split('-').reverse().join('/')} às {confirmedAppointment.time}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Tratamento:</span>
                <span className="font-semibold text-slate-900">{selectedService.name}</span>
                <span className="text-xs text-slate-500 block">Duração: {selectedService.durationMin} min</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Especialista Responsável:</span>
                <span className="font-semibold text-slate-900">{selectedProfessional.name}</span>
                <span className="text-xs text-slate-500 block">{selectedProfessional.registry}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Valor do Procedimento:</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  R$ {confirmedAppointment.price.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Endereço da Clínica:</span>
                <span className="text-slate-700">{settings.address}, {settings.city}</span>
              </div>
            </div>
          </div>

          {/* Automated Channel Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* WhatsApp Confirmation */}
            <a
              href={buildWhatsAppLink(
                confirmedAppointment.clientPhone,
                formatWhatsAppConfirmationMessage(
                  confirmedAppointment,
                  selectedService,
                  selectedProfessional,
                  settings
                )
              )}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 p-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-xs"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Abrir no WhatsApp</span>
            </a>

            {/* Email Preview Modal */}
            <button
              onClick={() => onOpenEmailPreview(confirmedAppointment, selectedService, selectedProfessional)}
              className="flex items-center justify-center gap-2 p-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-xs"
            >
              <Mail className="w-5 h-5" />
              <span>Ver Comprovante / E-mail</span>
            </button>

            {/* ICS Calendar */}
            <button
              onClick={() =>
                downloadCalendarEvent(
                  confirmedAppointment,
                  selectedService,
                  selectedProfessional,
                  settings
                )
              }
              className="flex items-center justify-center gap-2 p-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-sm transition-colors shadow-xs"
            >
              <CalendarPlus className="w-5 h-5 text-teal-400" />
              <span>Salvar na Agenda (.ics)</span>
            </button>
          </div>

          {/* Cancellation Info Banner */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs sm:text-sm text-amber-900">
            <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950">
                Precisa cancelar ou remarcar mais tarde?
              </p>
              <p className="mt-0.5 text-amber-800">
                Você pode cancelar seu atendimento a qualquer momento na aba <strong>"Consultar / Cancelar"</strong> informando seu telefone ou código <strong>{confirmedAppointment.code}</strong>. Ao cancelar, o sistema notifica a clínica imediatamente e libera o horário para outros pacientes.
              </p>
              <div className="mt-2.5">
                <button
                  onClick={() => onNavigateToLookup(confirmedAppointment.code)}
                  className="font-bold underline text-amber-950 hover:text-amber-700"
                >
                  Ir para a página de consulta deste agendamento &rarr;
                </button>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex justify-center pt-2">
            <button
              onClick={resetForm}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
            >
              Fazer outro agendamento
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
