import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  MapPin,
  Paperclip,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { uploadItineraryFile } from '../services/itineraryService';
import {
  BLUEPRINT_LIMITS,
  EventAttachmentMeta,
  EventFormInput,
  EventLink,
  Itinerary,
  ItineraryEvent,
} from '../types/itinerary';
import { formatFileSize, prepareAttachmentFile } from '../utils/fileHelpers';
import { sanitizeHttpUrl } from '../utils/formatters';

interface EventModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  itinerary: Itinerary | null;
  currentUser: User;
  initialEvent?: ItineraryEvent | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: EventFormInput) => Promise<void>;
}

function getDefaultDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const EventModal: React.FC<EventModalProps> = ({
  open,
  mode,
  itinerary,
  currentUser,
  initialEvent,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(getDefaultDate);
  const [time, setTime] = useState('14:30');
  const [endTime, setEndTime] = useState('');
  const [openDate, setOpenDate] = useState(false);
  const [openTime, setOpenTime] = useState(false);
  const [status, setStatus] = useState<'planejado' | 'concluido'>('planejado');

  const [showLocationInput, setShowLocationInput] = useState(false);
  const [location, setLocation] = useState('');

  const [showLinkComposer, setShowLinkComposer] = useState(false);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [links, setLinks] = useState<EventLink[]>([]);

  const [attachments, setAttachments] = useState<EventAttachmentMeta[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAddMenuOpen(false);
    setShowLinkComposer(false);
    setLinkLabel('');
    setLinkUrl('');
    setIsUploadingFile(false);

    if (mode === 'edit' && initialEvent) {
      setTitle(initialEvent.title);
      setOpenDate(!initialEvent.date);
      setDate(initialEvent.date || getDefaultDate());
      setOpenTime(!initialEvent.time);
      setTime(initialEvent.time || '14:30');
      setEndTime(initialEvent.endTime || '');
      setStatus(initialEvent.status === 'concluido' ? 'concluido' : 'planejado');
      setLocation(initialEvent.location || '');
      setShowLocationInput(Boolean(initialEvent.location));
      setLinks(initialEvent.links || []);
      setAttachments(initialEvent.attachments || []);
    } else {
      setTitle('');
      setOpenDate(false);
      setDate(getDefaultDate());
      setOpenTime(false);
      setTime('14:30');
      setEndTime('');
      setStatus('planejado');
      setLocation('');
      setShowLocationInput(false);
      setLinks([]);
      setAttachments([]);
    }
  }, [open, mode, initialEvent]);

  if (!open) return null;

  const handleAddLink = () => {
    const cleanUrl = sanitizeHttpUrl(linkUrl);
    if (!cleanUrl || cleanUrl.length > BLUEPRINT_LIMITS.LINK_URL_MAX) {
      setError('Informe um link válido (ex.: https://...).');
      return;
    }
    if (links.length >= BLUEPRINT_LIMITS.LINKS_MAX) {
      setError(`Máximo de ${BLUEPRINT_LIMITS.LINKS_MAX} links por data.`);
      return;
    }
    setLinks((prev) => [
      ...prev,
      {
        label: linkLabel.trim().slice(0, BLUEPRINT_LIMITS.LINK_LABEL_MAX),
        url: cleanUrl,
      },
    ]);
    setLinkLabel('');
    setLinkUrl('');
    setShowLinkComposer(false);
    setError(null);
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = '';
    if (selectedFiles.length === 0 || !itinerary) return;

    if (attachments.length + selectedFiles.length > BLUEPRINT_LIMITS.ATTACHMENTS_MAX) {
      setError(`Máximo de ${BLUEPRINT_LIMITS.ATTACHMENTS_MAX} arquivos por data.`);
      return;
    }

    setIsUploadingFile(true);
    setError(null);
    try {
      const uploaded: EventAttachmentMeta[] = [];
      for (const file of selectedFiles) {
        const prepared = await prepareAttachmentFile(file);
        const meta = await uploadItineraryFile(itinerary, prepared, currentUser);
        uploaded.push(meta);
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o arquivo.');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Informe o nome da atividade ou local.');
      return;
    }
    const finalDate = openDate ? '' : date.trim();
    if (finalDate && !BLUEPRINT_LIMITS.DATE_PATTERN.test(finalDate)) {
      setError('Escolha uma data válida.');
      return;
    }
    const finalTime = openTime ? '' : time.trim();
    if (finalTime && !BLUEPRINT_LIMITS.TIME_PATTERN.test(finalTime)) {
      setError('Escolha um horário de início válido.');
      return;
    }
    const finalEndTime = openTime ? '' : endTime.trim();
    if (finalEndTime && !BLUEPRINT_LIMITS.TIME_PATTERN.test(finalEndTime)) {
      setError('Horário de término inválido.');
      return;
    }

    let finalLinks = [...links];
    if (showLinkComposer && linkUrl.trim()) {
      const pendingUrl = sanitizeHttpUrl(linkUrl);
      if (!pendingUrl) {
        setError('Informe um link válido ou limpe o campo de link.');
        return;
      }
      finalLinks = [
        ...finalLinks,
        { label: linkLabel.trim().slice(0, BLUEPRINT_LIMITS.LINK_LABEL_MAX), url: pendingUrl },
      ].slice(0, BLUEPRINT_LIMITS.LINKS_MAX);
    }

    setError(null);
    await onSubmit({
      title: cleanTitle.slice(0, BLUEPRINT_LIMITS.EVENT_TITLE_MAX),
      date: finalDate,
      time: finalTime,
      endTime: finalEndTime,
      location: showLocationInput ? location.trim().slice(0, BLUEPRINT_LIMITS.LOCATION_MAX) : '',
      links: finalLinks,
      attachments,
      status,
    });
  };

  const mapPreviewUrl = location.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden">
        <div className="pt-3 sm:hidden">
          <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto" />
        </div>

        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 id="event-modal-title" className="font-display text-lg font-bold text-slate-900">
            {mode === 'create' ? 'Nova atividade' : 'Editar atividade'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isUploadingFile}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex-1 overflow-y-auto px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 space-y-4"
        >
          <div>
            <label htmlFor="ev-title" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nome da atividade ou local
            </label>
            <input
              id="ev-title"
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.EVENT_TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Disney Celebra, Parque Barigui, Museu..."
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600"
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openDate}
                  onChange={(e) => setOpenDate(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-rose-600 text-rose-600 focus:ring-rose-600"
                />
                <span>Data em aberto</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openTime}
                  onChange={(e) => setOpenTime(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-rose-600 text-rose-600 focus:ring-rose-600"
                />
                <span>Horário em aberto</span>
              </label>
            </div>

            {(!openDate || !openTime) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {!openDate && (
                  <div>
                    <label htmlFor="ev-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Data
                    </label>
                    <input
                      id="ev-date"
                      type="date"
                      required={!openDate}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600"
                    />
                  </div>
                )}

                {!openTime && (
                  <>
                    <div>
                      <label htmlFor="ev-time" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Horário
                      </label>
                      <input
                        id="ev-time"
                        type="time"
                        required={!openTime}
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600"
                      />
                    </div>
                    <div>
                      <label htmlFor="ev-end" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Término (opcional)
                      </label>
                      <input
                        id="ev-end"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* "+" Add Optional Details Button & Dropdown Menu */}
          <div className="pt-1">
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setAddMenuOpen((prev) => !prev)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-rose-600" />
                <span>Adicionar</span>
              </button>

              {addMenuOpen && (
                <div className="mt-1.5 w-60 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-20">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLocationInput(true);
                      setAddMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Local</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLinkComposer(true);
                      setAddMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Link2 className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Arquivo (PDF ou imagem)</span>
                  </button>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              multiple
              onChange={(e) => void handleFilesSelected(e)}
              className="hidden"
            />
          </div>

          {/* Optional Location (Map-linked) */}
          {showLocationInput && (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="ev-location" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" />
                  <span>Local</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setLocation('');
                    setShowLocationInput(false);
                  }}
                  className="text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                >
                  Remover
                </button>
              </div>
              <input
                id="ev-location"
                type="text"
                maxLength={BLUEPRINT_LIMITS.LOCATION_MAX}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Digite o endereço ou nome do lugar..."
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600"
              />
              {mapPreviewUrl && (
                <a
                  href={mapPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
                >
                  <span>Conferir no Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Optional Link Composer & Added Links */}
          {(showLinkComposer || links.length > 0) && (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Links</span>
                </span>
                {!showLinkComposer && (
                  <button
                    type="button"
                    onClick={() => setShowLinkComposer(true)}
                    className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    + Novo link
                  </button>
                )}
              </div>

              {links.length > 0 && (
                <ul className="space-y-1.5">
                  {links.map((item, idx) => (
                    <li
                      key={`${item.url}-${idx}`}
                      className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">
                          {item.label || item.url}
                        </p>
                        {item.label && (
                          <p className="text-[11px] text-slate-500 truncate">{item.url}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setLinks((prev) => prev.filter((_, i) => i !== idx))}
                        className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                        aria-label="Remover link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {showLinkComposer && (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    maxLength={BLUEPRINT_LIMITS.LINK_LABEL_MAX}
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="Nome do link (opcional, ex.: Ingressos)"
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600"
                  />
                  <div className="flex gap-2">
                    <input
                      type="url"
                      maxLength={BLUEPRINT_LIMITS.LINK_URL_MAX}
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddLink}
                      className="min-h-[40px] px-3.5 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
                    >
                      Incluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Optional File Attachments (PDF / Image) */}
          {(attachments.length > 0 || isUploadingFile) && (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-rose-600" />
                  <span>Arquivos anexados</span>
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile}
                  className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  + Enviar outro
                </button>
              </div>

              {isUploadingFile && (
                <p className="text-xs text-rose-600 font-medium">Enviando arquivo...</p>
              )}

              <ul className="space-y-1.5">
                {attachments.map((att) => {
                  const isPdf = att.mimeType === 'application/pdf';
                  return (
                    <li
                      key={att.fileId}
                      className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isPdf ? (
                          <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="font-medium text-slate-800 truncate">{att.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
                          {formatFileSize(att.sizeBytes)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((a) => a.fileId !== att.fileId))
                        }
                        className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                        aria-label={`Remover ${att.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {error && (
            <p className="text-xs font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="pt-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isUploadingFile}
              className="min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingFile}
              className="min-h-[44px] sm:min-h-[40px] px-5 py-2 rounded-xl bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              {isSubmitting
                ? 'Salvando...'
                : mode === 'create'
                  ? 'Adicionar ao roteiro'
                  : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
