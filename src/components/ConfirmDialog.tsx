import React from 'react';
import { CalendarCheck, Mail, Trash2, AlertCircle, X } from 'lucide-react';

export type ConfirmDialogTone = 'primary' | 'danger' | 'workspace';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  iconType?: 'calendar' | 'gmail' | 'delete' | 'alert';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  details,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'primary',
  iconType = 'alert',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const Icon =
    iconType === 'calendar'
      ? CalendarCheck
      : iconType === 'gmail'
        ? Mail
        : iconType === 'delete'
          ? Trash2
          : AlertCircle;

  const iconClasses =
    tone === 'danger'
      ? 'bg-red-50 text-red-700'
      : tone === 'workspace'
        ? 'bg-rose-50 text-rose-600'
        : 'bg-slate-100 text-slate-800';

  const confirmClasses =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-rose-600 hover:bg-rose-700 text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl p-6 pb-safe">
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconClasses}`}>
            <Icon className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="min-h-[44px] min-w-[44px] -mt-2 -mr-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            aria-label="Fechar confirmação"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 id="confirm-dialog-title" className="mt-4 text-lg font-bold text-slate-900 text-balance">
          {title}
        </h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{description}</p>

        {details && details.length > 0 && (
          <ul className="mt-4 space-y-1.5 rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-700">
            {details.map((line, idx) => (
              <li key={idx} className="leading-relaxed">
                {line}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isLoading}
            className={`min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap ${confirmClasses}`}
          >
            {isLoading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
