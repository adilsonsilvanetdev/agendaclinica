export type AppointmentStatus = 'agendado' | 'concluido' | 'cancelado_cliente' | 'cancelado_clinica';

export interface Service {
  id: string;
  name: string;
  category: 'Geral' | 'Especializada' | 'Preventiva' | 'Terapêutica';
  description: string;
  durationMin: number;
  price: number;
  recommendedIntervalDays?: number;
  popular?: boolean;
}

export interface Professional {
  id: string;
  name: string;
  role: string;
  registry: string; // Ex: Registro Podólogo / ABP
  avatar: string;
  bio: string;
  workDays: number[]; // 1 = Seg, 2 = Ter, etc.
}

export interface Appointment {
  id: string;
  code: string; // Ex: PODO-4821
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientBirthDate?: string;
  isFirstVisit: boolean;
  notes?: string;
  serviceId: string;
  professionalId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  endTime?: string; // HH:mm
  durationMin?: number; // minutos do tratamento
  status: AppointmentStatus;
  cancellationReason?: string;
  cancelledAt?: string;
  createdAt: string;
  confirmationChannel: 'whatsapp' | 'email' | 'ambos';
  price: number;
}

export interface ClinicNotification {
  id: string;
  appointmentId: string;
  type: 'cancelamento_cliente' | 'novo_agendamento' | 'horario_liberado';
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  reason?: string;
  timestamp: string;
  read: boolean;
}

export interface ClinicSettings {
  clinicName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  adminPin: string;
  openHour: number; // Ex: 8
  closeHour: number; // Ex: 19
  slotIntervalMin: number; // Ex: 45 or 60
}
