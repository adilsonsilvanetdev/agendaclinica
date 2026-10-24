import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDocs,
  query,
  orderBy,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Appointment, ClinicNotification, ClinicSettings, Service, Professional } from '../types';
import {
  INITIAL_SERVICES,
  INITIAL_PROFESSIONALS,
  INITIAL_SETTINGS,
  generateSeedAppointments,
  INITIAL_NOTIFICATIONS,
} from '../data/initialData';

const APPOINTMENTS_KEY = 'podoclinica_appointments_v1';
const NOTIFICATIONS_KEY = 'podoclinica_notifications_v1';
const SETTINGS_KEY = 'podoclinica_settings_v1';
const DELETED_APPOINTMENTS_KEY = 'podoclinica_deleted_ids_v1';

// Local cache
let inMemoryAppointments: Appointment[] = [];
let inMemoryNotifications: ClinicNotification[] = [];
let inMemorySettings: ClinicSettings = INITIAL_SETTINGS;

// Deleted appointments tombstone tracker to prevent deleted items from being resurrected
export function markAppointmentAsDeleted(id: string): void {
  try {
    const raw = localStorage.getItem(DELETED_APPOINTMENTS_KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(id);
    localStorage.setItem(DELETED_APPOINTMENTS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn(e);
  }
}

export function isAppointmentDeleted(id: string): boolean {
  try {
    const raw = localStorage.getItem(DELETED_APPOINTMENTS_KEY);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return Array.isArray(list) && list.includes(id);
  } catch {
    return false;
  }
}

// Initialize and subscribe to Firestore
export function initFirestoreListeners(
  onAppointmentsUpdate: (apts: Appointment[]) => void,
  onNotificationsUpdate: (notifs: ClinicNotification[]) => void,
  onSettingsUpdate: (settings: ClinicSettings) => void
) {
  if (!db) {
    onAppointmentsUpdate(getStoredAppointments());
    onNotificationsUpdate(getStoredNotifications());
    onSettingsUpdate(getStoredSettings());
    return () => {};
  }

  // 1. Appointments real-time listener
  const aptsCol = collection(db, 'appointments');
  const unsubscribeApts = onSnapshot(
    aptsCol,
    async (snapshot) => {
      if (snapshot.empty) {
        // Seed initial appointments or upload any existing local data into cloud database
        const local = getStoredAppointments();
        const toUpload = local && local.length > 0 ? local : generateSeedAppointments();
        for (const s of toUpload) {
          if (isAppointmentDeleted(s.id)) continue;
          try {
            await setDoc(doc(db, 'appointments', s.id), s);
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `appointments/${s.id}`);
          }
        }
        const filtered = toUpload.filter((item) => !isAppointmentDeleted(item.id));
        inMemoryAppointments = filtered;
        saveLocalAppointments(filtered);
        onAppointmentsUpdate(filtered);
      } else {
        const loaded: Appointment[] = [];
        snapshot.forEach((d) => {
          const item = d.data() as Appointment;
          // If marked as deleted, ensure it stays removed and cleanup in Firestore if needed
          if (isAppointmentDeleted(item.id)) {
            deleteDoc(doc(db, 'appointments', item.id)).catch(() => {});
            return;
          }
          loaded.push(item);
        });

        // Sort by date & time
        loaded.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
        inMemoryAppointments = loaded;
        saveLocalAppointments(loaded);
        onAppointmentsUpdate(loaded);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'appointments');
      // Fallback to local
      const local = getStoredAppointments();
      onAppointmentsUpdate(local);
    }
  );

  // 2. Notifications real-time listener
  const notifsCol = collection(db, 'notifications');
  const unsubscribeNotifs = onSnapshot(
    notifsCol,
    async (snapshot) => {
      if (snapshot.empty) {
        for (const n of INITIAL_NOTIFICATIONS) {
          try {
            await setDoc(doc(db, 'notifications', n.id), n);
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `notifications/${n.id}`);
          }
        }
        inMemoryNotifications = INITIAL_NOTIFICATIONS;
        saveLocalNotifications(INITIAL_NOTIFICATIONS);
        onNotificationsUpdate(INITIAL_NOTIFICATIONS);
      } else {
        const loaded: ClinicNotification[] = [];
        snapshot.forEach((d) => {
          loaded.push(d.data() as ClinicNotification);
        });
        loaded.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        inMemoryNotifications = loaded;
        saveLocalNotifications(loaded);
        onNotificationsUpdate(loaded);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications');
      const local = getStoredNotifications();
      onNotificationsUpdate(local);
    }
  );

  // 3. Settings listener
  const settingsDocRef = doc(db, 'settings', 'general');
  const unsubscribeSettings = onSnapshot(
    settingsDocRef,
    async (snapshot) => {
      if (!snapshot.exists()) {
        try {
          await setDoc(settingsDocRef, INITIAL_SETTINGS);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'settings/general');
        }
        inMemorySettings = INITIAL_SETTINGS;
        saveStoredSettings(INITIAL_SETTINGS);
        onSettingsUpdate(INITIAL_SETTINGS);
      } else {
        const data = snapshot.data() as ClinicSettings;
        const normalizedSettings: ClinicSettings = {
          ...INITIAL_SETTINGS,
          ...data,
          openHour: data.openHour === 8 ? 9 : (data.openHour || 9),
          closeHour: data.closeHour || 19,
          email: data.email || INITIAL_SETTINGS.email,
        };
        inMemorySettings = normalizedSettings;
        saveStoredSettings(normalizedSettings);
        onSettingsUpdate(normalizedSettings);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'settings/general');
      onSettingsUpdate(getStoredSettings());
    }
  );

  return () => {
    unsubscribeApts();
    unsubscribeNotifs();
    unsubscribeSettings();
  };
}

