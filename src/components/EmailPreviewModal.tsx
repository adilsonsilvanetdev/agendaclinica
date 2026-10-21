import React from 'react';
import { Mail, CheckCircle2, Printer, X, MapPin, Calendar, Clock, Sparkles } from 'lucide-react';
import { Appointment, Service, Professional, ClinicSettings } from '../types';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  service: Service | null;
  professional: Professional | null;
  settings: ClinicSettings;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  appointment,
  service,
  professional,
  settings,
}) => {
  if (!isOpen || !appointment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              Confirmação Automática por E-mail
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        {/* Realistic Email Envelope Frame */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-1">
          <div>
            <strong>De:</strong> {settings.clinicName} &lt;{settings.email}&gt;
          </div>
          <div>
            <strong>Para:</strong> {appointment.clientName} &lt;{appointment.clientEmail}&gt;
          </div>
          <div>
            <strong>Assunto:</strong> Confirmação de Agendamento: {service?.name} ({appointment.code})
          </div>
        </div>

        {/* Email Body */}
        <div className="border border-slate-200 rounded-2xl p-6 bg-white space-y-4 text-slate-800 text-xs sm:text-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="text-lg font-extrabold text-teal-800">{settings.clinicName}</div>
              <div className="text-xs text-slate-400">Podologia Clínica & Laserterapia</div>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                {appointment.code}
              </span>
            </div>
          </div>

          <p>
            Olá, <strong>{appointment.clientName}</strong>!
          </p>

          <p>
            Confirmamos o seu agendamento de podologia. Estamos prontos para oferecer o melhor cuidado e atenção para a saúde dos seus pés.
          </p>

          {/* Details Table */}
          <div className="bg-teal-50/60 border border-teal-200/80 rounded-xl p-4 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Data da Consulta:</span>
              <strong className="text-slate-900 tabular-nums">
                {appointment.date.split('-').reverse().join('/')}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Horário:</span>
              <strong className="text-slate-900 tabular-nums">{appointment.time}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tratamento:</span>
              <strong className="text-slate-900">{service?.name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Especialista:</span>
              <strong className="text-slate-900">{professional?.name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Valor Estimado:</span>
              <strong className="text-slate-900 tabular-nums">R$ {appointment.price.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between pt-2 border-t border-teal-200/60">
              <span className="text-slate-500">Endereço da Clínica:</span>
              <strong className="text-slate-900 text-right">{settings.address}, {settings.city}</strong>
            </div>
          </div>

          {/* Clinical Instructions */}
          <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl">
            <strong className="text-slate-900 block font-semibold">Orientações para o dia do atendimento:</strong>
            <ul className="list-disc list-inside space-y-1">
              <li>Recomendamos utilizar calçados confortáveis e meias fáceis de retirar.</li>
              <li>Não é necessário cortar ou manipular unhas ou calosidades em casa antes da consulta.</li>
              <li>Chegue com 5 a 10 minutos de antecedência.</li>
              <li>Em caso de imprevisto ou necessidade de cancelamento, você pode liberar o horário online através do nosso site informando o código <strong>{appointment.code}</strong>.</li>
            </ul>
          </div>

          <div className="pt-2 text-xs text-slate-500 text-center">
            {settings.clinicName} · Central: {settings.phone} · WhatsApp: {settings.whatsapp}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Imprimir Comprovante</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl"
          >
            Fechar Visualização
          </button>
        </div>
      </div>
    </div>
  );
};
