import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  ActivityAction,
  ALLOWED_FILE_MIMES,
  AllowedFileMime,
  BLUEPRINT_LIMITS,
  EventAttachmentMeta,
  EventFormInput,
  EventLink,
  Itinerary,
  ItineraryActivity,
  ItineraryEvent,
  ItineraryFileDoc,
  ItineraryFormInput,
} from '../types/itinerary';
import { normalizeEmail, sanitizeHttpUrl } from '../utils/formatters';

function sanitizeString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function sanitizeEmailList(emails: string[], requiredEmail: string): string[] {
  const normalizedRequired = normalizeEmail(requiredEmail);
  const set = new Set<string>();
  if (normalizedRequired && BLUEPRINT_LIMITS.EMAIL_PATTERN.test(normalizedRequired)) {
    set.add(normalizedRequired.slice(0, BLUEPRINT_LIMITS.EMAIL_MAX));
  }
  for (const raw of emails) {
    const clean = normalizeEmail(raw).slice(0, BLUEPRINT_LIMITS.EMAIL_MAX);
    if (clean && BLUEPRINT_LIMITS.EMAIL_PATTERN.test(clean)) {
      set.add(clean);
    }
    if (set.size >= BLUEPRINT_LIMITS.LINKED_EMAILS_MAX) break;
  }
  return Array.from(set);
}

function sanitizeLinks(links: EventLink[]): EventLink[] {
  const result: EventLink[] = [];
  for (const item of links) {
    const cleanUrl = sanitizeHttpUrl(item.url);
    if (!cleanUrl || cleanUrl.length > BLUEPRINT_LIMITS.LINK_URL_MAX) continue;
    const label = sanitizeString(item.label || '', BLUEPRINT_LIMITS.LINK_LABEL_MAX);
    result.push({ label, url: cleanUrl });
    if (result.length >= BLUEPRINT_LIMITS.LINKS_MAX) break;
  }
  return result;
}

function sanitizeAttachments(attachments: EventAttachmentMeta[]): EventAttachmentMeta[] {
  const result: EventAttachmentMeta[] = [];
  for (const item of attachments) {
    if (!item.fileId || !/^[a-zA-Z0-9_-]{1,128}$/.test(item.fileId)) continue;
    if (!ALLOWED_FILE_MIMES.includes(item.mimeType)) continue;
    result.push({
      fileId: item.fileId,
      name: sanitizeString(item.name || 'arquivo', BLUEPRINT_LIMITS.FILE_NAME_MAX),
      mimeType: item.mimeType,
      sizeBytes: Math.max(1, Math.min(BLUEPRINT_LIMITS.FILE_BYTES_MAX, Math.round(item.sizeBytes))),
    });
    if (result.length >= BLUEPRINT_LIMITS.ATTACHMENTS_MAX) break;
  }
  return result;
}

