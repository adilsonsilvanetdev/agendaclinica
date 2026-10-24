/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { BookingFlow } from './components/BookingFlow';
import { ClientAppointmentLookup } from './components/ClientAppointmentLookup';
import { ServicesCatalog } from './components/ServicesCatalog';
import { ClinicAdmin } from './components/ClinicAdmin';
import { ClinicNotificationsModal } from './components/ClinicNotificationsModal';
import { INITIAL_SERVICES, INITIAL_PROFESSIONALS } from './data/initialData';
import {
  getStoredAppointments,
  getStoredNotifications,
  getStoredSettings,
  markNotificationsAsRead,
  initFirestoreListeners,
} from './services/storage';
import { Appointment, Service, Professional, ClinicSettings, ClinicNotification } from './types';
import { Bell, AlertTriangle, Phone, Mail, MapPin, Calendar, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'agendamento' | 'consulta' | 'servicos' | 'clinica'>('agendamento');
  
  // Data state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<ClinicNotification[]>([]);
  const [settings, setSettings] = useState<ClinicSettings>(getStoredSettings());
  const [services] = useState<Service[]>(INITIAL_SERVICES);
  const [professionals] = useState<Professional[]>(INITIAL_PROFESSIONALS);

  // Clinic Admin lock state
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);

  // Modals & transient state
  const [lookupInitialCode, setLookupInitialCode] = useState<string>('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Floating immediate cancellation alert toast
  const [cancellationToast, setCancellationToast] = useState<{
    show: boolean;
    appointment: Appointment;
  } | null>(null);

  // Refresh data from storage
  const reloadData = useCallback(() => {
    setAppointments(getStoredAppointments());
    setNotifications(getStoredNotifications());
    setSettings(getStoredSettings());
  }, []);

  // Initial load & reactive Firestore real-time synchronization
  useEffect(() => {
    reloadData();

    // Hook up real-time Cloud Firestore listeners
    const unsubscribeFirestore = initFirestoreListeners(
      (apts) => setAppointments(apts),
      (notifs) => setNotifications(notifs),
      (sett) => setSettings(sett)
    );

    const handleDataUpdate = () => {
      reloadData();
    };

    const handleCancellationAlert = (e: Event) => {
      const customEvent = e as CustomEvent<{ appointment: Appointment; notification: ClinicNotification }>;
      if (customEvent.detail && customEvent.detail.appointment) {
        setCancellationToast({
          show: true,
          appointment: customEvent.detail.appointment,
        });
      }
      reloadData();
    };

    window.addEventListener('podoclinica_data_updated', handleDataUpdate);
    window.addEventListener('podoclinica_cancellation_alert', handleCancellationAlert as EventListener);

    return () => {
      unsubscribeFirestore();
      window.removeEventListener('podoclinica_data_updated', handleDataUpdate);
      window.removeEventListener('podoclinica_cancellation_alert', handleCancellationAlert as EventListener);
    };
  }, [reloadData]);

  // Handle new appointment created by client
  const handleAppointmentCreated = (appointment: Appointment) => {
    reloadData();
  };

  // Handle appointment cancelled by client
  const handleAppointmentCancelled = (appointment: Appointment) => {
    reloadData();
    // Show immediate cancellation toast
    setCancellationToast({
      show: true,
      appointment,
    });
  };


  const handleNavigateToLookup = (code: string) => {
    setLookupInitialCode(code);
    setCurrentTab('consulta');
  };

  const handleSelectServiceToBook = (serviceId: string) => {
    setCurrentTab('agendamento');
  };

  const handleMarkAllNotificationsRead = () => {
    markNotificationsAsRead();
    reloadData();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-teal-100 selection:text-teal-900">
      {/* Notificação em tempo real de cancelamento restrita ao acesso da clínica */}
      {isAdminUnlocked && cancellationToast && cancellationToast.show && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md w-full bg-slate-900 text-white p-4 rounded-2xl border border-slate-700 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm text-white flex items-center justify-between">
                <span>Alerta: Horário Liberado na Agenda</span>
                <span className="text-[10px] text-amber-400 uppercase font-mono font-bold">
                  {cancellationToast.appointment.code}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                O paciente <strong>{cancellationToast.appointment.clientName}</strong> cancelou o atendimento do dia{' '}
                <strong>
                  {cancellationToast.appointment.date.split('-').reverse().join('/')} às {cancellationToast.appointment.time}
                </strong>
                . O horário já está disponível para novos agendamentos!
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={() => {
                    setCurrentTab('clinica');
                    setIsAdminUnlocked(true);
                    setCancellationToast(null);
                  }}
                  className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Abrir Agenda da Clínica
                </button>
                <button
                  onClick={() => setCancellationToast(null)}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                >
                  Dispensar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Navigation Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        notifications={notifications}
        settings={settings}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        isAdminUnlocked={isAdminUnlocked}
      />

      {/* Content Viewport */}
      <main className="flex-1">
        {currentTab === 'agendamento' && (
          <BookingFlow
            services={services}
            professionals={professionals}
            settings={settings}
            appointments={appointments}
            onAppointmentCreated={handleAppointmentCreated}
            onNavigateToLookup={handleNavigateToLookup}
          />
        )}

        {currentTab === 'consulta' && (
          <ClientAppointmentLookup
            initialCode={lookupInitialCode}
            services={services}
            professionals={professionals}
            settings={settings}
            appointments={appointments}
            onNavigateToBooking={() => setCurrentTab('agendamento')}
            onAppointmentCancelled={handleAppointmentCancelled}
          />
        )}

        {currentTab === 'servicos' && (
          <ServicesCatalog
            services={services}
            onSelectServiceToBook={handleSelectServiceToBook}
            settings={settings}
          />
        )}

        {currentTab === 'clinica' && (
          <ClinicAdmin
            appointments={appointments}
            services={services}
            professionals={professionals}
            settings={settings}
            notifications={notifications}
            isUnlocked={isAdminUnlocked}
            onUnlock={() => setIsAdminUnlocked(true)}
            onLock={() => setIsAdminUnlocked(false)}
            onUpdateSettings={(newSettings) => setSettings(newSettings)}
            onAppointmentsChange={reloadData}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
          />
        )}
      </main>

      {/* Clinic Notifications Drawer Modal */}
      <ClinicNotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
        settings={settings}
      />

      {/* Clean Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">{settings.clinicName}</span>
            <span>·</span>
            <span>{settings.address}, {settings.city}</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span>Central: {settings.phone}</span>
            <span>·</span>
            <span>WhatsApp: {settings.whatsapp}</span>
            {settings.email && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {settings.email}
                </span>
              </>
            )}
            <span>·</span>
            <button
              onClick={() => setCurrentTab('clinica')}
              className="text-teal-700 hover:underline font-semibold"
            >
              Área da Clínica
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
