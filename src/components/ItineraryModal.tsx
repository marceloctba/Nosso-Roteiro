import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { BLUEPRINT_LIMITS, Itinerary, ItineraryFormInput } from '../types/itinerary';
import { compressImageToDataUrl } from '../utils/fileHelpers';
import { normalizeEmail } from '../utils/formatters';
import { MinimalGeometricCover } from './MinimalGeometricCover';

interface ItineraryModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialItinerary?: Itinerary | null;
  currentUserEmail: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: ItineraryFormInput) => Promise<void>;
}

export const ItineraryModal: React.FC<ItineraryModalProps> = ({
  open,
  mode,
  initialItinerary,
  currentUserEmail,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [coverImageData, setCoverImageData] = useState('');
  const [isProcessingCover, setIsProcessingCover] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [linkedEmails, setLinkedEmails] = useState<string[]>([]);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(true);
  const [notifyOnChanges, setNotifyOnChanges] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setEmailInput('');
    setIsProcessingCover(false);
    if (mode === 'edit' && initialItinerary) {
      setTitle(initialItinerary.title);
      setCoverImageData(initialItinerary.coverImageData || '');
      setLinkedEmails(initialItinerary.linkedEmails);
      setCalendarSyncEnabled(initialItinerary.calendarSyncEnabled);
      setNotifyOnChanges(initialItinerary.notifyOnChanges);
    } else {
      setTitle('');
      setCoverImageData('');
      setLinkedEmails([normalizeEmail(currentUserEmail)]);
      setCalendarSyncEnabled(true);
      setNotifyOnChanges(true);
    }
  }, [open, mode, initialItinerary, currentUserEmail]);

  if (!open) return null;

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem válida (JPG, PNG ou WebP).');
      return;
    }
    setIsProcessingCover(true);
    setError(null);
    try {
      const compressed = await compressImageToDataUrl(
        file,
        960,
        BLUEPRINT_LIMITS.COVER_DATAURL_MAX
      );
      setCoverImageData(compressed.dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível processar a capa.');
    } finally {
      setIsProcessingCover(false);
    }
  };

  const handleAddEmail = () => {
    const clean = normalizeEmail(emailInput);
    if (!clean) return;
    if (!BLUEPRINT_LIMITS.EMAIL_PATTERN.test(clean) || clean.length > BLUEPRINT_LIMITS.EMAIL_MAX) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }
    if (linkedEmails.includes(clean)) {
      setEmailInput('');
      setError(null);
      return;
    }
    if (linkedEmails.length >= BLUEPRINT_LIMITS.LINKED_EMAILS_MAX) {
      setError(`Limite máximo de ${BLUEPRINT_LIMITS.LINKED_EMAILS_MAX} contas por roteiro.`);
      return;
    }
    setLinkedEmails((prev) => [...prev, clean]);
    setEmailInput('');
    setError(null);
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    const ownerEmail =
      mode === 'edit' && initialItinerary
        ? initialItinerary.ownerEmail
        : normalizeEmail(currentUserEmail);
    if (emailToRemove === ownerEmail) return;
    setLinkedEmails((prev) => prev.filter((e) => e !== emailToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Dê um nome ao roteiro.');
      return;
    }
    setError(null);
    await onSubmit({
      title: cleanTitle.slice(0, BLUEPRINT_LIMITS.TITLE_MAX),
      coverImageData,
      linkedEmails,
      calendarSyncEnabled,
      notifyOnChanges,
    });
  };

  const ownerEmail =
    mode === 'edit' && initialItinerary
      ? initialItinerary.ownerEmail
      : normalizeEmail(currentUserEmail);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="itinerary-modal-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl overflow-hidden pb-safe">
        <div className="pt-3 sm:hidden">
          <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto" />
        </div>

        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 id="itinerary-modal-title" className="font-display text-lg font-bold text-slate-900">
            {mode === 'create' ? 'Novo roteiro' : 'Editar roteiro'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label htmlFor="itin-title" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nome do roteiro
            </label>
            <input
              id="itin-title"
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Natal, Feriado na Praia..."
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-900/20 focus:border-teal-900"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-2">
              Imagem de capa (opcional)
            </span>
            <div className="relative h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              {coverImageData ? (
                <img
                  src={coverImageData}
                  alt="Prévia da capa do roteiro"
                  className="w-full h-full object-cover"
                />
              ) : (
                <MinimalGeometricCover className="w-full h-full" />
              )}
            </div>

            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleCoverFileChange(e)}
              className="hidden"
            />

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={isProcessingCover || isSubmitting}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <ImagePlus className="w-4 h-4 text-teal-900" />
                <span>
                  {isProcessingCover
                    ? 'Processando...'
                    : coverImageData
                      ? 'Alterar capa'
                      : 'Enviar capa'}
                </span>
              </button>

              {coverImageData && (
                <button
                  type="button"
                  onClick={() => setCoverImageData('')}
                  disabled={isProcessingCover || isSubmitting}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Usar padrão minimalista
                </button>
              )}
            </div>
          </div>

          {mode === 'create' && (
            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                Participantes (contas Gmail)
              </span>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEmail();
                    }
                  }}
                  placeholder="exemplo@gmail.com"
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-900/20 focus:border-teal-900"
                />
                <button
                  type="button"
                  onClick={handleAddEmail}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Vincular
                </button>
              </div>
              <ul className="mt-2.5 divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {linkedEmails.map((em) => (
                  <li
                    key={em}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800 truncate block">{em}</span>
                      {em === ownerEmail && (
                        <span className="text-[11px] text-slate-500">Criador do roteiro</span>
                      )}
                    </div>
                    {em !== ownerEmail && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(em)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        aria-label={`Remover ${em}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2.5 pt-2 border-t border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={calendarSyncEnabled}
                onChange={(e) => setCalendarSyncEnabled(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-900 focus:ring-teal-900"
              />
              <span className="text-xs text-slate-700 leading-relaxed">
                <strong className="font-semibold text-slate-900 block">
                  Sugerir marcação no Google Agenda
                </strong>
                Exibir opção para marcar/atualizar datas automaticamente ao salvar compromissos.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={notifyOnChanges}
                onChange={(e) => setNotifyOnChanges(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-900 focus:ring-teal-900"
              />
              <span className="text-xs text-slate-700 leading-relaxed">
                <strong className="font-semibold text-slate-900 block">
                  Sugerir aviso pelo Gmail ao grupo
                </strong>
                Perguntar se deseja notificar os participantes quando novas datas forem incluídas ou
                alteradas.
              </span>
            </label>
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="pt-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isProcessingCover}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isProcessingCover}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-900 text-sm font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isSubmitting
                ? 'Salvando...'
                : mode === 'create'
                  ? 'Criar roteiro'
                  : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