export async function upsertUserProfile(user: User): Promise<void> {
  if (!user.email) return;
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const displayName = sanitizeString(
    user.displayName || user.email.split('@')[0] || 'Viajante',
    BLUEPRINT_LIMITS.TITLE_MAX
  );
  const photoURL = user.photoURL ? user.photoURL.slice(0, 500) : '';

  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: normalizeEmail(user.email),
        displayName,
        ...(photoURL ? { photoURL } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName,
        ...(photoURL ? { photoURL } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeItineraries(
  userEmail: string,
  onData: (items: Itinerary[]) => void,
  onError: (err: Error) => void
): () => void {
  const emailLower = normalizeEmail(userEmail);
  const path = 'itineraries';
  const q = query(
    collection(db, 'itineraries'),
    where('linkedEmails', 'array-contains', emailLower)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Itinerary[] = snapshot.docs.map((d) => {
        const raw = d.data() as Partial<Itinerary>;
        return {
          id: d.id,
          title: raw.title || '',
          coverImageData: raw.coverImageData || '',
          ownerUid: raw.ownerUid || '',
          ownerEmail: raw.ownerEmail || '',
          linkedEmails: raw.linkedEmails || [],
          calendarSyncEnabled: Boolean(raw.calendarSyncEnabled),
          notifyOnChanges: Boolean(raw.notifyOnChanges),
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt,
        };
      });
      list.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeEvents(
  itineraryId: string,
  userEmail: string,
  onData: (items: ItineraryEvent[]) => void,
  onError: (err: Error) => void
): () => void {
  const emailLower = normalizeEmail(userEmail);
  const path = `itineraries/${itineraryId}/events`;
  const q = query(
    collection(db, 'itineraries', itineraryId, 'events'),
    where('linkedEmails', 'array-contains', emailLower)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ItineraryEvent[] = snapshot.docs.map((d) => {
        const raw = d.data() as Partial<ItineraryEvent>;
        return {
          id: d.id,
          itineraryId: raw.itineraryId || itineraryId,
          title: raw.title || '',
          date: raw.date || '',
          time: raw.time || '',
          endTime: raw.endTime || '',
          location: raw.location || '',
          links: Array.isArray(raw.links) ? raw.links : [],
          attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
          status: raw.status === 'concluido' ? 'concluido' : 'planejado',
          googleCalendarEventId: raw.googleCalendarEventId || '',
          lastCalendarSyncAt: raw.lastCalendarSyncAt || '',
          linkedEmails: raw.linkedEmails || [],
          createdByUid: raw.createdByUid || '',
          createdByEmail: raw.createdByEmail || '',
          updatedByEmail: raw.updatedByEmail || '',
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt,
        };
      });
      list.sort((a, b) => {
        if (!a.date && b.date) return 1;
        if (a.date && !b.date) return -1;
        const da = `${a.date || '9999-99-99'}T${a.time || '99:99'}`;
        const dbKey = `${b.date || '9999-99-99'}T${b.time || '99:99'}`;
        return da.localeCompare(dbKey) || a.title.localeCompare(b.title);
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeTodayEventCounts(
  itineraryIds: string[],
  userEmail: string,
  todayYmd: string,
  onData: (counts: Record<string, number>) => void
): () => void {
  const emailLower = normalizeEmail(userEmail);
  if (itineraryIds.length === 0 || !emailLower) {
    onData({});
    return () => {};
  }

  const countsMap: Record<string, number> = {};
  const unsubs = itineraryIds.map((itineraryId) => {
    const q = query(
      collection(db, 'itineraries', itineraryId, 'events'),
      where('linkedEmails', 'array-contains', emailLower)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        let count = 0;
        snapshot.docs.forEach((d) => {
          const data = d.data() as { date?: string };
          if (data.date === todayYmd) {
            count++;
          }
        });
        countsMap[itineraryId] = count;
        onData({ ...countsMap });
      },
      (err) => {
        console.warn(`Today events count listener error for ${itineraryId}:`, err);
      }
    );
  });

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
}

export function subscribeActivities(
  itineraryId: string,
  userEmail: string,
  onData: (items: ItineraryActivity[]) => void,
  onError: (err: Error) => void
): () => void {
  const emailLower = normalizeEmail(userEmail);
  const path = `itineraries/${itineraryId}/activity`;
  const q = query(
    collection(db, 'itineraries', itineraryId, 'activity'),
    where('linkedEmails', 'array-contains', emailLower),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ItineraryActivity[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ItineraryActivity, 'id'>),
      }));
      onData(list.slice(0, 40));
    },
    (error) => {
      if (error instanceof Error && error.message.toLowerCase().includes('index')) {
        const fallbackQ = query(
          collection(db, 'itineraries', itineraryId, 'activity'),
          where('linkedEmails', 'array-contains', emailLower)
        );
        return onSnapshot(
          fallbackQ,
          (snap) => {
            const list: ItineraryActivity[] = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<ItineraryActivity, 'id'>),
            }));
            list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            onData(list.slice(0, 40));
          },
          (fallbackErr) => {
            try {
              handleFirestoreError(fallbackErr, OperationType.LIST, path);
            } catch (wrapped) {
              onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
            }
          }
        );
      }
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createItinerary(input: ItineraryFormInput, user: User): Promise<string> {
  if (!user.email) throw new Error('Conta Gmail não identificada.');
  const ownerEmail = normalizeEmail(user.email);
  const title = sanitizeString(input.title, BLUEPRINT_LIMITS.TITLE_MAX);
  if (!title) throw new Error('Informe um título para o roteiro.');

  const coverImageData =
    input.coverImageData.length <= BLUEPRINT_LIMITS.COVER_DATAURL_MAX
      ? input.coverImageData
      : '';
  const linkedEmails = sanitizeEmailList(input.linkedEmails, ownerEmail);

  const itineraryRef = doc(collection(db, 'itineraries'));
  const path = `itineraries/${itineraryRef.id}`;

  try {
    await setDoc(itineraryRef, {
      title,
      coverImageData,
      ownerUid: user.uid,
      ownerEmail,
      linkedEmails,
      calendarSyncEnabled: Boolean(input.calendarSyncEnabled),
      notifyOnChanges: Boolean(input.notifyOnChanges),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return itineraryRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateItineraryDetails(
  itineraryId: string,
  patch: {
    title: string;
    coverImageData: string;
    calendarSyncEnabled: boolean;
    notifyOnChanges: boolean;
  }
): Promise<void> {
  const path = `itineraries/${itineraryId}`;
  const title = sanitizeString(patch.title, BLUEPRINT_LIMITS.TITLE_MAX);
  if (!title) throw new Error('O título do roteiro não pode ficar vazio.');
  if (patch.coverImageData.length > BLUEPRINT_LIMITS.COVER_DATAURL_MAX) {
    throw new Error('A imagem de capa excede o tamanho máximo permitido.');
  }

  try {
    await updateDoc(doc(db, 'itineraries', itineraryId), {
      title,
      coverImageData: patch.coverImageData,
      calendarSyncEnabled: Boolean(patch.calendarSyncEnabled),
      notifyOnChanges: Boolean(patch.notifyOnChanges),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateItineraryLinkedEmails(
  itinerary: Itinerary,
  requestedEmails: string[],
  actorEmail: string
): Promise<string[]> {
  const cleanEmails = sanitizeEmailList(requestedEmails, itinerary.ownerEmail);
  const cleanActor = normalizeEmail(actorEmail);
  const path = `itineraries/${itinerary.id}`;

  try {
    const [eventsSnap, filesSnap, activitySnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'itineraries', itinerary.id, 'events'),
          where('linkedEmails', 'array-contains', cleanActor)
        )
      ),
      getDocs(
        query(
          collection(db, 'itineraries', itinerary.id, 'files'),
          where('linkedEmails', 'array-contains', cleanActor)
        )
      ),
      getDocs(
        query(
          collection(db, 'itineraries', itinerary.id, 'activity'),
          where('linkedEmails', 'array-contains', cleanActor)
        )
      ),
    ]);

    const batch = writeBatch(db);
    batch.update(doc(db, 'itineraries', itinerary.id), {
      linkedEmails: cleanEmails,
      updatedAt: serverTimestamp(),
    });

    eventsSnap.docs.forEach((evDoc) => {
      batch.update(evDoc.ref, {
        linkedEmails: cleanEmails,
        updatedAt: serverTimestamp(),
      });
    });

    filesSnap.docs.forEach((fileDoc) => {
      batch.update(fileDoc.ref, {
        linkedEmails: cleanEmails,
      });
    });

    activitySnap.docs.forEach((actDoc) => {
      batch.update(actDoc.ref, {
        linkedEmails: cleanEmails,
      });
    });

    await batch.commit();

    const actRef = doc(collection(db, 'itineraries', itinerary.id, 'activity'));
    await setDoc(actRef, {
      itineraryId: itinerary.id,
      action: 'updated_members' as ActivityAction,
      summary: sanitizeString(
        `Participantes atualizados (${cleanEmails.length} participante${
          cleanEmails.length > 1 ? 's' : ''
        }).`,
        BLUEPRINT_LIMITS.SUMMARY_MAX
      ),
      actorEmail: cleanActor,
      linkedEmails: cleanEmails,
      createdAt: serverTimestamp(),
    });

    return cleanEmails;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteItinerary(itineraryId: string, actorEmail: string): Promise<void> {
  const path = `itineraries/${itineraryId}`;
  const cleanActor = normalizeEmail(actorEmail);

  try {
    const [eventsSnap, filesSnap, activitySnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'itineraries', itineraryId, 'events'),
          where('linkedEmails', 'array-contains', cleanActor)
        )
      ),
      getDocs(
        query(
          collection(db, 'itineraries', itineraryId, 'files'),
          where('linkedEmails', 'array-contains', cleanActor)
        )
      ),
      getDocs(
        query(
          collection(db, 'itineraries', itineraryId, 'activity'),
          where('linkedEmails', 'array-contains', cleanActor)
        )
      ),
    ]);

    const batch = writeBatch(db);
    eventsSnap.docs.forEach((d) => batch.delete(d.ref));
    filesSnap.docs.forEach((d) => batch.delete(d.ref));
    activitySnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'itineraries', itineraryId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function uploadItineraryFile(
  itinerary: Itinerary,
  fileData: {
    name: string;
    mimeType: AllowedFileMime;
    sizeBytes: number;
    dataUrl: string;
  },
  user: User
): Promise<EventAttachmentMeta> {
  if (!user.email) throw new Error('Conta Gmail não identificada.');
  const uploadedByEmail = normalizeEmail(user.email);
  const fileRef = doc(collection(db, 'itineraries', itinerary.id, 'files'));
  const path = `itineraries/${itinerary.id}/files/${fileRef.id}`;

  const cleanName = sanitizeString(fileData.name, BLUEPRINT_LIMITS.FILE_NAME_MAX) || 'arquivo';
  const sizeBytes = Math.max(1, Math.min(BLUEPRINT_LIMITS.FILE_BYTES_MAX, fileData.sizeBytes));

  try {
    await setDoc(fileRef, {
      itineraryId: itinerary.id,
      name: cleanName,
      mimeType: fileData.mimeType,
      sizeBytes,
      dataUrl: fileData.dataUrl,
      linkedEmails: itinerary.linkedEmails,
      uploadedByEmail,
      createdAt: serverTimestamp(),
    });
    return {
      fileId: fileRef.id,
      name: cleanName,
      mimeType: fileData.mimeType,
      sizeBytes,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getItineraryFile(
  itineraryId: string,
  fileId: string
): Promise<ItineraryFileDoc | null> {
  const path = `itineraries/${itineraryId}/files/${fileId}`;
  try {
    const snap = await getDoc(doc(db, 'itineraries', itineraryId, 'files', fileId));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...(snap.data() as Omit<ItineraryFileDoc, 'id'>),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function deleteItineraryFile(itineraryId: string, fileId: string): Promise<void> {
  const path = `itineraries/${itineraryId}/files/${fileId}`;
  try {
    await deleteDoc(doc(db, 'itineraries', itineraryId, 'files', fileId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function validateEventInput(input: EventFormInput) {
  const title = sanitizeString(input.title, BLUEPRINT_LIMITS.EVENT_TITLE_MAX);
  if (!title) throw new Error('Informe o nome da atividade.');
  const date = input.date.trim();
  if (date && !BLUEPRINT_LIMITS.DATE_PATTERN.test(date)) {
    throw new Error('Data inválida. Use o formato AAAA-MM-DD.');
  }
  const time = input.time.trim();
  if (time && !BLUEPRINT_LIMITS.TIME_PATTERN.test(time)) {
    throw new Error('Horário inválido. Use o formato HH:MM.');
  }
  const endTime = time ? input.endTime.trim() : '';
  if (endTime && !BLUEPRINT_LIMITS.TIME_PATTERN.test(endTime)) {
    throw new Error('Horário de término inválido.');
  }
  return {
    title,
    date,
    time,
    endTime,
    location: sanitizeString(input.location, BLUEPRINT_LIMITS.LOCATION_MAX),
    links: sanitizeLinks(input.links),
    attachments: sanitizeAttachments(input.attachments),
    status: input.status === 'concluido' ? ('concluido' as const) : ('planejado' as const),
  };
}

function formatEventWhenSummary(date: string, time: string): string {
  if (date && time) {
    return `em ${date.split('-').reverse().slice(0, 2).join('/')} às ${time}`;
  }
  if (date) {
    return `em ${date.split('-').reverse().slice(0, 2).join('/')} (horário em aberto)`;
  }
  if (time) {
    return `às ${time} (data em aberto)`;
  }
  return '(data e horário em aberto)';
}

export async function createItineraryEvent(
  itinerary: Itinerary,
  input: EventFormInput,
  user: User
): Promise<ItineraryEvent> {
  if (!user.email) throw new Error('Conta Gmail não identificada.');
  const actorEmail = normalizeEmail(user.email);
  const clean = validateEventInput(input);
  const evRef = doc(collection(db, 'itineraries', itinerary.id, 'events'));
  const actRef = doc(collection(db, 'itineraries', itinerary.id, 'activity'));
  const path = `itineraries/${itinerary.id}/events/${evRef.id}`;

  const payload = {
    itineraryId: itinerary.id,
    ...clean,
    googleCalendarEventId: '',
    lastCalendarSyncAt: '',
    linkedEmails: itinerary.linkedEmails,
    createdByUid: user.uid,
    createdByEmail: actorEmail,
    updatedByEmail: actorEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(evRef, payload);
    batch.set(actRef, {
      itineraryId: itinerary.id,
      action: 'created_event' as ActivityAction,
      summary: sanitizeString(
        `Adicionou "${clean.title}" ${formatEventWhenSummary(clean.date, clean.time)}.`,
        BLUEPRINT_LIMITS.SUMMARY_MAX
      ),
      actorEmail,
      linkedEmails: itinerary.linkedEmails,
      createdAt: serverTimestamp(),
    });
    await batch.commit();

    return {
      id: evRef.id,
      itineraryId: itinerary.id,
      ...clean,
      googleCalendarEventId: '',
      lastCalendarSyncAt: '',
      linkedEmails: itinerary.linkedEmails,
      createdByUid: user.uid,
      createdByEmail: actorEmail,
      updatedByEmail: actorEmail,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateItineraryEvent(
  itinerary: Itinerary,
  eventId: string,
  input: EventFormInput,
  user: User
): Promise<void> {
  if (!user.email) throw new Error('Conta Gmail não identificada.');
  const actorEmail = normalizeEmail(user.email);
  const clean = validateEventInput(input);
  const evRef = doc(db, 'itineraries', itinerary.id, 'events', eventId);
  const actRef = doc(collection(db, 'itineraries', itinerary.id, 'activity'));
  const path = `itineraries/${itinerary.id}/events/${eventId}`;

  try {
    const batch = writeBatch(db);
    batch.update(evRef, {
      ...clean,
      updatedByEmail: actorEmail,
      updatedAt: serverTimestamp(),
    });
    batch.set(actRef, {
      itineraryId: itinerary.id,
      action: 'updated_event' as ActivityAction,
      summary: sanitizeString(
        `Alterou "${clean.title}" (${
          clean.date ? clean.date.split('-').reverse().slice(0, 2).join('/') : 'Data em aberto'
        } · ${clean.time || 'Horário em aberto'}).`,
        BLUEPRINT_LIMITS.SUMMARY_MAX
      ),
      actorEmail,
      linkedEmails: itinerary.linkedEmails,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markEventCalendarSynced(
  itinerary: Itinerary,
  eventId: string,
  eventTitle: string,
  googleCalendarEventId: string,
  user: User
): Promise<void> {
  if (!user.email) throw new Error('Conta Gmail não identificada.');
  const actorEmail = normalizeEmail(user.email);
  const evRef = doc(db, 'itineraries', itinerary.id, 'events', eventId);
  const actRef = doc(collection(db, 'itineraries', itinerary.id, 'activity'));
  const path = `itineraries/${itinerary.id}/events/${eventId}`;
  const nowIso = new Date().toISOString().slice(0, 40);

  try {
    const batch = writeBatch(db);
    batch.update(evRef, {
      googleCalendarEventId: googleCalendarEventId.slice(0, 256),
      lastCalendarSyncAt: nowIso,
      updatedByEmail: actorEmail,
      updatedAt: serverTimestamp(),
    });
    batch.set(actRef, {
      itineraryId: itinerary.id,
      action: 'synced_calendar' as ActivityAction,
      summary: sanitizeString(
        `Sincronizou "${eventTitle}" com o Google Agenda.`,
        BLUEPRINT_LIMITS.SUMMARY_MAX
      ),
      actorEmail,
      linkedEmails: itinerary.linkedEmails,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteItineraryEvent(
  itinerary: Itinerary,
  event: ItineraryEvent,
  user: User
): Promise<void> {
  if (!user.email) throw new Error('Conta Gmail não identificada.');
  const actorEmail = normalizeEmail(user.email);
  const evRef = doc(db, 'itineraries', itinerary.id, 'events', event.id);
  const actRef = doc(collection(db, 'itineraries', itinerary.id, 'activity'));
  const path = `itineraries/${itinerary.id}/events/${event.id}`;

  try {
    const batch = writeBatch(db);
    for (const att of event.attachments || []) {
      if (att.fileId) {
        batch.delete(doc(db, 'itineraries', itinerary.id, 'files', att.fileId));
      }
    }
    batch.delete(evRef);
    batch.set(actRef, {
      itineraryId: itinerary.id,
      action: 'deleted_event' as ActivityAction,
      summary: sanitizeString(`Removeu "${event.title}" da agenda.`, BLUEPRINT_LIMITS.SUMMARY_MAX),
      actorEmail,
      linkedEmails: itinerary.linkedEmails,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function logEmailSent(
  itinerary: Itinerary,
  summary: string,
  user: User
): Promise<void> {
  if (!user.email) return;
  const actorEmail = normalizeEmail(user.email);
  const actRef = doc(collection(db, 'itineraries', itinerary.id, 'activity'));
  const path = `itineraries/${itinerary.id}/activity/${actRef.id}`;

  try {
    await setDoc(actRef, {
      itineraryId: itinerary.id,
      action: 'sent_email' as ActivityAction,
      summary: sanitizeString(summary, BLUEPRINT_LIMITS.SUMMARY_MAX),
      actorEmail,
      linkedEmails: itinerary.linkedEmails,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
