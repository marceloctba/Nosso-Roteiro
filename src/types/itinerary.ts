import { Timestamp } from 'firebase/firestore';

export type EventStatus = 'planejado' | 'confirmado' | 'concluido';
export type ActivityAction =
  | 'created_event'
  | 'updated_event'
  | 'deleted_event'
  | 'synced_calendar'
  | 'sent_email'
  | 'updated_members';

/**
 * Limits synchronized with firebase-blueprint.json and firestore.rules
 */
export const BLUEPRINT_LIMITS = {
  TITLE_MAX: 120,
  EVENT_TITLE_MAX: 160,
  LOCATION_MAX: 240,
  LINK_LABEL_MAX: 80,
  LINK_URL_MAX: 500,
  LINKS_MAX: 10,
  ATTACHMENTS_MAX: 10,
  FILE_NAME_MAX: 160,
  FILE_BYTES_MAX: 700000,
  FILE_DATAURL_MAX: 950000,
  COVER_DATAURL_MAX: 250000,
  EMAIL_MAX: 254,
  LINKED_EMAILS_MAX: 25,
  SUMMARY_MAX: 240,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
  TIME_PATTERN: /^\d{2}:\d{2}$/,
  EMAIL_PATTERN: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
} as const;

export const ALLOWED_FILE_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type AllowedFileMime = (typeof ALLOWED_FILE_MIMES)[number];

export interface EventLink {
  label: string;
  url: string;
}

export interface EventAttachmentMeta {
  fileId: string;
  name: string;
  mimeType: AllowedFileMime;
  sizeBytes: number;
}

export interface ItineraryFileDoc {
  id: string;
  itineraryId: string;
  name: string;
  mimeType: AllowedFileMime;
  sizeBytes: number;
  dataUrl: string;
  linkedEmails: string[];
  uploadedByEmail: string;
  createdAt?: Timestamp;
}

export interface Itinerary {
  id: string;
  title: string;
  coverImageData: string;
  ownerUid: string;
  ownerEmail: string;
  linkedEmails: string[];
  calendarSyncEnabled: boolean;
  notifyOnChanges: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ItineraryEvent {
  id: string;
  itineraryId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  endTime: string; // HH:MM or ""
  location: string;
  links: EventLink[];
  attachments: EventAttachmentMeta[];
  status: EventStatus;
  googleCalendarEventId: string;
  lastCalendarSyncAt: string;
  linkedEmails: string[];
  createdByUid: string;
  createdByEmail: string;
  updatedByEmail: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ItineraryActivity {
  id: string;
  itineraryId: string;
  action: ActivityAction;
  summary: string;
  actorEmail: string;
  linkedEmails: string[];
  createdAt?: Timestamp;
}

export interface ItineraryFormInput {
  title: string;
  coverImageData: string;
  linkedEmails: string[];
  calendarSyncEnabled: boolean;
  notifyOnChanges: boolean;
}

export interface EventFormInput {
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  links: EventLink[];
  attachments: EventAttachmentMeta[];
  status: EventStatus;
}
