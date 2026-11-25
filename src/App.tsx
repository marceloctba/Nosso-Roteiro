import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Calendar,
  CalendarCheck,
  History,
  LogOut,
  Mail,
  Pencil,
  Plus,
  Settings2,
  Smartphone,
  Trash2,
  Users,
} from 'lucide-react';
import { ActivityFeed } from './components/ActivityFeed';
import { AgendaTimeline } from './components/AgendaTimeline';
import { ConfirmDialog, ConfirmDialogTone } from './components/ConfirmDialog';
import { EventModal } from './components/EventModal';
import { FilePreviewModal } from './components/FilePreviewModal';
import { ItineraryModal } from './components/ItineraryModal';
import { MembersPanel } from './components/MembersPanel';
import { MinimalGeometricCover } from './components/MinimalGeometricCover';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SignInScreen } from './components/SignInScreen';
import { SyncNotifyModal } from './components/SyncNotifyModal';
import {
  connectWorkspaceApis,
  getWorkspaceAccessToken,
  getWorkspaceConnectedEmail,
  hasWorkspaceToken,
  signInWithGoogle,
  signOutUser,
  subscribeAuthState,
  subscribeWorkspaceToken,
} from './lib/firebase';
import {
  removeEventFromGoogleCalendar,
  sendItineraryNotificationEmail,
  syncEventToGoogleCalendar,
} from './services/googleWorkspaceService';
import {
  createItinerary,
  createItineraryEvent,
  deleteItinerary,
  deleteItineraryEvent,
  getItineraryFile,
  logEmailSent,
  markEventCalendarSynced,
  subscribeActivities,
  subscribeEvents,
  subscribeItineraries,
  subscribeTodayEventCounts,
  updateItineraryDetails,
  updateItineraryEvent,
  updateItineraryLinkedEmails,
  upsertUserProfile,
} from './services/itineraryService';
import {
  EventAttachmentMeta,
  EventFormInput,
  Itinerary,
  ItineraryActivity,
  ItineraryEvent,
  ItineraryFileDoc,
  ItineraryFormInput,
} from './types/itinerary';
import { formatDateShort, getTodayLocalYmd, isEventPast } from './utils/formatters';

type WorkspaceTab = 'agenda' | 'grupo' | 'historico' | 'integracoes';
type MobileTab = 'roteiros' | 'agenda' | 'grupo' | 'conta';

interface PendingConfirm {
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  tone?: ConfirmDialogTone;
  iconType?: 'calendar' | 'gmail' | 'delete' | 'alert';
  action: () => Promise<void>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [workspaceReady, setWorkspaceReady] = useState<boolean>(hasWorkspaceToken());
  const [workspaceConnecting, setWorkspaceConnecting] = useState(false);

  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [itinerariesLoading, setItinerariesLoading] = useState(true);
  const [selectedItineraryId, setSelectedItineraryId] = useState<string | null>(null);

  const [events, setEvents] = useState<ItineraryEvent[]>([]);
  const [activities, setActivities] = useState<ItineraryActivity[]>([]);
  const [todayYmd, setTodayYmd] = useState<string>(() => getTodayLocalYmd());
  const [todayEventCounts, setTodayEventCounts] = useState<Record<string, number>>({});

  const [desktopTab, setDesktopTab] = useState<WorkspaceTab>('agenda');
  const [mobileTab, setMobileTab] = useState<MobileTab>('roteiros');

