import React, { useState } from 'react';
import { Calendar, Clock, User, ShieldCheck, Menu, X, PhoneCall } from 'lucide-react';
import { ClinicNotification, ClinicSettings } from '../types';

interface HeaderProps {
  currentTab: 'agendamento' | 'consulta' | 'servicos' | 'clinica';
  onSelectTab: (tab: 'agendamento' | 'consulta' | 'servicos' | 'clinica') => void;
  notifications: ClinicNotification[];
  settings: ClinicSettings;
  onOpenNotifications: () => void;
  isAdminUnlocked: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  settings,
  isAdminUnlocked,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (tab: 'agendamento' | 'consulta' | 'servicos' | 'clinica') => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* Top Bar Contract: 3 zones */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleNav('agendamento')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-teal-700 transition-colors">
              🦶
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-teal-700 transition-colors block leading-tight">
                {settings.clinicName || 'Clau Podologia'}
              </span>
              <span className="text-xs text-slate-500 font-medium hidden sm:block">
                Podologia Avançada & Laser
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => handleNav('agendamento')}
            className={`transition-colors whitespace-nowrap hover:text-slate-900 ${
              currentTab === 'agendamento' ? 'text-teal-700 font-semibold' : ''
            }`}
          >
            Agendar Horário
          </button>
          <button
            onClick={() => handleNav('consulta')}
            className={`transition-colors whitespace-nowrap hover:text-slate-900 ${
              currentTab === 'consulta' ? 'text-teal-700 font-semibold' : ''
            }`}
          >
            Consultar / Cancelar
          </button>
          <button
            onClick={() => handleNav('servicos')}
            className={`transition-colors whitespace-nowrap hover:text-slate-900 ${
              currentTab === 'servicos' ? 'text-teal-700 font-semibold' : ''
            }`}
          >
            Tratamentos & Tabela
          </button>
        </nav>

        {/* Zone 3: Primary action + Clinic Portal Access */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Clinic Admin Access Button */}
          <button
            onClick={() => handleNav('clinica')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              currentTab === 'clinica'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300/80'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Acesso da Clínica</span>
            {isAdminUnlocked && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Sessão autenticada" />
            )}
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            aria-label="Abrir menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2 shadow-lg">
          <button
            onClick={() => handleNav('agendamento')}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'agendamento'
                ? 'bg-teal-50 text-teal-800 font-semibold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            📅 Agendar Horário de Podologia
          </button>
          <button
            onClick={() => handleNav('consulta')}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'consulta'
                ? 'bg-teal-50 text-teal-800 font-semibold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            🔍 Consultar / Cancelar Meu Agendamento
          </button>
          <button
            onClick={() => handleNav('servicos')}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentTab === 'servicos'
                ? 'bg-teal-50 text-teal-800 font-semibold'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            🩺 Tratamentos e Valores
          </button>
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => handleNav('clinica')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold bg-slate-900 text-white"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                Painel Administrativo da Clínica
              </span>
            </button>
          </div>
          <div className="pt-2 text-xs text-slate-500 flex items-center gap-1">
            <PhoneCall className="w-3.5 h-3.5 text-teal-600" />
            <span>Central: {settings.phone}</span>
          </div>
        </div>
      )}
    </header>
  );
};
