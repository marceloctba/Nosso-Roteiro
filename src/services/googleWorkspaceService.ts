import { Itinerary, ItineraryEvent } from '../types/itinerary';
import { addMinutesToTime, formatDateShort, formatDateWithYear } from '../utils/formatters';

function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

function buildIsoOffsetDateTime(dateYYYYMMDD: string, timeHHMM: string): string {
  const [y, m, d] = dateYYYYMMDD.split('-').map(Number);
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const local = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  const offsetMin = -local.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const oh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const om = String(absMin % 60).padStart(2, '0');
  return `${dateYYYYMMDD}T${timeHHMM}:00${sign}${oh}:${om}`;
}

export interface CalendarSyncResult {
  calendarEventId: string;
  htmlLink?: string;
  updatedExisting: boolean;
}

export async function syncEventToGoogleCalendar(
  accessToken: string,
  itinerary: Itinerary,
  event: ItineraryEvent
): Promise<CalendarSyncResult> {
  if (!event.date || !event.time) {
    throw new Error('Defina uma data e um horário antes de sincronizar com o Google Agenda.');
  }
  const timeZone = getTimeZone();
  const startDateTime = buildIsoOffsetDateTime(event.date, event.time);
  const endTimeStr = event.endTime || addMinutesToTime(event.time, 90);
  const endDateTime = buildIsoOffsetDateTime(event.date, endTimeStr);

  const linkLines = (event.links || []).map((l) => `${l.label || 'Link'}: ${l.url}`);
  const descriptionLines = [
    `Roteiro: ${itinerary.title}`,
    ...linkLines,
    `Participantes: ${itinerary.linkedEmails.join(', ')}`,
    'Gerenciado por Nosso Roteiro',
  ].filter(Boolean);

  const body = {
    summary: `${itinerary.title} · ${event.title}`,
    location: event.location || undefined,
    description: descriptionLines.join('\n'),
    start: {
      dateTime: startDateTime,
      timeZone,
    },
    end: {
      dateTime: endDateTime,
      timeZone,
    },
    attendees: itinerary.linkedEmails.map((email) => ({ email })),
    guestsCanModify: true,
    guestsCanSeeOtherGuests: true,
    reminders: {
      useDefault: true,
    },
  };

  if (event.googleCalendarEventId) {
    const patchRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
        event.googleCalendarEventId
      )}?sendUpdates=all`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (patchRes.ok) {
      const data = (await patchRes.json()) as { id: string; htmlLink?: string };
      return {
        calendarEventId: data.id,
        htmlLink: data.htmlLink,
        updatedExisting: true,
      };
    }

    if (patchRes.status !== 404 && patchRes.status !== 403 && patchRes.status !== 410) {
      const errData = await patchRes.json().catch(() => ({}));
      throw new Error(
        (errData as { error?: { message?: string } })?.error?.message ||
          `Erro ao atualizar Google Agenda (${patchRes.status}).`
      );
    }
  }

  const createRes = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(
      (errData as { error?: { message?: string } })?.error?.message ||
        `Erro ao criar evento no Google Agenda (${createRes.status}).`
    );
  }

  const created = (await createRes.json()) as { id: string; htmlLink?: string };
  return {
    calendarEventId: created.id,
    htmlLink: created.htmlLink,
    updatedExisting: false,
  };
}

export async function removeEventFromGoogleCalendar(
  accessToken: string,
  googleCalendarEventId: string
): Promise<void> {
  if (!googleCalendarEventId) return;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      googleCalendarEventId
    )}?sendUpdates=all`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      (errData as { error?: { message?: string } })?.error?.message ||
        `Erro ao remover do Google Agenda (${res.status}).`
    );
  }
}

function encodeBase64UrlUtf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeMimeHeaderUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface SendNotificationParams {
  itinerary: Itinerary;
  recipients: string[];
  changeType: 'created' | 'updated' | 'digest';
  event?: ItineraryEvent;
  allEvents?: ItineraryEvent[];
  senderEmail: string;
}

