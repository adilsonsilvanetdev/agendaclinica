import React, { useState, useEffect } from 'react';
import {
  Search,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageCircle,
  FileText,
  User,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { Appointment, Service, Professional, ClinicSettings } from '../types';
import {
  getStoredAppointments,
  cancelAppointmentByClient,
  buildWhatsAppLink,
  formatWhatsAppCancellationMessage,
} from '../services/storage';

interface ClientAppointmentLookupProps {
  initialCode?: string;
  services: Service[];
  professionals: Professional[];
  settings: ClinicSettings;
  appointments?: Appointment[];
  onNavigateToBooking: () => void;
  onAppointmentCancelled: (appointment: Appointment) => void;
}

export const ClientAppointmentLookup: React.FC<ClientAppointmentLookupProps> = ({
  initialCode = '',
  services,
  professionals,
  settings,
  appointments,
  onNavigateToBooking,
  onAppointmentCancelled,
}) => {
  const [query, setQuery] = useState(initialCode);
  const [searched, setSearched] = useState(false);
  const [appointmentsFound, setAppointmentsFound] = useState<Appointment[]>([]);

  // Cancellation Modal State
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('Imprevisto pessoal');
  const [cancelCustomNotes, setCancelCustomNotes] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelledSuccessMsg, setCancelledSuccessMsg] = useState<{ code: string; message: string } | null>(null);

  // Search logic
  const handleSearch = (searchTerm: string) => {
    setSearched(true);
    setCancelledSuccessMsg(null);
    const term = searchTerm.trim().toUpperCase();
    const cleanDigits = searchTerm.replace(/\D/g, '');

    const all = appointments && appointments.length > 0 ? appointments : getStoredAppointments();
    const filtered = all.filter((apt) => {
      const matchCode = apt.code.toUpperCase() === term;
      const aptPhoneDigits = apt.clientPhone.replace(/\D/g, '');
      const matchPhone = cleanDigits.length >= 8 && aptPhoneDigits.includes(cleanDigits);
      const matchName = term.length >= 3 && apt.clientName.toUpperCase().includes(term);
      return matchCode || matchPhone || matchName;
    });

    setAppointmentsFound(filtered);
  };

  useEffect(() => {
    if (initialCode) {
      setQuery(initialCode);
      handleSearch(initialCode);
    }
  }, [initialCode]);

  const handleOpenCancelModal = (apt: Appointment) => {
    setCancellingAppointment(apt);
    setCancelReason('Imprevisto pessoal');
    setCancelCustomNotes('');
  };

  const handleConfirmCancellation = () => {
    if (!cancellingAppointment) return;
    setIsSubmittingCancel(true);

    const fullReason = cancelCustomNotes.trim()
      ? `${cancelReason} - ${cancelCustomNotes.trim()}`
      : cancelReason;

    const result = cancelAppointmentByClient(cancellingAppointment.id, fullReason);

    setIsSubmittingCancel(false);
    if (result.success && result.appointment) {
      setCancelledSuccessMsg({
        code: result.appointment.code,
        message: 'Agendamento cancelado com sucesso. A clínica foi notificada imediatamente e o horário foi liberado no sistema.',
      });
      onAppointmentCancelled(result.appointment);
      setCancellingAppointment(null);
      // Refresh local list
      handleSearch(query);
    }
  };

  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const profMap = new Map(professionals.map((p) => [p.id, p]));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center max-w-xl mx-auto mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900" style={{ textWrap: 'balance' }}>
          Consultar ou Cancelar Agendamento
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Informe o código do seu agendamento (ex: PODO-1012) ou o telefone cadastrado.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs max-w-xl mx-auto mb-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(query);
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Digite seu Código (ex: PODO-1012) ou Telefone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-teal-600 text-sm bg-white text-slate-900"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-teal-700 text-white rounded-xl font-semibold text-sm hover:bg-teal-800 transition-colors shadow-xs"
          >
            Buscar
          </button>
        </form>

        {/* Quick test pills */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Sugestão de teste rápido:</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setQuery('PODO-1012');
                handleSearch('PODO-1012');
              }}
              className="font-mono text-teal-700 hover:underline font-semibold"
            >
              PODO-1012
            </button>
            <span>·</span>
            <button
              onClick={() => {
                setQuery('PODO-1014');
                handleSearch('PODO-1014');
              }}
              className="font-mono text-teal-700 hover:underline font-semibold"
            >
              PODO-1014
            </button>
          </div>
        </div>
      </div>

      {/* Success Cancellation Alert */}
      {cancelledSuccessMsg && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-sm text-amber-950 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-base">Agendamento Cancelado!</div>
            <p className="mt-0.5">{cancelledSuccessMsg.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={buildWhatsAppLink(
                  settings.whatsapp,
                  `Olá, equipe da ${settings.clinicName}. Gostaria de confirmar que cancelei meu agendamento código ${cancelledSuccessMsg.code}.`
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Avisar Clínica no WhatsApp</span>
              </a>
              <button
                onClick={onNavigateToBooking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-800 text-white rounded-lg text-xs font-semibold hover:bg-teal-900 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Agendar para Outra Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Resultados encontrados: {appointmentsFound.length}</span>
          </div>

          {appointmentsFound.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Nenhum agendamento localizado
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Não encontramos agendamentos com os dados informados. Verifique se o código ou telefone digitado estão corretos.
              </p>
              <button
                onClick={onNavigateToBooking}
                className="mt-4 px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800"
              >
                Fazer Novo Agendamento
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {appointmentsFound.map((apt) => {
                const srv = serviceMap.get(apt.serviceId);
                const prof = profMap.get(apt.professionalId);
                const isBooked = apt.status === 'agendado';
                const isCompleted = apt.status === 'concluido';
                const isCancelled = apt.status.startsWith('cancelado');

                return (
                  <div
                    key={apt.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs relative"
                  >
                    {/* Header line */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm sm:text-base">
                          {apt.code}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500">
                          {apt.clientName}
                        </span>
                      </div>

                      {/* Status indicator without pill badges */}
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        {isBooked && (
                          <span className="text-teal-700 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-teal-600" />
                            Confirmado / Agendado
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Atendimento Concluído
                          </span>
                        )}
                        {isCancelled && (
                          <span className="text-rose-700 flex items-center gap-1">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            {apt.status === 'cancelado_cliente'
                              ? 'Cancelado pelo Paciente'
                              : 'Cancelado pela Clínica'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs sm:text-sm mb-4">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Tratamento:</span>
                        <span className="font-bold text-slate-900">{srv?.name || 'Podologia'}</span>
                        <span className="text-slate-500 block text-xs">
                          {srv ? `${srv.durationMin} min · R$ ${apt.price.toFixed(2)}` : ''}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px]">Data & Horário:</span>
                        <span className="font-bold text-teal-900 tabular-nums">
                          {apt.date.split('-').reverse().join('/')} às {apt.time}
                        </span>
                        <span className="text-slate-500 block text-xs">
                          Com {prof?.name || 'Podólogo Especialista'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px]">Local:</span>
                        <span className="text-slate-700">{settings.address}</span>
                        <span className="text-slate-500 block text-xs">{settings.city}</span>
                      </div>
                    </div>

                    {/* Cancellation reason if cancelled */}
                    {isCancelled && apt.cancellationReason && (
                      <div className="mb-4 p-3 bg-rose-50/60 border border-rose-200 rounded-xl text-xs text-rose-900">
                        <span className="font-semibold">Motivo do cancelamento: </span>
                        {apt.cancellationReason}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      <div className="text-xs text-slate-500">
                        {isBooked
                          ? 'Deseja alterar ou não poderá comparecer?'
                          : 'Horário liberado no sistema.'}
                      </div>

                      <div className="flex items-center gap-2">
                        {isBooked && (
                          <button
                            onClick={() => handleOpenCancelModal(apt)}
                            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold text-xs rounded-xl border border-rose-300 transition-colors flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Cancelar Agendamento</span>
                          </button>
                        )}

                        <a
                          href={buildWhatsAppLink(
                            settings.whatsapp,
                            `Olá! Tenho uma dúvida sobre meu agendamento código ${apt.code}.`
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Falar com a Clínica</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {cancellingAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Cancelar este Agendamento?
                </h3>
                <p className="text-xs text-slate-500">
                  Código: <span className="font-mono font-bold text-slate-800">{cancellingAppointment.code}</span>
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600">
              Ao confirmar o cancelamento, a clínica será <strong>notificada imediatamente</strong> e este horário será liberado no sistema para outros pacientes.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Por que você está cancelando?
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-teal-600"
              >
                <option value="Imprevisto pessoal">Imprevisto pessoal ou familiar</option>
                <option value="Compromisso de trabalho">Compromisso de trabalho / reunião</option>
                <option value="Problema de saúde">Sintomas de gripe / problema de saúde</option>
                <option value="Quadro resolvido">Melhora dos sintomas no pé</option>
                <option value="Erro no horário">Escolhi a data/horário errado por engano</option>
                <option value="Outro motivo">Outro motivo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Observação adicional (opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Conte-nos brevemente o motivo se desejar..."
                value={cancelCustomNotes}
                onChange={(e) => setCancelCustomNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-teal-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancellingAppointment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
              >
                Manter Agendamento
              </button>
              <button
                type="button"
                disabled={isSubmittingCancel}
                onClick={handleConfirmCancellation}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                {isSubmittingCancel ? 'Processando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
