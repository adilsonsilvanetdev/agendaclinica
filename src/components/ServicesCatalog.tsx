import React from 'react';
import { Clock, CheckCircle, ArrowRight, Shield, Award } from 'lucide-react';
import { Service, ClinicSettings } from '../types';

interface ServicesCatalogProps {
  services: Service[];
  onSelectServiceToBook: (serviceId: string) => void;
  settings: ClinicSettings;
}

export const ServicesCatalog: React.FC<ServicesCatalogProps> = ({
  services,
  onSelectServiceToBook,
  settings,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-8">
      {/* Hero Banner with Generated Clinic Photo */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm">
        <img
          src="/src/assets/images/hero_podologia_clinic_1792490645791.jpg"
          alt="Clínica Moderna de Podologia"
          referrerPolicy="no-referrer"
          className="w-full h-56 sm:h-72 md:h-80 object-cover opacity-85"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent flex flex-col justify-end p-6 sm:p-10 text-white">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-1">
            Excelência em Saúde dos Pés
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Tratamentos Podológicos Especializados
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-2xl">
            Ambiente com esterilização cirúrgica em autoclave, equipamentos de laserterapia e profissionais pós-graduados em podiatria clínica.
          </p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Tabela de Procedimentos e Valores
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Escolha o tratamento desejado e agende seu horário com confirmação automática.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:border-teal-600 hover:shadow-xs transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-md">
                    {service.category}
                  </span>
                  <div className="text-lg font-bold text-slate-900 tabular-nums">
                    R$ {service.price.toFixed(2)}
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">
                  {service.name}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
                  {service.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Duração: {service.durationMin} min</span>
                </div>

                <button
                  onClick={() => onSelectServiceToBook(service.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
                >
                  <span>Agendar Horário</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust & Hygiene Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 text-center space-y-1">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-2">
            <Shield className="w-5 h-5 text-teal-600" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Biossegurança Rigorosa</h4>
          <p className="text-xs text-slate-500">
            Materiais descartáveis e instrumentais esterilizados em autoclave com indicador biológico.
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 text-center space-y-1">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-2">
            <Award className="w-5 h-5 text-teal-600" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Especialistas Registrados</h4>
          <p className="text-xs text-slate-500">
            Podólogos formados com registro na Associação Brasileira de Podologia e ampla experiência clínica.
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 text-center space-y-1">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-2">
            <CheckCircle className="w-5 h-5 text-teal-600" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Confirmação Imediata</h4>
          <p className="text-xs text-slate-500">
            Notificação instantânea no WhatsApp e por e-mail com opção de cancelamento ágil a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  );
};