export async function sendItineraryNotificationEmail(
  accessToken: string,
  params: SendNotificationParams
): Promise<void> {
  const { itinerary, recipients, changeType, event, allEvents, senderEmail } = params;
  if (recipients.length === 0) {
    throw new Error('Nenhum destinatário selecionado para o aviso por Gmail.');
  }

  let subject = `[Nosso Roteiro · ${itinerary.title}] Atualização do roteiro`;
  if (changeType === 'created' && event) {
    subject = `[Nosso Roteiro · ${itinerary.title}] Nova atividade: ${event.title}${
      event.date ? ` (${formatDateShort(event.date)})` : ''
    }`;
  } else if (changeType === 'updated' && event) {
    subject = `[Nosso Roteiro · ${itinerary.title}] Atividade alterada: ${event.title}${
      event.date ? ` (${formatDateShort(event.date)})` : ''
    }`;
  } else if (changeType === 'digest') {
    subject = `[Nosso Roteiro · ${itinerary.title}] Resumo atualizado do roteiro`;
  }

  const appUrl = window.location.origin;

  let bodyInnerHtml = '';
  if (event && (changeType === 'created' || changeType === 'updated')) {
    const label =
      changeType === 'created'
        ? 'Nova atividade incluída no roteiro'
        : 'Atividade atualizada no roteiro';
    const linksHtml = (event.links || [])
      .map(
        (l) =>
          `<p style="margin:4px 0 0;font-size:13px;"><a href="${escapeHtml(
            l.url
          )}" style="color:#E11D48;">${escapeHtml(l.label || l.url)}</a></p>`
      )
      .join('');

    const timeDisplay = event.time
      ? `${escapeHtml(event.time)}${event.endTime ? ` – ${escapeHtml(event.endTime)}` : ''}`
      : 'Em aberto';

    bodyInnerHtml = `
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#E11D48;">${escapeHtml(label)}</p>
      <div style="border:1px solid #E2E8F0;border-radius:12px;padding:16px;background:#F8FAFC;">
        <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#0F172A;">
          ${escapeHtml(formatDateShort(event.date))}: ${escapeHtml(event.title)}
        </p>
        <p style="margin:0 0 4px;font-size:14px;color:#334155;">
          <strong>Data:</strong> ${escapeHtml(formatDateWithYear(event.date))}
        </p>
        <p style="margin:0 0 4px;font-size:14px;color:#334155;">
          <strong>Horário:</strong> ${timeDisplay}
        </p>
        ${
          event.location
            ? `<p style="margin:0 0 4px;font-size:14px;color:#334155;"><strong>Local:</strong> ${escapeHtml(event.location)}</p>`
            : ''
        }
        ${linksHtml}
      </div>
    `;
  } else {
    const sorted = [...(allEvents || [])].sort((a, b) => {
      if (!a.date && b.date) return 1;
      if (a.date && !b.date) return -1;
      return `${a.date || '9999-99-99'}T${a.time || '99:99'}`.localeCompare(
        `${b.date || '9999-99-99'}T${b.time || '99:99'}`
      );
    });
    const itemsHtml = sorted
      .map(
        (ev) => `
        <li style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #E2E8F0;">
          <strong style="color:#0F172A;">${escapeHtml(formatDateShort(ev.date))}: ${escapeHtml(ev.title)}</strong><br/>
          <span style="font-size:13px;color:#475569;">Horário: ${escapeHtml(ev.time || 'Em aberto')}${
            ev.location ? ` · Local: ${escapeHtml(ev.location)}` : ''
          }</span>
        </li>`
      )
      .join('');

    bodyInnerHtml = `
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#E11D48;">Resumo completo do roteiro</p>
      <ul style="list-style:none;padding:0;margin:0;">${itemsHtml || '<li>Nenhuma atividade cadastrada ainda.</li>'}</ul>
    `;
  }

  const html = `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;color:#0F172A;">
      <p style="margin:0 0 4px;font-size:12px;color:#64748B;">Nosso Roteiro · Roteiro Compartilhado</p>
      <h1 style="margin:0 0 16px;font-size:22px;color:#0F172A;">${escapeHtml(itinerary.title)}</h1>
      ${bodyInnerHtml}
      <p style="margin:20px 0 0;font-size:12px;color:#64748B;">
        Atualizado por ${escapeHtml(senderEmail)} · Participantes: ${escapeHtml(itinerary.linkedEmails.join(', '))}
      </p>
      <p style="margin:14px 0 0;">
        <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#E11D48;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;">
          Abrir Nosso Roteiro
        </a>
      </p>
    </div>
  `.trim();

  const rawMessage = [
    `To: ${recipients.join(', ')}`,
    `Subject: ${encodeMimeHeaderUtf8(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
  ].join('\r\n');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodeBase64UrlUtf8(rawMessage),
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      (errData as { error?: { message?: string } })?.error?.message ||
        `Erro ao enviar aviso pelo Gmail (${res.status}).`
    );
  }
}
