import React from 'react';
import { Bell, X, AlertTriangle, CalendarPlus, Check, MessageCircle, Clock } from 'lucide-react';
import { ClinicNotification, ClinicSettings } from '../types';
import { buildWhatsAppLink } from '../services/storage';

interface ClinicNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: ClinicNotification[];
  onMarkAllRead: () => void;
  settings: ClinicSettings;
}

export const ClinicNotificationsModal: React.FC<ClinicNotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  settings,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Notificações da Recepção
              </h3>
              <span className="text-xs text-slate-500">
                {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Tudo atualizado'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline"
              >
                Marcar como lidas
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 font-bold text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1 divide-y divide-slate-100">
          {notifications.map((notif) => {
            const isCancellation = notif.type === 'cancelamento_cliente';

            return (
              <div
                key={notif.id}
                className={`pt-3 first:pt-0 p-3 rounded-xl transition-all ${
                  !notif.read
                    ? isCancellation
                      ? 'bg-amber-50/80 border border-amber-200'
                      : 'bg-teal-50/50 border border-teal-100'
                    : 'bg-slate-50/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    {isCancellation ? (
                      <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                        <CalendarPlus className="w-4 h-4" />
                      </div>
                    )}

                    <div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900">
                        {isCancellation
                          ? `Cancelamento: ${notif.clientName}`
                          : `Novo Agendamento: ${notif.clientName}`}
                      </div>

                      <div className="text-xs text-slate-600 mt-0.5">
                        <strong className="text-teal-900">
                          {notif.date.split('-').reverse().join('/')} às {notif.time}
                        </strong>{' '}
                        · {notif.serviceName}
                      </div>

                      {isCancellation && (
                        <div className="mt-1.5 text-xs text-amber-950 font-medium">
                          {notif.reason && <span>Motivo: "{notif.reason}" · </span>}
                          <span className="text-emerald-800 font-bold">
                            ✓ Horário liberado automaticamente na agenda
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                    {notif.timestamp ? new Date(notif.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            );
          })}

          {notifications.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhuma notificação recente para exibir.
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
