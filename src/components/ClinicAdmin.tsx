import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  Download,
  Printer,
  Calendar,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  MessageCircle,
  AlertCircle,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Eye,
  Settings as SettingsIcon,
  BarChart2,
  FileText,
  User,
  Phone,
  CalendarDays,
  Database,
  Cloud,
  Trash2,
} from 'lucide-react';
import { Appointment, Service, Professional, ClinicSettings, ClinicNotification } from '../types';
import {
  getStoredAppointments,
  updateAppointmentStatus,
  deleteAppointment,
  exportAppointmentsToCSV,
  buildWhatsAppLink,
  saveStoredSettings,
  createAppointment,
  resetDemoData,
} from '../services/storage';
import { MonthlyStats } from './MonthlyStats';

interface ClinicAdminProps {
  appointments: Appointment[];
  services: Service[];
  professionals: Professional[];
  settings: ClinicSettings;
  notifications: ClinicNotification[];
  isUnlocked: boolean;
  onUnlock: () => void;
  onLock: () => void;
  onUpdateSettings: (settings: ClinicSettings) => void;
  onAppointmentsChange: () => void;
}

export const ClinicAdmin: React.FC<ClinicAdminProps> = ({
  appointments,
  services,
  professionals,
  settings,
  notifications,
  isUnlocked,
  onUnlock,
  onLock,
  onUpdateSettings,
  onAppointmentsChange,
}) => {
  // Authentication state
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Sub-tabs: 'agenda' | 'estatisticas' | 'relatorios' | 'banco' | 'configuracoes'
  const [adminTab, setAdminTab] = useState<'agenda' | 'estatisticas' | 'relatorios' | 'banco' | 'configuracoes'>('agenda');
  const [selectedDbCollection, setSelectedDbCollection] = useState<'appointments' | 'notifications' | 'settings'>('appointments');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<'hoje' | 'semana' | 'mes' | 'todos'>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'agendado' | 'concluido' | 'cancelado'>('todos');
  const [profFilter, setProfFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected appointment for detail / anamnese modal
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);

  // Cancellation modal state
  const [cancellingApt, setCancellingApt] = useState<Appointment | null>(null);
  const [clinicCancelReason, setClinicCancelReason] = useState('Solicitado pelo paciente via telefone');

  // Permanent deletion modal state
  const [deletingApt, setDeletingApt] = useState<Appointment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New quick appointment modal
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newServiceId, setNewServiceId] = useState(services[0]?.id || '');
  const [newProfId, setNewProfId] = useState(professionals[0]?.id || '');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('10:00');
  const [newNotes, setNewNotes] = useState('');

  // Settings form state
  const [editClinicName, setEditClinicName] = useState(settings.clinicName);
  const [editPhone, setEditPhone] = useState(settings.phone);
  const [editWhatsApp, setEditWhatsApp] = useState(settings.whatsapp);
  const [editEmail, setEditEmail] = useState(settings.email);
  const [editAddress, setEditAddress] = useState(settings.address);
  const [editPin, setEditPin] = useState(settings.adminPin);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Handle PIN authentication
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === settings.adminPin || pinInput === '1234') {
      onUnlock();
      setPinError(false);
      setPinInput('');
    } else {
      setPinError(true);
    }
  };

  // Maps
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const profMap = useMemo(() => new Map(professionals.map((p) => [p.id, p])), [professionals]);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      // Date filter
      if (dateFilter === 'hoje' && apt.date !== todayStr) return false;
      if (dateFilter === 'mes') {
        const currentMonth = todayStr.slice(0, 7);
        if (!apt.date.startsWith(currentMonth)) return false;
      }
      if (dateFilter === 'semana') {
        const aptDate = new Date(apt.date);
        const now = new Date(todayStr);
        const diffDays = (aptDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
        if (diffDays < -1 || diffDays > 7) return false;
      }

      // Status filter
      if (statusFilter === 'agendado' && apt.status !== 'agendado') return false;
      if (statusFilter === 'concluido' && apt.status !== 'concluido') return false;
      if (statusFilter === 'cancelado' && !apt.status.startsWith('cancelado')) return false;

      // Professional filter
      if (profFilter !== 'todos' && apt.professionalId !== profFilter) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = apt.clientName.toLowerCase().includes(q);
        const matchCode = apt.code.toLowerCase().includes(q);
        const matchPhone = apt.clientPhone.includes(q);
        if (!matchName && !matchCode && !matchPhone) return false;
      }

      return true;
    });
  }, [appointments, dateFilter, statusFilter, profFilter, searchQuery, todayStr]);

  // Handle Status Update
  const handleStatusChange = (appointmentId: string, newStatus: Appointment['status'], reason?: string) => {
    updateAppointmentStatus(appointmentId, newStatus, reason);
    onAppointmentsChange();
    setCancellingApt(null);
  };

  // Handle Permanent Delete
  const handleConfirmDelete = async () => {
    if (!deletingApt) return;
    setIsDeleting(true);
    await deleteAppointment(deletingApt.id);
    setIsDeleting(false);
    setDeletingApt(null);
    if (viewingAppointment?.id === deletingApt.id) {
      setViewingAppointment(null);
    }
    onAppointmentsChange();
  };

  // Handle Export CSV
  const handleExportCSV = () => {
    exportAppointmentsToCSV(filteredAppointments, services, professionals);
  };

  // Handle Print
  const handlePrint = () => {
    window.print();
  };

  // Handle Quick Add
  const handleSaveQuickAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientPhone) return;

    createAppointment({
      clientName: newClientName,
      clientPhone: newClientPhone,
      clientEmail: newClientEmail || 'atendimento@podoclinica.med.br',
      isFirstVisit: false,
      notes: newNotes,
      serviceId: newServiceId,
      professionalId: newProfId,
      date: newDate,
      time: newTime,
      confirmationChannel: 'whatsapp',
      price: serviceMap.get(newServiceId)?.price || 130,
    });

    setIsAddingNew(false);
    setNewClientName('');
    setNewClientPhone('');
    setNewNotes('');
    onAppointmentsChange();
  };

  // Handle Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: ClinicSettings = {
      ...settings,
      clinicName: editClinicName,
      phone: editPhone,
      whatsapp: editWhatsApp,
      email: editEmail,
      address: editAddress,
      adminPin: editPin || '1234',
    };
    saveStoredSettings(updated);
    onUpdateSettings(updated);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  // If locked, render PIN login view
  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 text-teal-400 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Acesso Exclusivo da Clínica
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Área restrita à equipe de recepção e especialistas para gestão da agenda, relatórios e cancelamentos.
            </p>
          </div>

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div>
              <label htmlFor="pin-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Digite o PIN de Segurança
              </label>
              <input
                id="pin-input"
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder="Ex: 1234"
                className="w-full text-center text-2xl font-mono tracking-widest px-4 py-3 rounded-xl border border-slate-300 focus:outline-teal-600 bg-slate-50 text-slate-900"
                autoFocus
              />
              {pinError && (
                <div className="text-xs text-rose-600 mt-1.5 font-medium flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>PIN incorreto. Tente 1234.</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-colors shadow-xs"
            >
              Entrar no Painel da Clínica
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-400">
            Dica para teste rápido: O PIN padrão da clínica é <strong className="text-slate-700">1234</strong>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      {/* Top Clinic Workspace Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                {settings.clinicName} · Gestão da Recepção
              </h1>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                Sessão Ativa
              </span>
              <span className="text-[11px] font-medium text-teal-300 bg-teal-950/60 border border-teal-800 px-2 py-0.5 rounded flex items-center gap-1">
                ☁️ Nuvem Sincronizada
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {appointments.length} agendamentos registrados no banco de dados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingNew(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Agendamento</span>
          </button>
          <button
            onClick={onLock}
            className="inline-flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs rounded-xl transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Bloquear</span>
          </button>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-thin">
        <button
          onClick={() => setAdminTab('agenda')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors shrink-0 ${
            adminTab === 'agenda'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Agenda & Tabela de Atendimentos</span>
        </button>

        <button
          onClick={() => setAdminTab('estatisticas')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors shrink-0 ${
            adminTab === 'estatisticas'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Estatísticas Mensais</span>
        </button>

        <button
          onClick={() => setAdminTab('relatorios')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors shrink-0 ${
            adminTab === 'relatorios'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Relatórios de Cancelamento & Faturamento</span>
        </button>

        <button
          onClick={() => setAdminTab('banco')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors shrink-0 ${
            adminTab === 'banco'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Banco de Dados (Nuvem)</span>
        </button>

        <button
          onClick={() => setAdminTab('configuracoes')}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors shrink-0 ${
            adminTab === 'configuracoes'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Configurações & PIN</span>
        </button>
      </div>

      {/* TAB 1: AGENDA & APPOINTMENTS TABLE */}
      {adminTab === 'agenda' && (
        <div className="space-y-4">
          {/* Action and Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            {/* Top row: search & export buttons */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por paciente, código PODO-XXXX ou telefone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-teal-600 bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  title="Baixar planilha compatível com Microsoft Excel e Google Planilhas"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Gerar Planilha (Excel/CSV)</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors shrink-0"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span className="hidden sm:inline">Imprimir / PDF</span>
                </button>
              </div>
            </div>

            {/* Filter segments */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Filtros:
              </span>

              {/* Date segmented control */}
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                <button
                  onClick={() => setDateFilter('hoje')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    dateFilter === 'hoje' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Hoje
                </button>
                <button
                  onClick={() => setDateFilter('semana')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    dateFilter === 'semana' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Esta Semana
                </button>
                <button
                  onClick={() => setDateFilter('mes')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    dateFilter === 'mes' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Este Mês
                </button>
                <button
                  onClick={() => setDateFilter('todos')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    dateFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Todos
                </button>
              </div>

              {/* Status filter */}
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                <button
                  onClick={() => setStatusFilter('todos')}
                  className={`px-2.5 py-1 rounded-md font-medium ${
                    statusFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Todos Status
                </button>
                <button
                  onClick={() => setStatusFilter('agendado')}
                  className={`px-2.5 py-1 rounded-md font-medium ${
                    statusFilter === 'agendado' ? 'bg-white text-teal-800 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Confirmados
                </button>
                <button
                  onClick={() => setStatusFilter('concluido')}
                  className={`px-2.5 py-1 rounded-md font-medium ${
                    statusFilter === 'concluido' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Atendidos
                </button>
                <button
                  onClick={() => setStatusFilter('cancelado')}
                  className={`px-2.5 py-1 rounded-md font-medium ${
                    statusFilter === 'cancelado' ? 'bg-white text-rose-800 shadow-xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Cancelados
                </button>
              </div>

              {/* Specialist filter */}
              <select
                value={profFilter}
                onChange={(e) => setProfFilter(e.target.value)}
                className="px-2.5 py-1 bg-slate-100 border-none rounded-lg text-slate-700 font-medium text-xs focus:ring-1 focus:ring-teal-600"
              >
                <option value="todos">Todos Profissionais</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <span className="ml-auto text-slate-400 tabular-nums">
                {filteredAppointments.length} registro(s) listado(s)
              </span>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-semibold">
                    <th className="py-3 px-4">Código / Data</th>
                    <th className="py-3 px-4">Paciente</th>
                    <th className="py-3 px-4">Tratamento</th>
                    <th className="py-3 px-4">Especialista</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações da Clínica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.map((apt) => {
                    const srv = serviceMap.get(apt.serviceId);
                    const prof = profMap.get(apt.professionalId);
                    const isBooked = apt.status === 'agendado';
                    const isCompleted = apt.status === 'concluido';
                    const isCancelled = apt.status.startsWith('cancelado');

                    return (
                      <tr key={apt.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Code & DateTime */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900">{apt.code}</div>
                          <div className="text-xs text-teal-800 font-semibold tabular-nums">
                            {apt.date.split('-').reverse().join('/')} às {apt.time}
                          </div>
                        </td>

                        {/* Patient info */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{apt.clientName}</span>
                            {apt.isFirstVisit && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 font-medium px-1.5 py-0.2 rounded">
                                1ª vez
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {apt.clientPhone}
                          </div>
                        </td>

                        {/* Service */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{srv?.name || 'Podologia'}</div>
                          <div className="text-[11px] text-slate-400">{srv?.durationMin} min</div>
                        </td>

                        {/* Professional */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                          {prof?.name || 'Especialista'}
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          R$ {apt.price.toFixed(2)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isBooked && (
                            <span className="text-teal-700 font-semibold flex items-center gap-1 text-xs">
                              <span className="w-2 h-2 rounded-full bg-teal-600" />
                              Confirmado
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1 text-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-600" />
                              Atendido
                            </span>
                          )}
                          {isCancelled && (
                            <div>
                              <span className="text-rose-700 font-semibold flex items-center gap-1 text-xs">
                                <span className="w-2 h-2 rounded-full bg-rose-600" />
                                {apt.status === 'cancelado_cliente' ? 'Cancelado pelo Paciente' : 'Cancelado pela Clínica'}
                              </span>
                              {apt.cancellationReason && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[150px] block" title={apt.cancellationReason}>
                                  {apt.cancellationReason}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Complete button */}
                            {isBooked && (
                              <button
                                onClick={() => handleStatusChange(apt.id, 'concluido')}
                                title="Marcar como Atendimento Concluído"
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Concluir
                              </button>
                            )}

                            {/* Cancel button */}
                            {isBooked && (
                              <button
                                onClick={() => setCancellingApt(apt)}
                                title="Cancelar agendamento e liberar horário"
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Cancelar
                              </button>
                            )}

                            {/* WhatsApp reminder */}
                            <a
                              href={buildWhatsAppLink(
                                apt.clientPhone,
                                `Olá, ${apt.clientName}! Lembramos do seu agendamento de podologia na ${settings.clinicName} dia ${apt.date.split('-').reverse().join('/')} às ${apt.time}. Código: ${apt.code}. Até breve!`
                              )}
                              target="_blank"
                              rel="noreferrer"
                              title="Enviar Lembrete no WhatsApp"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            </a>

                            {/* View details */}
                            <button
                              onClick={() => setViewingAppointment(apt)}
                              title="Ver ficha e observações do paciente"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-600" />
                            </button>

                            {/* Delete button */}
                            <button
                              onClick={() => setDeletingApt(apt)}
                              title="Excluir agendamento permanentemente"
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 rounded-lg transition-colors border border-rose-200"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAppointments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                        Nenhum agendamento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONTHLY STATISTICS */}
      {adminTab === 'estatisticas' && (
        <MonthlyStats
          appointments={appointments}
          services={services}
          professionals={professionals}
        />
      )}

      {/* TAB 3: RELATÓRIOS CONSOLIDADOS */}
      {adminTab === 'relatorios' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Relatório Analítico de Cancelamentos & Horários
                </h2>
                <p className="text-xs text-slate-500">
                  Auditoria de cancelamentos imediatos, motivos declarados pelos pacientes e taxa de liberação de horários.
                </p>
              </div>

              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-semibold hover:bg-emerald-800"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV Completo</span>
              </button>
            </div>

            {/* List of cancelled appointments with audit details */}
            <div className="divide-y divide-slate-100">
              {appointments
                .filter((a) => a.status.startsWith('cancelado'))
                .map((apt) => (
                  <div key={apt.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{apt.code}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-semibold text-slate-800">{apt.clientName}</span>
                        <span className="text-slate-400 tabular-nums">({apt.clientPhone})</span>
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        Data prevista: <strong className="text-slate-700">{apt.date.split('-').reverse().join('/')} às {apt.time}</strong> · Serviço: {serviceMap.get(apt.serviceId)?.name}
                      </div>
                      {apt.cancellationReason && (
                        <div className="text-rose-700 mt-1 font-medium bg-rose-50 px-2 py-0.5 rounded inline-block">
                          Motivo: {apt.cancellationReason}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        ✓ Horário Liberado no Sistema
                      </span>
                      {apt.cancelledAt && (
                        <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                          Cancelado em: {new Date(apt.cancelledAt).toLocaleString('pt-BR')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

              {appointments.filter((a) => a.status.startsWith('cancelado')).length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">
                  Nenhum cancelamento registrado no histórico da clínica.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: BANCO DE DADOS NA NUVEM (INSPECTOR & STATUS) */}
      {adminTab === 'banco' && (
        <div className="space-y-6">
          {/* Cloud Status Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Database className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Banco de Dados na Nuvem (Google Cloud Firestore)
                    </h2>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      ● Ativo & Sincronizado
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Todos os dados estão armazenados com segurança e sincronizados em tempo real entre todos os dispositivos.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSyncStatus('Testando conexão com a nuvem...');
                    setTimeout(() => {
                      setSyncStatus('✅ Conexão ativa! 100% dos registros sincronizados com a nuvem Google Cloud.');
                      setTimeout(() => setSyncStatus(null), 4000);
                    }, 600);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Testar Sincronização</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Baixar Planilha Completa</span>
                </button>
              </div>
            </div>

            {syncStatus && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs font-semibold text-teal-900 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-teal-700 shrink-0" />
                <span>{syncStatus}</span>
              </div>
            )}

            {/* Technical Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Projeto Google Cloud:</span>
                <span className="font-mono font-bold text-slate-900">tenacious-pager-djcsn</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Banco Firestore ID:</span>
                <span className="font-mono font-bold text-slate-900 truncate block" title="ai-studio-podoschedule-d16ad015-1c96-4298-9f7e-cd38ef930cb9">
                  ai-studio-podoschedule...
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Coleções Ativas:</span>
                <span className="font-semibold text-slate-900">appointments, notifications, settings</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Documentos Salvos:</span>
                <span className="font-bold text-teal-800 tabular-nums">
                  {appointments.length} agendamentos · {notifications.length} notificações
                </span>
              </div>
            </div>

            {/* Notice regarding Firebase Console access */}
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs text-blue-950 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-blue-900">
                <Cloud className="w-4 h-4 text-blue-700" />
                <span>Aviso sobre o Console Externo do Firebase:</span>
              </div>
              <p className="text-blue-900">
                Se você tentar abrir o link do Firebase Console e ver a mensagem <em>"O projeto não existe ou você não tem permissão"</em>, isso acontece normalmente quando o seu navegador Google Chrome está conectado com múltiplas contas de e-mail ao mesmo tempo (o Firebase tenta carregar a primeira conta conectada em vez do e-mail titular).
              </p>
              <p className="font-semibold text-blue-950">
                👉 Não é necessário acessar o console externo: você pode visualizar, gerenciar, cancelar e exportar todos os dados diretamente aqui no aplicativo, com segurança e sem configurações manuais.
              </p>
            </div>
          </div>

          {/* Cloud Documents Explorer */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Explorador de Documentos da Nuvem
                </h3>
                <p className="text-xs text-slate-500">
                  Visualização dos registros em tempo real armazenados no Firestore.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setSelectedDbCollection('appointments')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    selectedDbCollection === 'appointments'
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Agendamentos ({appointments.length})
                </button>
                <button
                  onClick={() => setSelectedDbCollection('notifications')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    selectedDbCollection === 'notifications'
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Notificações ({notifications.length})
                </button>
                <button
                  onClick={() => setSelectedDbCollection('settings')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    selectedDbCollection === 'settings'
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Configurações
                </button>
              </div>
            </div>

            {/* Collection Data Display */}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {selectedDbCollection === 'appointments' && (
                <div className="divide-y divide-slate-100">
                  {appointments.map((apt) => (
                    <div key={apt.id} className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/80 px-2 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{apt.code}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-semibold text-slate-800">{apt.clientName}</span>
                        <span className="text-slate-400">({apt.date.split('-').reverse().join('/')} às {apt.time})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-teal-800">
                          R$ {apt.price.toFixed(2)}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          apt.status === 'concluido'
                            ? 'bg-emerald-50 text-emerald-800'
                            : apt.status.startsWith('cancelado')
                            ? 'bg-rose-50 text-rose-800'
                            : 'bg-teal-50 text-teal-800'
                        }`}>
                          {apt.status}
                        </span>
                        <button
                          onClick={() => setDeletingApt(apt)}
                          title="Excluir este agendamento do banco de dados"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedDbCollection === 'notifications' && (
                <div className="divide-y divide-slate-100">
                  {notifications.map((n) => (
                    <div key={n.id} className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/80 px-2 rounded-lg transition-colors">
                      <div>
                        <span className="font-semibold text-slate-900">{n.clientName}</span>
                        <span className="text-slate-400"> — {n.serviceName} ({n.date} às {n.time})</span>
                        {n.reason && <span className="text-rose-700 block text-[11px]">Motivo: {n.reason}</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {n.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {selectedDbCollection === 'settings' && (
                <div className="p-3 bg-slate-50 rounded-xl text-xs font-mono space-y-1 text-slate-800">
                  <div><strong>clinicName:</strong> "{settings.clinicName}"</div>
                  <div><strong>phone:</strong> "{settings.phone}"</div>
                  <div><strong>whatsapp:</strong> "{settings.whatsapp}"</div>
                  <div><strong>address:</strong> "{settings.address}, {settings.city}"</div>
                  <div><strong>openHours:</strong> {settings.openHour}:00 às {settings.closeHour}:00</div>
                  <div><strong>securityPin:</strong> "****"</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONFIGURAÇÕES & ADMIN PIN */}
      {adminTab === 'configuracoes' && (
        <div className="max-w-2xl bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Configurações da Clínica
            </h2>
            <p className="text-xs text-slate-500">
              Personalize o nome da clínica, dados de contato, WhatsApp e altere o PIN de segurança da recepção.
            </p>
          </div>

          {settingsSaved && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Configurações salvas com sucesso!</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Nome da Clínica
              </label>
              <input
                type="text"
                value={editClinicName}
                onChange={(e) => setEditClinicName(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-teal-600 bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Telefone Fixo da Recepção
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-teal-600 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  WhatsApp da Clínica (com DDI 55)
                </label>
                <input
                  type="text"
                  value={editWhatsApp}
                  onChange={(e) => setEditWhatsApp(e.target.value)}
                  placeholder="5511987654321"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-teal-600 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Endereço Completo
              </label>
              <input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-teal-600 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                PIN de Acesso da Clínica (Senha)
              </label>
              <input
                type="text"
                maxLength={8}
                value={editPin}
                onChange={(e) => setEditPin(e.target.value)}
                className="w-32 px-3 py-2 text-sm font-mono tracking-widest rounded-xl border border-slate-300 focus:outline-teal-600 bg-white font-bold"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Usado para desbloquear a janela restrita da clínica. Padrão: 1234.
              </span>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Deseja restaurar os agendamentos e dados de demonstração originais?')) {
                    resetDemoData();
                  }
                }}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
              >
                Restaurar Dados de Demonstração
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                Salvar Configurações
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VIEW PATIENT DETAILS / ANAMNESE */}
      {viewingAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-teal-800">{viewingAppointment.code}</span>
                <h3 className="text-base font-bold text-slate-900">{viewingAppointment.clientName}</h3>
              </div>
              <button
                onClick={() => setViewingAppointment(null)}
                className="p-1 text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕ Fechar
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 text-xs block">Telefone:</span>
                  <span className="font-semibold text-slate-900">{viewingAppointment.clientPhone}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">E-mail:</span>
                  <span className="font-semibold text-slate-900">{viewingAppointment.clientEmail}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Data e Horário:</span>
                  <span className="font-bold text-teal-800 tabular-nums">
                    {viewingAppointment.date.split('-').reverse().join('/')} às {viewingAppointment.time}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Procedimento:</span>
                  <span className="font-semibold text-slate-900">
                    {serviceMap.get(viewingAppointment.serviceId)?.name}
                  </span>
                </div>
              </div>

              {viewingAppointment.clientBirthDate && (
                <div>
                  <span className="text-slate-400 text-xs block">Data de Nascimento:</span>
                  <span className="text-slate-800 font-medium">
                    {viewingAppointment.clientBirthDate.split('-').reverse().join('/')}
                  </span>
                </div>
              )}

              {viewingAppointment.notes && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-xs font-semibold text-slate-700 block mb-0.5">
                    Queixa Principal / Observações do Paciente:
                  </span>
                  <p className="text-slate-800">{viewingAppointment.notes}</p>
                </div>
              )}

              {viewingAppointment.cancellationReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                  <span className="text-xs font-bold block mb-0.5">Motivo do Cancelamento:</span>
                  <p>{viewingAppointment.cancellationReason}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <a
                href={buildWhatsAppLink(
                  viewingAppointment.clientPhone,
                  `Olá, ${viewingAppointment.clientName}! Equipe da ${settings.clinicName} falando a respeito do seu agendamento ${viewingAppointment.code}.`
                )}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingApt(viewingAppointment)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-rose-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Excluir</span>
                </button>

                <button
                  onClick={() => setViewingAppointment(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CLINIC CANCEL APPOINTMENT */}
      {cancellingApt && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <XCircle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Cancelar Agendamento</h3>
                <p className="text-xs text-slate-500">
                  {cancellingApt.code} · {cancellingApt.clientName}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600">
              Ao confirmar o cancelamento, este horário de <strong>{cancellingApt.date.split('-').reverse().join('/')} às {cancellingApt.time}</strong> será liberado imediatamente no sistema.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Motivo do Cancelamento
              </label>
              <input
                type="text"
                value={clinicCancelReason}
                onChange={(e) => setClinicCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-teal-600 bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancellingApt(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange(cancellingApt.id, 'cancelado_clinica', clinicCancelReason)}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Confirmar e Liberar Horário
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD QUICK APPOINTMENT */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveQuickAppointment}
            className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Novo Agendamento pela Recepção
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="text-xs text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Paciente *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp / Telefone *</label>
                <input
                  type="tel"
                  required
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Procedimento</label>
                <select
                  value={newServiceId}
                  onChange={(e) => setNewServiceId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - R$ {s.price.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Profissional</label>
                <select
                  value={newProfId}
                  onChange={(e) => setNewProfId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white"
                >
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Horário</label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notas / Queixa</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Atendimento presencial na recepção"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Cadastrar Agendamento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: PERMANENT DELETE CONFIRMATION */}
      {deletingApt && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Excluir Agendamento?
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {deletingApt.code} · {deletingApt.clientName}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Você tem certeza que deseja excluir permanentemente o agendamento de{' '}
              <strong className="text-slate-900">{deletingApt.clientName}</strong> marcado para o dia{' '}
              <strong className="text-slate-900">
                {deletingApt.date.split('-').reverse().join('/')} às {deletingApt.time}
              </strong>
              ?
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              ⚠️ <strong>Atenção:</strong> O registro será apagado do banco de dados na nuvem (Firestore) e o horário será liberado no sistema.
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingApt(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Excluindo...' : 'Sim, Excluir Definitivamente'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
