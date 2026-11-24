import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { EventAttachmentMeta, Itinerary, ItineraryEvent } from '../types/itinerary';
import { formatFileSize } from '../utils/fileHelpers';
import { formatDateHeading, isEventCompleted, isEventPast } from '../utils/formatters';

interface AgendaTimelineProps {
  itinerary: Itinerary;
  events: ItineraryEvent[];
  onAddEvent: () => void;
  onEditEvent: (event: ItineraryEvent) => void;
  onToggleStatus: (event: ItineraryEvent) => void;
  onSyncCalendar: (event: ItineraryEvent) => void;
  onNotifyGmail: (event: ItineraryEvent) => void;
  onDeleteEvent: (event: ItineraryEvent) => void;
  onOpenAttachment: (attachment: EventAttachmentMeta) => void;
}

export const AgendaTimeline: React.FC<AgendaTimelineProps> = ({
  itinerary,
  events,
  onAddEvent,
  onEditEvent,
  onToggleStatus,
  onSyncCalendar,
  onNotifyGmail,
  onDeleteEvent,
  onOpenAttachment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'planejado' | 'concluido'>('todos');
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((ev) => {
      const normalizedStatus = isEventCompleted(ev, now) ? 'concluido' : 'planejado';
      if (statusFilter !== 'todos' && normalizedStatus !== statusFilter) return false;
      if (!q) return true;
      const inLinks = (ev.links || []).some(
        (l) => l.label.toLowerCase().includes(q) || l.url.toLowerCase().includes(q)
      );
      const inFiles = (ev.attachments || []).some((a) => a.name.toLowerCase().includes(q));
      return (
        ev.title.toLowerCase().includes(q) ||
        ev.location.toLowerCase().includes(q) ||
        inLinks ||
        inFiles
      );
    });
  }, [events, searchQuery, statusFilter, now]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, ItineraryEvent[]>();
    for (const ev of filteredEvents) {
      const existing = groups.get(ev.date) ?? [];
      existing.push(ev);
      groups.set(ev.date, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEvents]);

  return (
    <div className="space-y-5">
      {/* Toolbar: Search + Segmented Status Filter + Nova data */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar atividade, local, link ou arquivo..."
            className="w-full min-h-[42px] pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-900/20 focus:border-teal-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'planejado', label: 'Planejados' },
                { id: 'concluido', label: 'Concluídos' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onAddEvent}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-900 text-xs font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nova data</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {events.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center">
          <CalendarPlus className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="mt-4 font-display text-lg font-bold text-slate-900">
            Nenhuma data cadastrada em {itinerary.title}
          </h3>
          <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Adicione a primeira data com horário, local no mapa, links ou arquivos. Todos os
            participantes poderão acompanhar e editar juntos.
          </p>
          <button
            type="button"
            onClick={onAddEvent}
            className="mt-6 min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-900 text-sm font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nova data</span>
          </button>
        </div>
      ) : groupedByDate.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nenhum compromisso corresponde ao filtro atual.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('todos');
            }}
            className="mt-3 text-xs font-semibold text-teal-900 hover:underline cursor-pointer"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(([dateStr, dayEvents]) => {
            const heading = formatDateHeading(dateStr);
            return (
              <section key={dateStr} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-baseline justify-between gap-4">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono tabular-nums text-base font-bold text-teal-900">
                      {heading.dayMonth}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{heading.weekday}</span>
                    <span className="text-xs text-slate-500">{heading.monthLabel}</span>
                  </div>
                  <span className="font-mono tabular-nums text-xs text-slate-500">
                    {dayEvents.length} {dayEvents.length === 1 ? 'atividade' : 'atividades'}
                  </span>
                </div>

                <ul className="divide-y divide-slate-200">
                  {dayEvents.map((ev) => {
                    const past = isEventPast(ev, now);
                    const isDone = ev.status === 'concluido' || past;
                    const isSynced = Boolean(ev.googleCalendarEventId);
                    const mapsUrl = ev.location
                      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          ev.location
                        )}`
                      : null;

                    return (
                      <li key={ev.id} className="p-5 transition-colors hover:bg-slate-50/60">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => onToggleStatus(ev)}
                              title={
                                past
                                  ? 'Concluído automaticamente (data passada)'
                                  : isDone
                                    ? 'Marcar como planejado'
                                    : 'Marcar como concluído'
                              }
                              className="min-h-[44px] min-w-[44px] -ml-2 -mt-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-teal-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                              aria-label={
                                past
                                  ? 'Evento concluído pela data passada'
                                  : isDone
                                    ? 'Marcar como planejado'
                                    : 'Marcar como concluído'
                              }
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-5 h-5 text-teal-800" />
                              ) : (
                                <Circle className="w-5 h-5" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                                <span className="font-mono tabular-nums text-sm font-bold text-slate-900">
                                  {ev.time}
                                  {ev.endTime ? ` – ${ev.endTime}` : ''}
                                </span>
                                <h4
                                  className={`font-display text-base font-bold text-slate-900 ${
                                    isDone ? 'line-through text-slate-400' : ''
                                  }`}
                                >
                                  {ev.title}
                                </h4>
                              </div>

                              {ev.location && (
                                <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                                  <span className="truncate">{ev.location}</span>
                                  {mapsUrl && (
                                    <a
                                      href={mapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-900 hover:underline shrink-0"
                                    >
                                      <span>Mapa</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              )}

                              {ev.links && ev.links.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                  {ev.links.map((link, idx) => (
                                    <li key={`${link.url}-${idx}`} className="flex items-center gap-2 text-xs">
                                      <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-teal-900 hover:underline truncate inline-flex items-center gap-1"
                                      >
                                        <span className="truncate">{link.label || link.url}</span>
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              )}

                              {ev.attachments && ev.attachments.length > 0 && (
                                <ul className="mt-2.5 flex flex-wrap gap-2">
                                  {ev.attachments.map((att) => {
                                    const isPdf = att.mimeType === 'application/pdf';
                                    return (
                                      <li key={att.fileId}>
                                        <button
                                          type="button"
                                          onClick={() => onOpenAttachment(att)}
                                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                                        >
                                          {isPdf ? (
                                            <FileText className="w-3.5 h-3.5 text-teal-900 shrink-0" />
                                          ) : (
                                            <ImageIcon className="w-3.5 h-3.5 text-teal-900 shrink-0" />
                                          )}
                                          <span className="truncate max-w-[180px]">{att.name}</span>
                                          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                                            {formatFileSize(att.sizeBytes)}
                                          </span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}

                              <p className="mt-2.5 text-[11px] text-slate-400">
                                Atualizado por {ev.updatedByEmail}
                              </p>
                            </div>
                          </div>

                          {/* Action Controls */}
                          <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 pl-8 sm:pl-0">
                            <button
                              type="button"
                              onClick={() => onSyncCalendar(ev)}
                              className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                                isSynced
                                  ? 'border-teal-900/25 bg-teal-50/70 text-teal-950 hover:bg-teal-100/70'
                                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <CalendarCheck className="w-3.5 h-3.5" />
                              <span>{isSynced ? 'Atualizar Agenda' : 'Marcar na Agenda'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onNotifyGmail(ev)}
                              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Avisar Gmail</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onEditEvent(ev)}
                              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                              aria-label={`Editar ${ev.title}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteEvent(ev)}
                              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              aria-label={`Excluir ${ev.title}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