  const [itineraryModalOpen, setItineraryModalOpen] = useState(false);
  const [itineraryModalMode, setItineraryModalMode] = useState<'create' | 'edit'>('create');
  const [isSavingItinerary, setIsSavingItinerary] = useState(false);

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalMode, setEventModalMode] = useState<'create' | 'edit'>('create');
  const [editingEvent, setEditingEvent] = useState<ItineraryEvent | null>(null);
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  const [previewFile, setPreviewFile] = useState<ItineraryFileDoc | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [syncPromptState, setSyncPromptState] = useState<{
    open: boolean;
    changeType: 'created' | 'updated';
    event: ItineraryEvent | null;
  }>({ open: false, changeType: 'created', event: null });
  const [isSyncPromptProcessing, setIsSyncPromptProcessing] = useState(false);

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  const [isUpdatingMembers, setIsUpdatingMembers] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const unsubAuth = subscribeAuthState((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        void upsertUserProfile(nextUser).catch((err) => {
          console.error('Failed to upsert user profile:', err);
        });
      } else {
        setItineraries([]);
        setEvents([]);
        setActivities([]);
        setTodayEventCounts({});
        setSelectedItineraryId(null);
        setMobileTab('roteiros');
      }
    });

    const unsubToken = subscribeWorkspaceToken(() => {
      setWorkspaceReady(hasWorkspaceToken());
    });

    const syncToday = () => {
      const next = getTodayLocalYmd();
      setTodayYmd((prev) => (prev === next ? prev : next));
    };
    window.addEventListener('focus', syncToday);
    document.addEventListener('visibilitychange', syncToday);

    return () => {
      unsubAuth();
      unsubToken();
      window.removeEventListener('focus', syncToday);
      document.removeEventListener('visibilitychange', syncToday);
    };
  }, []);

  useEffect(() => {
    if (!authReady || !user?.email) {
      setItinerariesLoading(false);
      return;
    }

    setItinerariesLoading(true);
    const unsub = subscribeItineraries(
      user.email,
      (items) => {
        setItineraries(items);
        setItinerariesLoading(false);
        setSelectedItineraryId((prev) => {
          if (prev && items.some((i) => i.id === prev)) return prev;
          return items[0]?.id ?? null;
        });
      },
      (err) => {
        setItinerariesLoading(false);
        showToast('error', 'Não foi possível carregar seus roteiros compartilhados.');
        console.error(err);
      }
    );

    return () => unsub();
  }, [authReady, user?.email, showToast]);

  const activeItinerary = useMemo(
    () => itineraries.find((i) => i.id === selectedItineraryId) ?? null,
    [itineraries, selectedItineraryId]
  );

  useEffect(() => {
    if (!authReady || !user?.email || !activeItinerary?.id) {
      setEvents([]);
      setActivities([]);
      return;
    }

    const unsubEvents = subscribeEvents(
      activeItinerary.id,
      user.email,
      (items) => setEvents(items),
      (err) => console.error('Events subscription error:', err)
    );

    const unsubActivity = subscribeActivities(
      activeItinerary.id,
      user.email,
      (items) => setActivities(items),
      (err) => console.error('Activity subscription error:', err)
    );

    return () => {
      unsubEvents();
      unsubActivity();
    };
  }, [authReady, user?.email, activeItinerary?.id]);

  const itineraryIdsKey = useMemo(
    () => itineraries.map((it) => it.id).sort().join(','),
    [itineraries]
  );

  useEffect(() => {
    if (!authReady || !user?.email || !itineraryIdsKey) {
      setTodayEventCounts({});
      return;
    }
    const ids = itineraryIdsKey.split(',').filter(Boolean);
    const unsub = subscribeTodayEventCounts(ids, user.email, todayYmd, setTodayEventCounts);
    return () => unsub();
  }, [authReady, user?.email, itineraryIdsKey, todayYmd]);

  const ensureWorkspaceToken = useCallback(async (): Promise<string> => {
    const existing = getWorkspaceAccessToken();
    if (existing) return existing;
    return connectWorkspaceApis(user?.email ?? null);
  }, [user?.email]);

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao entrar com Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Não foi possível concluir o login com Google. Tente novamente.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConnectWorkspace = async () => {
    setWorkspaceConnecting(true);
    try {
      await connectWorkspaceApis(user?.email ?? null);
      showToast('success', 'Google Agenda e Gmail conectados para esta sessão.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        showToast('error', 'Não foi possível conectar ao Google Agenda e Gmail.');
      }
    } finally {
      setWorkspaceConnecting(false);
    }
  };

  const handleSaveItinerary = async (input: ItineraryFormInput) => {
    if (!user) return;
    setIsSavingItinerary(true);
    try {
      if (itineraryModalMode === 'create') {
        const newId = await createItinerary(input, user);
        setSelectedItineraryId(newId);
        setDesktopTab('agenda');
        setMobileTab('agenda');
        showToast('success', `Roteiro "${input.title}" criado com sucesso.`);
      } else if (activeItinerary) {
        await updateItineraryDetails(activeItinerary.id, {
          title: input.title,
          coverImageData: input.coverImageData,
          calendarSyncEnabled: input.calendarSyncEnabled,
          notifyOnChanges: input.notifyOnChanges,
        });
        showToast('success', 'Roteiro atualizado.');
      }
      setItineraryModalOpen(false);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar roteiro.');
    } finally {
      setIsSavingItinerary(false);
    }
  };

  const handleSaveEvent = async (input: EventFormInput) => {
    if (!user || !activeItinerary) return;
    setIsSavingEvent(true);
    try {
      if (eventModalMode === 'create') {
        const created = await createItineraryEvent(activeItinerary, input, user);
        setEventModalOpen(false);
        showToast('success', `Atividade "${input.title}" adicionada ao roteiro.`);
        if (activeItinerary.calendarSyncEnabled || activeItinerary.notifyOnChanges) {
          setSyncPromptState({ open: true, changeType: 'created', event: created });
        }
      } else if (editingEvent) {
        await updateItineraryEvent(activeItinerary, editingEvent.id, input, user);
        const updatedSnapshot: ItineraryEvent = {
          ...editingEvent,
          ...input,
        };
        setEventModalOpen(false);
        setEditingEvent(null);
        showToast('success', `Atividade "${input.title}" atualizada.`);
        if (activeItinerary.calendarSyncEnabled || activeItinerary.notifyOnChanges) {
          setSyncPromptState({ open: true, changeType: 'updated', event: updatedSnapshot });
        }
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar atividade.');
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleToggleEventStatus = async (ev: ItineraryEvent) => {
    if (!user || !activeItinerary) return;
    if (isEventPast(ev)) {
      showToast('success', 'Esta atividade já passou e é marcada como concluída automaticamente.');
      return;
    }
    const nextStatus = ev.status === 'concluido' ? 'planejado' : 'concluido';
    try {
      await updateItineraryEvent(
        activeItinerary,
        ev.id,
        {
          title: ev.title,
          date: ev.date,
          time: ev.time,
          endTime: ev.endTime,
          location: ev.location,
          links: ev.links || [],
          attachments: ev.attachments || [],
          status: nextStatus,
        },
        user
      );
    } catch {
      showToast('error', 'Não foi possível alterar o status da atividade.');
    }
  };

  const handleOpenAttachment = async (att: EventAttachmentMeta) => {
    if (!activeItinerary) return;
    setIsPreviewLoading(true);
    setPreviewFile(null);
    try {
      const loaded = await getItineraryFile(activeItinerary.id, att.fileId);
      if (!loaded) {
        showToast('error', 'Arquivo não encontrado.');
        return;
      }
      setPreviewFile(loaded);
    } catch {
      showToast('error', 'Não foi possível abrir o arquivo.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const executeCalendarSyncForEvent = async (itinerary: Itinerary, ev: ItineraryEvent) => {
    if (!user) return;
    const token = await ensureWorkspaceToken();
    const res = await syncEventToGoogleCalendar(token, itinerary, ev);
    await markEventCalendarSynced(itinerary, ev.id, ev.title, res.calendarEventId, user);
    return res;
  };

  const executeGmailSend = async (
    itinerary: Itinerary,
    changeType: 'created' | 'updated' | 'digest',
    ev?: ItineraryEvent
  ) => {
    if (!user?.email) return;
    const token = await ensureWorkspaceToken();
    const others = itinerary.linkedEmails.filter((e) => e !== user.email!.toLowerCase());
    const recipients = others.length > 0 ? others : itinerary.linkedEmails;

    await sendItineraryNotificationEmail(token, {
      itinerary,
      recipients,
      changeType,
      event: ev,
      allEvents: events,
      senderEmail: user.email.toLowerCase(),
    });

    const summaryText =
      changeType === 'digest'
        ? `Enviou resumo completo por Gmail para ${recipients.length} participante(s).`
        : `Enviou aviso por Gmail sobre "${ev?.title || itinerary.title}" para ${recipients.length} participante(s).`;

    await logEmailSent(itinerary, summaryText, user);
  };

  const handleSyncPromptConfirm = async (options: {
    syncCalendar: boolean;
    sendGmail: boolean;
  }) => {
    if (!activeItinerary || !syncPromptState.event) return;
    setIsSyncPromptProcessing(true);
    try {
      const messages: string[] = [];
      if (options.syncCalendar) {
        const res = await executeCalendarSyncForEvent(activeItinerary, syncPromptState.event);
        messages.push(
          res?.updatedExisting
            ? 'atualizado no Google Agenda'
            : 'marcado no Google Agenda'
        );
      }
      if (options.sendGmail) {
        await executeGmailSend(
          activeItinerary,
          syncPromptState.changeType,
          syncPromptState.event
        );
        messages.push('aviso enviado pelo Gmail');
      }
      setSyncPromptState({ open: false, changeType: 'created', event: null });
      if (messages.length > 0) {
        showToast('success', `Concluído: ${messages.join(' e ')}.`);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao integrar com Google.');
    } finally {
      setIsSyncPromptProcessing(false);
    }
  };

  const requestSyncSingleCalendar = (ev: ItineraryEvent) => {
    if (!activeItinerary) return;
    if (!ev.date || !ev.time) {
      showToast(
        'error',
        'Defina uma data e um horário para marcar esta atividade no Google Agenda.'
      );
      return;
    }
    const isUpdate = Boolean(ev.googleCalendarEventId);
    setPendingConfirm({
      title: isUpdate
        ? 'Atualizar compromisso no Google Agenda?'
        : 'Marcar compromisso no Google Agenda?',
      description: isUpdate
        ? 'Os horários, local e convidados deste evento serão atualizados na sua agenda principal do Google.'
        : 'Este compromisso será criado na sua agenda principal do Google com os participantes convidados.',
      details: [
        `Atividade: ${formatDateShort(ev.date)} · ${ev.title}`,
        `Horário: ${ev.time}${ev.endTime ? ` – ${ev.endTime}` : ''}`,
        ev.location ? `Local: ${ev.location}` : 'Sem local definido',
        `Participantes: ${activeItinerary.linkedEmails.join(', ')}`,
      ],
      confirmLabel: isUpdate ? 'Atualizar na Agenda' : 'Marcar na Agenda',
      tone: 'workspace',
      iconType: 'calendar',
      action: async () => {
        const res = await executeCalendarSyncForEvent(activeItinerary, ev);
        showToast(
          'success',
          res?.updatedExisting
            ? `"${ev.title}" atualizado no Google Agenda.`
            : `"${ev.title}" marcado no Google Agenda.`
        );
      },
    });
  };

  const requestSyncAllCalendar = () => {
    if (!activeItinerary) return;
    const syncable = events.filter((ev) => Boolean(ev.date && ev.time));
    if (syncable.length === 0) {
      showToast(
        'error',
        'Nenhuma atividade com data e horário definidos para sincronizar com o Google Agenda.'
      );
      return;
    }
    setPendingConfirm({
      title: `Sincronizar ${syncable.length} atividade(s) com o Google Agenda?`,
      description:
        'Todas as atividades com data e horário definidos serão criadas ou atualizadas na sua agenda principal do Google, convidando os participantes.',
      details: syncable
        .slice(0, 5)
        .map(
          (ev) =>
            `${formatDateShort(ev.date)} às ${ev.time} — ${ev.title}${
              ev.googleCalendarEventId ? ' (atualizar)' : ' (criar)'
            }`
        ),
      confirmLabel: 'Sincronizar tudo',
      tone: 'workspace',
      iconType: 'calendar',
      action: async () => {
        const token = await ensureWorkspaceToken();
        if (!user) return;
        let count = 0;
        for (const ev of syncable) {
          const res = await syncEventToGoogleCalendar(token, activeItinerary, ev);
          await markEventCalendarSynced(
            activeItinerary,
            ev.id,
            ev.title,
            res.calendarEventId,
            user
          );
          count++;
        }
        showToast('success', `${count} atividade(s) sincronizada(s) com o Google Agenda.`);
      },
    });
  };

  const requestNotifySingleEvent = (ev: ItineraryEvent) => {
    if (!activeItinerary || !user?.email) return;
    const others = activeItinerary.linkedEmails.filter((e) => e !== user.email!.toLowerCase());
    const recipients = others.length > 0 ? others : activeItinerary.linkedEmails;
    const whenSuffix = ev.date ? ` (${formatDateShort(ev.date)})` : ' (Em aberto)';
    const timeLabel = ev.time ? ev.time : 'Em aberto';

    setPendingConfirm({
      title: 'Enviar aviso pelo Gmail?',
      description:
        'Um e-mail com os detalhes atualizados desta atividade será enviado pelo seu Gmail para os participantes do roteiro.',
      details: [
        `Assunto: [Nosso Roteiro · ${activeItinerary.title}] Atividade: ${ev.title}${whenSuffix}`,
        `Para: ${recipients.join(', ')}`,
        `Horário: ${timeLabel}${ev.location ? ` · Local: ${ev.location}` : ''}`,
      ],
      confirmLabel: 'Enviar e-mail',
      tone: 'workspace',
      iconType: 'gmail',
      action: async () => {
        await executeGmailSend(activeItinerary, 'updated', ev);
        showToast('success', `Aviso enviado via Gmail para ${recipients.length} participante(s).`);
      },
    });
  };

  const requestSendDigestEmail = () => {
    if (!activeItinerary || !user?.email) return;
    const others = activeItinerary.linkedEmails.filter((e) => e !== user.email!.toLowerCase());
    const recipients = others.length > 0 ? others : activeItinerary.linkedEmails;

    setPendingConfirm({
      title: 'Enviar resumo completo do roteiro por Gmail?',
      description:
        'Todos os participantes receberão a programação completa atualizada em suas caixas de entrada.',
      details: [
        `Roteiro: ${activeItinerary.title} (${events.length} atividades)`,
        `Para: ${recipients.join(', ')}`,
      ],
      confirmLabel: 'Enviar resumo',
      tone: 'workspace',
      iconType: 'gmail',
      action: async () => {
        await executeGmailSend(activeItinerary, 'digest');
        showToast('success', `Resumo enviado pelo Gmail para ${recipients.length} participante(s).`);
      },
    });
  };

  const requestDeleteEvent = (ev: ItineraryEvent) => {
    if (!activeItinerary || !user) return;
    const hasCal = Boolean(ev.googleCalendarEventId);
    const whenText = ev.date
      ? `${formatDateShort(ev.date)}${ev.time ? ` às ${ev.time}` : ' · Horário em aberto'}`
      : ev.time
        ? `Data em aberto · às ${ev.time}`
        : 'Data e horário em aberto';

    setPendingConfirm({
      title: `Remover "${ev.title}" do roteiro?`,
      description: hasCal
        ? 'Esta atividade será removida do roteiro compartilhado e também cancelada no seu Google Agenda.'
        : 'Esta atividade será removida permanentemente do roteiro compartilhado.',
      details: [whenText, ev.location ? `Local: ${ev.location}` : ''].filter(Boolean),
      confirmLabel: 'Remover atividade',
      tone: 'danger',
      iconType: 'delete',
      action: async () => {
        if (hasCal && hasWorkspaceToken()) {
          const token = getWorkspaceAccessToken();
          if (token) {
            await removeEventFromGoogleCalendar(token, ev.googleCalendarEventId).catch((err) =>
              console.warn('Could not remove Google Calendar event:', err)
            );
          }
        }
        await deleteItineraryEvent(activeItinerary, ev, user);
        showToast('success', `"${ev.title}" removido do roteiro.`);
      },
    });
  };

  const requestDeleteItinerary = () => {
    if (!activeItinerary || !user) return;
    setPendingConfirm({
      title: `Excluir o roteiro "${activeItinerary.title}"?`,
      description:
        'Todas as atividades, anexos e o histórico deste roteiro serão removidos para todos os participantes. Esta ação não pode ser desfeita.',
      details: [
        `${events.length} atividade(s) cadastrada(s)`,
        `Participantes: ${activeItinerary.linkedEmails.length}`,
      ],
      confirmLabel: 'Excluir roteiro',
      tone: 'danger',
      iconType: 'delete',
      action: async () => {
        const deletedTitle = activeItinerary.title;
        await deleteItinerary(activeItinerary.id, user.email || '');
        setSelectedItineraryId(null);
        setMobileTab('roteiros');
        showToast('success', `Roteiro "${deletedTitle}" excluído.`);
      },
    });
  };

  const handleUpdateMembers = async (newEmails: string[]) => {
    if (!activeItinerary || !user?.email) return;
    setIsUpdatingMembers(true);
    try {
      await updateItineraryLinkedEmails(activeItinerary, newEmails, user.email);
      showToast('success', 'Participantes atualizados.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao atualizar participantes.');
    } finally {
      setIsUpdatingMembers(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="font-display text-lg font-bold text-slate-900">Nosso Roteiro</p>
          <p className="mt-1 text-xs text-slate-500">Carregando sua conta...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <SignInScreen onSignIn={handleSignIn} isLoading={authLoading} errorMessage={authError} />
        <OfflineIndicator />
      </>
    );
  }

  const userEmail = (user.email || '').toLowerCase();
  const isOwner = activeItinerary?.ownerUid === user.uid;
  const hasCustomCover = Boolean(activeItinerary?.coverImageData);
  const syncableEventsCount = events.filter((ev) => Boolean(ev.date && ev.time)).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Desktop 3-Zone Top Bar */}
      <header className="hidden lg:flex sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 h-16 items-center justify-between gap-8">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setDesktopTab('agenda');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Nosso Roteiro
        </a>

        <nav className="flex items-center gap-6 text-sm font-medium">
          {(
            [
              { id: 'agenda', label: 'Agenda' },
              { id: 'grupo', label: 'Participantes' },
              { id: 'historico', label: 'Histórico' },
              { id: 'integracoes', label: 'Integrações' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDesktopTab(item.id)}
              className={`py-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                desktopTab === item.id
                  ? 'border-rose-600 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setItineraryModalMode('create');
              setItineraryModalOpen(true);
            }}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo roteiro</span>
          </button>
        </div>
      </header>

      {/* Mobile Compact Top App Bar (<= 56px) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between gap-3">
        <span className="font-display text-base font-bold text-slate-900 truncate">
          {mobileTab === 'agenda' && activeItinerary ? activeItinerary.title : 'Nosso Roteiro'}
        </span>
        <button
          type="button"
          onClick={() => {
            if (mobileTab === 'agenda' && activeItinerary) {
              setEventModalMode('create');
              setEditingEvent(null);
              setEventModalOpen(true);
            } else {
              setItineraryModalMode('create');
              setItineraryModalOpen(true);
            }
          }}
          className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{mobileTab === 'agenda' && activeItinerary ? 'Nova atividade' : 'Novo roteiro'}</span>
        </button>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 lg:py-8 pb-24 lg:pb-10 flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:w-[280px] shrink-0 flex-col gap-5">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-500">Seus roteiros</h2>
              <span className="font-mono tabular-nums text-xs text-slate-500">
                {itineraries.length}
              </span>
            </div>

            {itinerariesLoading ? (
              <div className="p-4 space-y-3">
                <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
                <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
              </div>
            ) : itineraries.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Nenhum roteiro cadastrado ainda.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {itineraries.map((it) => {
                  const selected = it.id === activeItinerary?.id;
                  const todayCount = todayEventCounts[it.id] ?? 0;
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedItineraryId(it.id)}
                        className={`w-full h-[78px] text-left px-4 flex flex-col justify-center transition-colors cursor-pointer ${
                          selected ? 'bg-rose-50/75' : 'hover:bg-slate-50'
                        }`}
                      >
                        <p
                          className={`text-sm font-semibold truncate ${
                            selected ? 'text-rose-900' : 'text-slate-900'
                          }`}
                        >
                          {it.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 truncate">
                          {it.linkedEmails.length}{' '}
                          {it.linkedEmails.length === 1 ? 'participante' : 'participantes'}
                        </p>
                        {todayCount > 0 && (
                          <p className="mt-0.5 text-xs font-semibold text-rose-600 truncate tabular-nums">
                            {todayCount} {todayCount === 1 ? 'atividade hoje' : 'atividades hoje'}
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Account & Integrations Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500">Conta conectada</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 truncate">{userEmail}</p>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Google Agenda & Gmail</span>
                <span
                  className={
                    workspaceReady ? 'font-semibold text-rose-600' : 'text-amber-700 font-medium'
                  }
                >
                  {workspaceReady ? 'Conectado' : 'Pendente'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleConnectWorkspace()}
                disabled={workspaceConnecting}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60"
              >
                {workspaceConnecting
                  ? 'Conectando...'
                  : workspaceReady
                    ? 'Renovar permissões Google'
                    : 'Conectar Agenda & Gmail'}
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2">
              <PWAInstallButton variant="full" />
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da conta</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* Mobile: Roteiros List View */}
          <div className={mobileTab === 'roteiros' ? 'lg:hidden space-y-4' : 'hidden'}>
            <div className="flex items-center justify-between">
              <h1 className="font-display text-xl font-bold text-slate-900">Seus roteiros</h1>
              <span className="font-mono tabular-nums text-xs text-slate-500">
                {itineraries.length} roteiro(s)
              </span>
            </div>

            {itinerariesLoading ? (
              <div className="space-y-3">
                <div className="h-24 rounded-2xl bg-white border border-slate-200 animate-pulse" />
                <div className="h-24 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              </div>
            ) : itineraries.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                <Calendar className="w-9 h-9 text-slate-300 mx-auto" />
                <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                  Crie seu primeiro roteiro
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Organize datas como feriados, passeios ou viagens compartilhadas pelo Gmail.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setItineraryModalMode('create');
                    setItineraryModalOpen(true);
                  }}
                  className="mt-5 min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  Novo roteiro
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {itineraries.map((it) => {
                  const todayCount = todayEventCounts[it.id] ?? 0;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        setSelectedItineraryId(it.id);
                        setMobileTab('agenda');
                      }}
                      className="w-full h-24 text-left bg-white border border-slate-200 rounded-2xl overflow-hidden flex items-stretch hover:border-slate-300 transition-colors cursor-pointer"
                    >
                      <div className="w-24 h-full shrink-0 relative bg-slate-100 overflow-hidden">
                        {it.coverImageData ? (
                          <img
                            src={it.coverImageData}
                            alt={it.title}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <MinimalGeometricCover className="absolute inset-0 w-full h-full" />
                        )}
                      </div>
                      <div className="px-4 py-3 flex-1 min-w-0 flex flex-col justify-center">
                        <p className="font-display text-base font-bold text-slate-900 truncate leading-snug">
                          {it.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 truncate">
                          {it.linkedEmails.length}{' '}
                          {it.linkedEmails.length === 1 ? 'participante' : 'participantes'}
                        </p>
                        {todayCount > 0 && (
                          <p className="mt-1 text-xs font-semibold text-rose-600 truncate tabular-nums">
                            {todayCount} {todayCount === 1 ? 'atividade hoje' : 'atividades hoje'}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile: Conta & Integrações View */}
          <div className={mobileTab === 'conta' ? 'lg:hidden space-y-4' : 'hidden'}>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500">Identificação Gmail</p>
                <p className="mt-1 text-base font-bold text-slate-900">{userEmail}</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Qualquer roteiro vinculado a este endereço aparece automaticamente aqui.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Google Agenda & Gmail</p>
                  <p className="text-xs text-slate-500">
                    {workspaceReady
                      ? 'Permissões ativas para marcar eventos e enviar avisos.'
                      : 'Conecte para sincronizar datas e notificar participantes.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleConnectWorkspace()}
                  disabled={workspaceConnecting}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  {workspaceConnecting
                    ? 'Conectando...'
                    : workspaceReady
                      ? 'Reconectar Agenda & Gmail'
                      : 'Conectar Google Agenda & Gmail'}
                </button>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" />
                  <span>Aplicativo no celular</span>
                </p>
                <PWAInstallButton variant="full" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  No Android (Chrome) ou iPhone (Safari), você pode instalar o Nosso Roteiro na tela
                  inicial para abrir em tela cheia.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair da conta</span>
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Integrations Tab */}
          <div className={desktopTab === 'integracoes' ? 'hidden lg:block space-y-6' : 'hidden'}>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900">
                  Integrações e aplicativo
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Gerencie sua conexão com o Google Agenda e Gmail ou instale o Nosso Roteiro no seu
                  dispositivo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-200">
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <CalendarCheck className="w-5 h-5 text-rose-600" />
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Google Agenda & Gmail
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Permite marcar e atualizar datas cadastradas na sua agenda principal convidando os
                    demais participantes e enviar avisos automáticos via Gmail.
                  </p>
                  <p className="text-xs font-medium text-slate-800">
                    Status:{' '}
                    <span className={workspaceReady ? 'text-rose-600' : 'text-amber-700'}>
                      {workspaceReady
                        ? `Conectado (${getWorkspaceConnectedEmail() || userEmail})`
                        : 'Aguardando autorização nesta sessão'}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleConnectWorkspace()}
                    disabled={workspaceConnecting}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer"
                  >
                    {workspaceConnecting
                      ? 'Autorizando...'
                      : workspaceReady
                        ? 'Renovar autorização'
                        : 'Conectar Google Agenda & Gmail'}
                  </button>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-5 h-5 text-rose-600" />
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Instalação no celular e desktop
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    O Nosso Roteiro funciona como Progressive Web App (PWA). Instale para acessar
                    diretamente da tela inicial do celular ou da barra de aplicativos.
                  </p>
                  <PWAInstallButton variant="full" />
                </div>
              </div>
            </div>
          </div>

          {/* Active Itinerary Workspace */}
          {(mobileTab === 'agenda' || mobileTab === 'grupo' || desktopTab !== 'integracoes') && (
            <div
              className={
                (mobileTab === 'roteiros' || mobileTab === 'conta') && desktopTab !== 'integracoes'
                  ? 'hidden lg:block space-y-6'
                  : desktopTab === 'integracoes'
                    ? 'lg:hidden space-y-6'
                    : 'space-y-6'
              }
            >
              {!itinerariesLoading && !activeItinerary ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center">
                  <Calendar className="w-11 h-11 text-slate-300 mx-auto" />
                  <h1 className="mt-4 font-display text-2xl font-bold text-slate-900 text-balance">
                    Bem-vindo ao Nosso Roteiro
                  </h1>
                  <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                    Crie seu primeiro roteiro, vincule as contas Gmail dos participantes e comece a
                    montar a agenda compartilhada.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setItineraryModalMode('create');
                      setItineraryModalOpen(true);
                    }}
                    className="mt-6 min-h-[44px] px-6 py-2.5 rounded-xl bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Novo roteiro</span>
                  </button>
                </div>
              ) : activeItinerary ? (
                <>
                  {/* Itinerary Cover Hero */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div
                      className={`relative h-44 sm:h-52 ${
                        hasCustomCover ? 'bg-slate-900' : 'bg-slate-100 border-b border-slate-200'
                      }`}
                    >
                      {hasCustomCover ? (
                        <>
                          <img
                            src={activeItinerary.coverImageData}
                            alt={activeItinerary.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
                        </>
                      ) : (
                        <MinimalGeometricCover className="w-full h-full" />
                      )}

                      <div
                        className={`absolute inset-x-0 bottom-0 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 ${
                          hasCustomCover ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        <div className="min-w-0">
                          <div
                            className={`flex flex-wrap items-center gap-x-2 text-xs ${
                              hasCustomCover ? 'text-slate-200' : 'text-slate-600'
                            }`}
                          >
                            <span className="font-mono tabular-nums">
                              {events.length} {events.length === 1 ? 'atividade' : 'atividades'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              Participantes:{' '}
                              <span className="font-mono tabular-nums font-semibold">
                                {activeItinerary.linkedEmails.length}
                              </span>
                            </span>
                          </div>
                          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight truncate">
                            {activeItinerary.title}
                          </h1>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar below Hero */}
                    <div className="px-4 sm:px-6 py-3.5 bg-white flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={requestSyncAllCalendar}
                          disabled={syncableEventsCount === 0}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-45 inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <CalendarCheck className="w-4 h-4 text-rose-600" />
                          <span>Sincronizar Agenda</span>
                        </button>

                        <button
                          type="button"
                          onClick={requestSendDigestEmail}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Mail className="w-4 h-4 text-rose-600" />
                          <span>Avisar Grupo</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setItineraryModalMode('edit');
                            setItineraryModalOpen(true);
                          }}
                          className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        {isOwner && (
                          <button
                            type="button"
                            onClick={requestDeleteItinerary}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            aria-label="Excluir roteiro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Active Section Content */}
                  <div
                    className={`${desktopTab === 'agenda' ? 'lg:block' : 'lg:hidden'} ${
                      mobileTab === 'agenda' ? 'block' : 'hidden'
                    }`}
                  >
                    <AgendaTimeline
                      itinerary={activeItinerary}
                      events={events}
                      onAddEvent={() => {
                        setEventModalMode('create');
                        setEditingEvent(null);
                        setEventModalOpen(true);
                      }}
                      onEditEvent={(ev) => {
                        setEventModalMode('edit');
                        setEditingEvent(ev);
                        setEventModalOpen(true);
                      }}
                      onToggleStatus={(ev) => void handleToggleEventStatus(ev)}
                      onSyncCalendar={requestSyncSingleCalendar}
                      onNotifyGmail={requestNotifySingleEvent}
                      onDeleteEvent={requestDeleteEvent}
                      onOpenAttachment={(att) => void handleOpenAttachment(att)}
                    />
                  </div>

                  <div
                    className={`${desktopTab === 'grupo' ? 'lg:block' : 'lg:hidden'} ${
                      mobileTab === 'grupo' ? 'block' : 'hidden'
                    }`}
                  >
                    <MembersPanel
                      itinerary={activeItinerary}
                      currentUserEmail={userEmail}
                      isUpdating={isUpdatingMembers}
                      onUpdateMembers={handleUpdateMembers}
                      onSendDigestEmail={requestSendDigestEmail}
                    />
                  </div>

                  <div
                    className={`${desktopTab === 'historico' ? 'lg:block' : 'lg:hidden'} ${
                      mobileTab === 'grupo' ? 'block' : 'hidden'
                    }`}
                  >
                    <ActivityFeed activities={activities} />
                  </div>
                </>
              ) : null}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Tab Bar (Thumb Zone) */}
      <nav
        aria-label="Navegação principal"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-4 h-16 items-center">
          {(
            [
              { id: 'roteiros', label: 'Roteiros', icon: Calendar },
              { id: 'agenda', label: 'Agenda', icon: History },
              { id: 'grupo', label: 'Grupo', icon: Users },
              { id: 'conta', label: 'Conta', icon: Settings2 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileTab(tab.id)}
                className={`h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                  active ? 'text-rose-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 1.8} />
                <span className="text-[11px] font-medium tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals & Confirmation Dialogs */}
      <ItineraryModal
        open={itineraryModalOpen}
        mode={itineraryModalMode}
        initialItinerary={itineraryModalMode === 'edit' ? activeItinerary : null}
        currentUserEmail={userEmail}
        isSubmitting={isSavingItinerary}
        onClose={() => setItineraryModalOpen(false)}
        onSubmit={handleSaveItinerary}
      />

      <EventModal
        open={eventModalOpen}
        mode={eventModalMode}
        itinerary={activeItinerary}
        currentUser={user}
        initialEvent={eventModalMode === 'edit' ? editingEvent : null}
        isSubmitting={isSavingEvent}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEvent(null);
        }}
        onSubmit={handleSaveEvent}
      />

      <FilePreviewModal
        file={previewFile}
        isLoading={isPreviewLoading}
        onClose={() => {
          setPreviewFile(null);
          setIsPreviewLoading(false);
        }}
      />

      {activeItinerary && (
        <SyncNotifyModal
          open={syncPromptState.open}
          changeType={syncPromptState.changeType}
          itinerary={activeItinerary}
          event={syncPromptState.event}
          currentUserEmail={userEmail}
          hasWorkspaceAuth={workspaceReady}
          isProcessing={isSyncPromptProcessing}
          onConfirm={handleSyncPromptConfirm}
          onClose={() =>
            setSyncPromptState({ open: false, changeType: 'created', event: null })
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || ''}
        description={pendingConfirm?.description || ''}
        details={pendingConfirm?.details}
        confirmLabel={pendingConfirm?.confirmLabel || 'Confirmar'}
        tone={pendingConfirm?.tone}
        iconType={pendingConfirm?.iconType}
        isLoading={isConfirmLoading}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          setIsConfirmLoading(true);
          try {
            await pendingConfirm.action();
            setPendingConfirm(null);
          } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Operação não concluída.');
          } finally {
            setIsConfirmLoading(false);
          }
        }}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-20 lg:bottom-6 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-lg ${
            toast.type === 'error' ? 'bg-red-700' : 'bg-slate-900'
          }`}
        >
          {toast.message}
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}
