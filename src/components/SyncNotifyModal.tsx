import React, { useEffect, useState } from 'react';
import { CalendarCheck, Mail, X } from 'lucide-react';
import { Itinerary, ItineraryEvent } from '../types/itinerary';
import { formatDateShort } from '../utils/formatters';

interface SyncNotifyModalProps {
  open: boolean;
  changeType: 'created' | 'updated';
  itinerary: Itinerary;
  event: ItineraryEvent | null;
  currentUserEmail: string;
  hasWorkspaceAuth: boolean;
  isProcessing: boolean;
  onConfirm: (options: { syncCalendar: boolean; sendGmail: boolean }) => Promise<void>;
  onClose: () => void;
}

export const SyncNotifyModal: React.FC<SyncNotifyModalProps> = ({
  open,
  changeType,
  itinerary,
  event,
  currentUserEmail,
  hasWorkspaceAuth,
  isProcessing,
  onConfirm,
  onClose,
}) => {
  const [syncCalendar, setSyncCalendar] = useState(true);
  const [sendGmail, setSendGmail] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSyncCalendar(itinerary.calendarSyncEnabled);
    setSendGmail(itinerary.notifyOnChanges);
  }, [open, itinerary.calendarSyncEnabled, itinerary.notifyOnChanges]);

  if (!open || !event) return null;

  const otherRecipients = itinerary.linkedEmails.filter(
    (e) => e !== currentUserEmail.toLowerCase()
  );
  const emailRecipients = otherRecipients.length > 0 ? otherRecipients : itinerary.linkedEmails;

  const isUpdate = changeType === 'updated';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-notify-title"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl p-6 pb-safe">
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-teal-900">
              {isUpdate ? 'Compromisso atualizado' : 'Compromisso salvo no roteiro'}
            </p>
            <h3 id="sync-notify-title" className="mt-1 font-display text-lg font-bold text-slate-900">
              {formatDateShort(event.date)} · {event.title}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
              Horário: {event.time}
              {event.location ? ` · Local: ${event.location}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="min-h-[44px] min-w-[44px] -mt-2 -mr-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer hover:border-slate-300 transition-colors">
            <input
              type="checkbox"
              checked={syncCalendar}
              onChange={(e) => setSyncCalendar(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-900 focus:ring-teal-900"
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-teal-900" />
                <span>
                  {event.googleCalendarEventId
                    ? 'Atualizar evento no Google Agenda'
                    : 'Marcar evento no Google Agenda'}
                </span>
              </span>
              <span className="mt-1 block text-xs text-slate-600">
                Cria ou atualiza na agenda principal convidando {itinerary.linkedEmails.length}{' '}
                conta(s).
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer hover:border-slate-300 transition-colors">
            <input
              type="checkbox"
              checked={sendGmail}
              onChange={(e) => setSendGmail(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-900 focus:ring-teal-900"
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-teal-900" />
                <span>Avisar participantes via Gmail</span>
              </span>
              <span className="mt-1 block text-xs text-slate-600 truncate">
                Para: {emailRecipients.join(', ')}
              </span>
            </div>
          </label>
        </div>

        {!hasWorkspaceAuth && (syncCalendar || sendGmail) && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
            Ao confirmar, será solicitada sua autorização no Google para acessar o Google Agenda e o
            Gmail nesta sessão.
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Agora não
          </button>
          <button
            type="button"
            disabled={isProcessing || (!syncCalendar && !sendGmail)}
            onClick={() => void onConfirm({ syncCalendar, sendGmail })}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-900 text-sm font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? 'Executando...' : 'Confirmar ações'}
          </button>
        </div>
      </div>
    </div>
  );
};
