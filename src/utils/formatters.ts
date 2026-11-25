import { Itinerary, ItineraryEvent } from '../types/itinerary';

const WEEKDAYS_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const MONTHS_SHORT_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

export function parseLocalDate(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function getTodayLocalYmd(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateShort(yyyyMmDd: string): string {
  if (!yyyyMmDd) return 'Em aberto';
  const parts = yyyyMmDd.split('-');
  if (parts.length !== 3) return yyyyMmDd;
  return `${parts[2]}/${parts[1]}`;
}

export function formatDateWithYear(yyyyMmDd: string): string {
  if (!yyyyMmDd) return 'Data em aberto';
  const parts = yyyyMmDd.split('-');
  if (parts.length !== 3) return yyyyMmDd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateHeading(yyyyMmDd: string): {
  dayMonth: string;
  weekday: string;
  monthLabel: string;
} {
  if (!yyyyMmDd) {
    return {
      dayMonth: '',
      weekday: 'Locais e ideias',
      monthLabel: '',
    };
  }
  const dt = parseLocalDate(yyyyMmDd);
  const parts = yyyyMmDd.split('-');
  return {
    dayMonth: `${parts[2]}/${parts[1]}`,
    weekday: WEEKDAYS_PT[dt.getDay()] ?? '',
    monthLabel: `${MONTHS_SHORT_PT[dt.getMonth()] ?? ''} ${parts[0]}`,
  };
}

export function isEventPast(ev: ItineraryEvent, now: Date = new Date()): boolean {
  const dateParts = ev.date.split('-').map(Number);
  if (dateParts.length !== 3 || dateParts.some(Number.isNaN)) return false;
  const [year, month, day] = dateParts;
  const targetTime = ev.endTime && ev.endTime > ev.time ? ev.endTime : ev.time;
  const [hh, mm] = (targetTime || '23:59').split(':').map(Number);
  const eventDateTime = new Date(
    year,
    month - 1,
    day,
    Number.isNaN(hh) ? 23 : hh,
    Number.isNaN(mm) ? 59 : mm,
    0,
    0
  );
  return eventDateTime.getTime() < now.getTime();
}

export function isEventCompleted(ev: ItineraryEvent, now: Date = new Date()): boolean {
  return ev.status === 'concluido' || isEventPast(ev, now);
}

export function addMinutesToTime(timeHHMM: string, minutesToAdd: number): string {
  const [h, m] = timeHHMM.split(':').map(Number);
  const total = ((h || 0) * 60 + (m || 0) + minutesToAdd) % (24 * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sanitizeHttpUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProto);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