export function getStoredSettings(): ClinicSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...INITIAL_SETTINGS,
        ...parsed,
        clinicName:
          !parsed.clinicName || parsed.clinicName === 'PodoClínica Especializada'
            ? 'Clau Podologia'
            : parsed.clinicName,
        openHour: parsed.openHour === 8 ? 9 : (parsed.openHour || 9),
        closeHour: parsed.closeHour || 19,
        email: parsed.email || INITIAL_SETTINGS.email,
      };
    }
  } catch (e) {
    console.warn('Erro ao ler configurações do localStorage:', e);
  }
  return inMemorySettings
    ? {
        ...INITIAL_SETTINGS,
        ...inMemorySettings,
        clinicName:
          !inMemorySettings.clinicName || inMemorySettings.clinicName === 'PodoClínica Especializada'
            ? 'Clau Podologia'
            : inMemorySettings.clinicName,
        openHour: inMemorySettings.openHour === 8 ? 9 : (inMemorySettings.openHour || 9),
        closeHour: inMemorySettings.closeHour || 19,
        email: inMemorySettings.email || INITIAL_SETTINGS.email,
      }
    : INITIAL_SETTINGS;
}

export function saveStoredSettings(settings: ClinicSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn(e);
  }
  // Sync to Firestore
  try {
    setDoc(doc(db, 'settings', 'general'), settings).catch((err) =>
      handleFirestoreError(err, OperationType.WRITE, 'settings/general')
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, 'settings/general');
  }
}

export function getStoredAppointments(): Appointment[] {
  if (inMemoryAppointments.length > 0) {
    return inMemoryAppointments.filter((a) => !isAppointmentDeleted(a.id));
  }
  try {
    const raw = localStorage.getItem(APPOINTMENTS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        const filtered = data.filter((a) => !isAppointmentDeleted(a.id));
        inMemoryAppointments = filtered;
        return filtered;
      }
    }
  } catch (e) {
    console.warn('Erro ao ler agendamentos do localStorage:', e);
  }
  const seed = generateSeedAppointments().filter((a) => !isAppointmentDeleted(a.id));
  inMemoryAppointments = seed;
  saveLocalAppointments(seed);
  return seed;
}

