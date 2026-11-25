import React from 'react';
import { Download, X } from 'lucide-react';
import { ItineraryFileDoc } from '../types/itinerary';
import { formatFileSize } from '../utils/fileHelpers';

interface FilePreviewModalProps {
  file: ItineraryFileDoc | null;
  isLoading: boolean;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  isLoading,
  onClose,
}) => {
  if (!isLoading && !file) return null;

  const isPdf = file?.mimeType === 'application/pdf';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-preview-title"
    >
      <div className="w-full sm:max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl overflow-hidden pb-safe">
        <div className="pt-3 sm:hidden">
          <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto" />
        </div>

        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 id="file-preview-title" className="font-display text-base font-bold text-slate-900 truncate">
              {isLoading ? 'Carregando arquivo...' : file?.name}
            </h3>
            {file && (
              <p className="text-xs text-slate-500 font-mono tabular-nums">
                {formatFileSize(file.sizeBytes)} · Enviado por {file.uploadedByEmail}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {file && (
              <a
                href={file.dataUrl}
                download={file.name}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 inline-flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Baixar</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Fechar visualização"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center min-h-[320px]">
          {isLoading ? (
            <p className="text-sm text-slate-600">Abrindo anexo...</p>
          ) : file ? (
            isPdf ? (
              <iframe
                src={file.dataUrl}
                title={file.name}
                className="w-full h-[65vh] rounded-xl bg-white border border-slate-200"
              />
            ) : (
              <img
                src={file.dataUrl}
                alt={file.name}
                className="max-w-full max-h-[68vh] rounded-xl object-contain shadow-sm"
              />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};
