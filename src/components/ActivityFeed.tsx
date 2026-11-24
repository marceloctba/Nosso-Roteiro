import React from 'react';
import { CalendarCheck, Clock, Mail, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { ItineraryActivity } from '../types/itinerary';

interface ActivityFeedProps {
  activities: ItineraryActivity[];
}

function formatActivityTime(ts?: { toDate?: () => Date }): string {
  if (!ts?.toDate) return 'Agora';
  const dt = ts.toDate();
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  if (activities.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <Clock className="w-8 h-8 text-slate-300 mx-auto" />
        <h3 className="mt-3 text-sm font-semibold text-slate-900">Nenhuma alteração registrada</h3>
        <p className="mt-1 text-xs text-slate-500">
          As inclusões de datas, sincronizações com Google Agenda e avisos por Gmail aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h3 className="font-display text-base font-bold text-slate-900">Histórico do roteiro</h3>
      </div>
      <ul className="divide-y divide-slate-200">
        {activities.map((item) => {
          const Icon =
            item.action === 'created_event'
              ? Plus
              : item.action === 'updated_event'
                ? Pencil
                : item.action === 'deleted_event'
                  ? Trash2
                  : item.action === 'synced_calendar'
                    ? CalendarCheck
                    : item.action === 'sent_email'
                      ? Mail
                      : Users;

          return (
            <li key={item.id} className="px-5 py-3.5 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900 leading-snug">{item.summary}</p>
                <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                  {item.actorEmail} · {formatActivityTime(item.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