function saveLocalAppointments(appointments: Appointment[]): void {
  try {
    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appointments));
  } catch (e) {
    console.warn(e);
  }
}

export function saveStoredAppointments(appointments: Appointment[]): void {
  inMemoryAppointments = appointments;
  saveLocalAppointments(appointments);
}

export function getStoredNotifications(): ClinicNotification[] {
  if (inMemoryNotifications.length > 0) return inMemoryNotifications;
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        inMemoryNotifications = data;
        return data;
      }
    }
  } catch (e) {
    console.warn('Erro ao ler notificações do localStorage:', e);
  }
  saveLocalNotifications(INITIAL_NOTIFICATIONS);
  return INITIAL_NOTIFICATIONS;
}

function saveLocalNotifications(notifications: ClinicNotification[]): void {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (e) {
    console.warn(e);
  }
}

export function generateAppointmentCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `PODO-${num}`;
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function calculateEndTime(startTime: string, durationMin: number): string {
  return minutesToTime(timeToMinutes(startTime) + durationMin);
}

export function createAppointment(
  data: Omit<Appointment, 'id' | 'code' | 'createdAt' | 'status'>
): Appointment {
  const services = INITIAL_SERVICES;
  const service = services.find((s) => s.id === data.serviceId);
  const duration = service ? service.durationMin : (data.durationMin || 50);
  const calculatedEnd = data.endTime || calculateEndTime(data.time, duration);

  const newAppointment: Appointment = {
    ...data,
    id: `apt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    code: generateAppointmentCode(),
    status: 'agendado',
    createdAt: new Date().toISOString(),
    price: service ? service.price : data.price || 130,
    durationMin: duration,
    endTime: calculatedEnd,
  };

  // 1. Save in-memory and local cache
  inMemoryAppointments = [newAppointment, ...inMemoryAppointments];
  saveLocalAppointments(inMemoryAppointments);

  // 2. Persist to cloud Firestore
  try {
    setDoc(doc(db, 'appointments', newAppointment.id), newAppointment).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `appointments/${newAppointment.id}`)
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, `appointments/${newAppointment.id}`);
  }

  // 3. Add notification to cloud Firestore
  const newNotif: ClinicNotification = {
    id: `notif-${Date.now()}`,
    appointmentId: newAppointment.id,
    type: 'novo_agendamento',
    clientName: newAppointment.clientName,
    serviceName: service?.name || 'Podologia',
    date: newAppointment.date,
    time: newAppointment.time,
    timestamp: new Date().toISOString(),
    read: false,
  };
  inMemoryNotifications = [newNotif, ...inMemoryNotifications];
  saveLocalNotifications(inMemoryNotifications);

  try {
    setDoc(doc(db, 'notifications', newNotif.id), newNotif).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `notifications/${newNotif.id}`)
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, `notifications/${newNotif.id}`);
  }

  window.dispatchEvent(
    new CustomEvent('podoclinica_data_updated', {
      detail: { type: 'new_appointment', appointment: newAppointment },
    })
  );

  return newAppointment;
}

export function cancelAppointmentByClient(
  appointmentId: string,
  reason: string
): { success: boolean; appointment?: Appointment } {
  const appointments = getStoredAppointments();
  const index = appointments.findIndex((a) => a.id === appointmentId);
  if (index === -1) return { success: false };

  const appointment = appointments[index];
  appointment.status = 'cancelado_cliente';
  appointment.cancellationReason = reason || 'Cancelado pelo cliente pelo portal web';
  appointment.cancelledAt = new Date().toISOString();

  saveLocalAppointments(appointments);

  // Update in Cloud Firestore
  try {
    updateDoc(doc(db, 'appointments', appointment.id), {
      status: 'cancelado_cliente',
      cancellationReason: appointment.cancellationReason,
      cancelledAt: appointment.cancelledAt,
    }).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${appointment.id}`)
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `appointments/${appointment.id}`);
  }

  // Create immediate cancellation alert notification in Cloud Firestore
  const services = INITIAL_SERVICES;
  const service = services.find((s) => s.id === appointment.serviceId);
  const cancelNotif: ClinicNotification = {
    id: `notif-${Date.now()}`,
    appointmentId: appointment.id,
    type: 'cancelamento_cliente',
    clientName: appointment.clientName,
    serviceName: service?.name || 'Podologia',
    date: appointment.date,
    time: appointment.time,
    reason: appointment.cancellationReason,
    timestamp: new Date().toISOString(),
    read: false,
  };
  inMemoryNotifications = [cancelNotif, ...inMemoryNotifications];
  saveLocalNotifications(inMemoryNotifications);

  try {
    setDoc(doc(db, 'notifications', cancelNotif.id), cancelNotif).catch((err) =>
      handleFirestoreError(err, OperationType.CREATE, `notifications/${cancelNotif.id}`)
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, `notifications/${cancelNotif.id}`);
  }

  // Dispatch custom alert event
  window.dispatchEvent(
    new CustomEvent('podoclinica_cancellation_alert', {
      detail: {
        appointment,
        notification: cancelNotif,
      },
    })
  );

  window.dispatchEvent(
    new CustomEvent('podoclinica_data_updated', {
      detail: { type: 'cancellation', appointment },
    })
  );

  return { success: true, appointment };
}

export function updateAppointmentStatus(
  appointmentId: string,
  status: Appointment['status'],
  reason?: string
): Appointment | null {
  const appointments = getStoredAppointments();
  const index = appointments.findIndex((a) => a.id === appointmentId);
  if (index === -1) return null;

  appointments[index].status = status;
  const updatePayload: Partial<Appointment> = { status };
  if (reason) {
    appointments[index].cancellationReason = reason;
    appointments[index].cancelledAt = new Date().toISOString();
    updatePayload.cancellationReason = reason;
    updatePayload.cancelledAt = appointments[index].cancelledAt;
  }
  saveLocalAppointments(appointments);

  try {
    updateDoc(doc(db, 'appointments', appointmentId), updatePayload).catch((err) =>
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${appointmentId}`)
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `appointments/${appointmentId}`);
  }

  window.dispatchEvent(
    new CustomEvent('podoclinica_data_updated', { detail: { type: 'status_changed' } })
  );
  return appointments[index];
}

export async function deleteAppointment(appointmentId: string): Promise<boolean> {
  // 1. Mark as permanently deleted tombstone so no device or cache resurrects it
  markAppointmentAsDeleted(appointmentId);

  // 2. Remove immediately from in-memory cache and localStorage
  inMemoryAppointments = inMemoryAppointments.filter((a) => a.id !== appointmentId);
  const currentLocal = getStoredAppointments().filter((a) => a.id !== appointmentId);
  saveLocalAppointments(currentLocal);

  // 3. Remove any notification tied to this appointment locally and from Cloud Firestore
  const relatedNotifs = inMemoryNotifications.filter((n) => n.appointmentId === appointmentId);
  inMemoryNotifications = inMemoryNotifications.filter((n) => n.appointmentId !== appointmentId);
  const currentNotifs = getStoredNotifications().filter((n) => n.appointmentId !== appointmentId);
  saveLocalNotifications(currentNotifs);

  if (db) {
    for (const notif of relatedNotifs) {
      try {
        deleteDoc(doc(db, 'notifications', notif.id)).catch(() => {});
      } catch {
        // quiet
      }
    }
  }

  // 4. Delete from Cloud Firestore permanently
  if (db) {
    try {
      await deleteDoc(doc(db, 'appointments', appointmentId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `appointments/${appointmentId}`);
    }
  }

  // 5. Dispatch event for UI reactivity
  window.dispatchEvent(
    new CustomEvent('podoclinica_data_updated', {
      detail: { type: 'appointment_deleted', appointmentId },
    })
  );

  return true;
}

export function markNotificationsAsRead(): void {
  const notifications = getStoredNotifications();
  const updated = notifications.map((n) => ({ ...n, read: true }));
  inMemoryNotifications = updated;
  saveLocalNotifications(updated);

  // Sync each to Firestore
  for (const n of updated) {
    try {
      updateDoc(doc(db, 'notifications', n.id), { read: true }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `notifications/${n.id}`)
      );
    } catch (e) {
      // quiet
    }
  }

  window.dispatchEvent(
    new CustomEvent('podoclinica_data_updated', { detail: { type: 'notifications_read' } })
  );
}

export function resetDemoData(): void {
  localStorage.removeItem(APPOINTMENTS_KEY);
  localStorage.removeItem(NOTIFICATIONS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  inMemoryAppointments = generateSeedAppointments();
  inMemoryNotifications = INITIAL_NOTIFICATIONS;
  window.dispatchEvent(new CustomEvent('podoclinica_data_updated', { detail: { type: 'reset' } }));
}

export interface AvailableSlot {
  time: string; // HH:mm
  endTime: string; // HH:mm
  durationMin: number;
  available: boolean;
  isPast?: boolean;
  bookedBy?: string;
  collisionReason?: string;
}

// Available time slots calculation calculating treatment duration and organizing future schedule
export function getAvailableSlots(
  dateStr: string,
  professionalId: string,
  openHour: number = 9,
  closeHour: number = 19,
  providedAppointments?: Appointment[],
  serviceDurationMin: number = 50
): AvailableSlot[] {
  const appointments = providedAppointments && providedAppointments.length > 0
    ? providedAppointments
    : getStoredAppointments();

  // Determine current local date & time
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
  const nowDay = String(now.getDate()).padStart(2, '0');
  const localTodayStr = `${nowYear}-${nowMonth}-${nowDay}`;
  const currentMinutesToday = now.getHours() * 60 + now.getMinutes();

  const isToday = dateStr === localTodayStr;
  const isPastDate = dateStr < localTodayStr;

  const openMinutes = openHour * 60;
  const closeMinutes = closeHour * 60;

  // Active appointments for this professional on this date
  const activeApts = appointments.filter(
    (a) =>
      a.date === dateStr &&
      a.professionalId === professionalId &&
      a.status === 'agendado'
  );

  // Map each active appointment to its busy [startMin, endMin) interval
  const busyIntervals = activeApts.map((a) => {
    const startMin = timeToMinutes(a.time);
    const dur = a.durationMin || (INITIAL_SERVICES.find((s) => s.id === a.serviceId)?.durationMin || 50);
    const endMin = a.endTime ? timeToMinutes(a.endTime) : (startMin + dur);
    return {
      appointment: a,
      startMin,
      endMin,
    };
  });

  // Candidate start minutes:
  // 1. Regular 30-minute intervals from openHour to closeHour
  // 2. Exact end times of existing appointments (e.g. 09:50) so appointments can immediately follow
  const candidateSet = new Set<number>();
  for (let m = openMinutes; m <= closeMinutes - serviceDurationMin; m += 30) {
    candidateSet.add(m);
  }

  for (const interval of busyIntervals) {
    if (interval.endMin >= openMinutes && interval.endMin + serviceDurationMin <= closeMinutes) {
      candidateSet.add(interval.endMin);
    }
  }

  const sortedCandidates = Array.from(candidateSet).sort((a, b) => a - b);
  const slots: AvailableSlot[] = [];

  for (const startMin of sortedCandidates) {
    const endMin = startMin + serviceDurationMin;
    const timeStr = minutesToTime(startMin);
    const endTimeStr = minutesToTime(endMin);

    // Past slot if whole date is in the past, or if today and start is before current time
    const isPast = isPastDate || (isToday && startMin <= currentMinutesToday);

    // Collision check: intervals [candStart, candEnd) and [busyStart, busyEnd) overlap if candStart < busyEnd and candEnd > busyStart
    const collision = busyIntervals.find(
      (b) => startMin < b.endMin && endMin > b.startMin
    );

    const available = !isPast && !collision && endMin <= closeMinutes;

    slots.push({
      time: timeStr,
      endTime: endTimeStr,
      durationMin: serviceDurationMin,
      available,
      isPast,
      bookedBy: collision ? collision.appointment.clientName : undefined,
      collisionReason: collision
        ? `Ocupado (${collision.appointment.time} às ${minutesToTime(collision.endMin)})`
        : undefined,
    });
  }

  return slots;
}

// WhatsApp link generator
export function buildWhatsAppLink(phone: string, text: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`}?text=${encodedText}`;
}

// Formato enviado para o WhatsApp da Clínica quando o paciente agenda pelo site
export function formatWhatsAppBookingNoticeForClinic(
  appointment: Appointment,
  service: Service,
  professional: Professional,
  settings: ClinicSettings
): string {
  const [year, month, day] = appointment.date.split('-');
  const dateFormatted = `${day}/${month}/${year}`;
  const endTime = appointment.endTime || calculateEndTime(appointment.time, service.durationMin);
  const clinicName = settings.clinicName || 'Clau Podologia';
  const profName = professional?.name || 'Dra. Laura Mendes';
  const fullAddress = `${settings.address || 'Av. Paulista, 1200, Sala 804 - Bela Vista'}, ${settings.city || 'São Paulo - SP'}`;

  return (
    `Confirmação de Agendamento - ${clinicName}\n\n` +
    `Paciente: ${appointment.clientName}\n` +
    `📞 Contato: ${appointment.clientPhone}\n\n` +
    `📅 Data: ${dateFormatted}\n` +
    `⏰ Horário: ${appointment.time} às ${endTime} (${service.durationMin} min)\n` +
    `🩺 Tratamento: ${service.name}\n` +
    `👩‍⚕️ Especialista: ${profName}\n` +
    `💰 Valor: R$ ${appointment.price.toFixed(2)}\n` +
    `📍 Local: ${fullAddress}\n` +
    `🔖 Código do Agendamento: ${appointment.code}\n` +
    (appointment.notes ? `📝 Observações: ${appointment.notes}\n` : '') +
    `\nCaso precise remarcar ou cancelar com antecedência, avise-nos por aqui ou acesse nosso site informando seu código. Até breve!`
  );
}

// Formato padrão enviado para o WhatsApp do Paciente (quando a clínica agenda ou envia confirmação)
export function formatWhatsAppConfirmationMessage(
  appointment: Appointment,
  service: Service,
  professional: Professional,
  settings: ClinicSettings
): string {
  const [year, month, day] = appointment.date.split('-');
  const dateFormatted = `${day}/${month}/${year}`;
  const endTime = appointment.endTime || calculateEndTime(appointment.time, service.durationMin);
  const clinicName = settings.clinicName || 'Clau Podologia';
  const profName = professional?.name || 'Dra. Laura Mendes';
  const fullAddress = `${settings.address || 'Av. Paulista, 1200, Sala 804 - Bela Vista'}, ${settings.city || 'São Paulo - SP'}`;

  return (
    `Confirmação de Agendamento - ${clinicName}\n\n` +
    `Olá, ${appointment.clientName}! Seu horário de podologia foi agendado com sucesso.\n\n` +
    `📅 Data: ${dateFormatted}\n` +
    `⏰ Horário: ${appointment.time} às ${endTime} (${service.durationMin} min)\n` +
    `🩺 Tratamento: ${service.name}\n` +
    `👩‍⚕️ Especialista: ${profName}\n` +
    `💰 Valor: R$ ${appointment.price.toFixed(2)}\n` +
    `📍 Local: ${fullAddress}\n` +
    `🔖 Código do Agendamento: ${appointment.code}\n` +
    (appointment.notes ? `📝 Observações: ${appointment.notes}\n` : '') +
    `\nCaso precise remarcar ou cancelar com antecedência, avise-nos por aqui ou acesse nosso site informando seu código. Até breve!`
  );
}

export function formatWhatsAppCancellationMessage(
  appointment: Appointment,
  settings: ClinicSettings
): string {
  const [year, month, day] = appointment.date.split('-');
  const dateFormatted = `${day}/${month}/${year}`;

  return (
    `*Notificação de Cancelamento - ${settings.clinicName}*\n\n` +
    `Informamos que o agendamento código *${appointment.code}* do paciente *${appointment.clientName}* ` +
    `marcado para o dia *${dateFormatted} às ${appointment.time}* foi cancelado.\n` +
    (appointment.cancellationReason ? `*Motivo:* ${appointment.cancellationReason}\n` : '') +
    `O horário já foi liberado no sistema para novos atendimentos.`
  );
}

// ICS Calendar download generator
export function downloadCalendarEvent(
  appointment: Appointment,
  service: Service,
  professional: Professional,
  settings: ClinicSettings
): void {
  const [year, month, day] = appointment.date.split('-');
  const [hour, minute] = appointment.time.split(':');

  const start = `${year}${month}${day}T${hour}${minute}00`;
  const endHour = (parseInt(hour, 10) + 1).toString().padStart(2, '0');
  const end = `${year}${month}${day}T${endHour}${minute}00`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PodoClinica//Agendamento Podologia//PT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `SUMMARY:${service.name} - ${settings.clinicName}`,
    `DESCRIPTION:Agendamento de Podologia com ${professional.name}. Código: ${appointment.code}`,
    `LOCATION:${settings.address}, ${settings.city}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `agendamento-${appointment.code}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// CSV Export for Clinic
export function exportAppointmentsToCSV(
  appointments: Appointment[],
  services: Service[],
  professionals: Professional[]
): void {
  const headers = [
    'Código',
    'Data',
    'Horário',
    'Paciente',
    'Telefone / WhatsApp',
    'E-mail',
    'Data Nasc.',
    'Primeira Vez',
    'Serviço',
    'Profissional',
    'Valor (R$)',
    'Status',
    'Motivo Cancelamento',
    'Observações',
    'Data Criação',
  ];

  const serviceMap = new Map(services.map((s) => [s.id, s.name]));
  const profMap = new Map(professionals.map((p) => [p.id, p.name]));

  const statusLabels: Record<string, string> = {
    agendado: 'Confirmado / Agendado',
    concluido: 'Atendido / Concluído',
    cancelado_cliente: 'Cancelado pelo Paciente',
    cancelado_clinica: 'Cancelado pela Clínica',
  };

  const rows = appointments.map((apt) => [
    apt.code,
    apt.date,
    apt.time,
    `"${(apt.clientName || '').replace(/"/g, '""')}"`,
    `"${(apt.clientPhone || '').replace(/"/g, '""')}"`,
    `"${(apt.clientEmail || '').replace(/"/g, '""')}"`,
    apt.clientBirthDate || '',
    apt.isFirstVisit ? 'Sim' : 'Não',
    `"${(serviceMap.get(apt.serviceId) || '').replace(/"/g, '""')}"`,
    `"${(profMap.get(apt.professionalId) || '').replace(/"/g, '""')}"`,
    (apt.price || 0).toFixed(2),
    `"${statusLabels[apt.status] || apt.status}"`,
    `"${(apt.cancellationReason || '').replace(/"/g, '""')}"`,
    `"${(apt.notes || '').replace(/"/g, '""')}"`,
    apt.createdAt ? apt.createdAt.split('T')[0] : '',
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `agendamentos-podologia-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
