import React, { useState } from 'react';
import { Mail, Plus, Trash2, Users } from 'lucide-react';
import { BLUEPRINT_LIMITS, Itinerary } from '../types/itinerary';
import { normalizeEmail } from '../utils/formatters';

interface MembersPanelProps {
  itinerary: Itinerary;
  currentUserEmail: string;
  isUpdating: boolean;
  onUpdateMembers: (newEmails: string[]) => Promise<void>;
  onSendDigestEmail: () => void;
}

export const MembersPanel: React.FC<MembersPanelProps> = ({
  itinerary,
  currentUserEmail,
  isUpdating,
  onUpdateMembers,
  onSendDigestEmail,
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeEmail(emailInput);
    if (!clean) return;
    if (!BLUEPRINT_LIMITS.EMAIL_PATTERN.test(clean) || clean.length > BLUEPRINT_LIMITS.EMAIL_MAX) {
      setError('Digite uma conta Gmail válida.');
      return;
    }
    if (itinerary.linkedEmails.includes(clean)) {
      setError('Esta conta já está vinculada a este roteiro.');
      return;
    }
    if (itinerary.linkedEmails.length >= BLUEPRINT_LIMITS.LINKED_EMAILS_MAX) {
      setError(`Máximo de ${BLUEPRINT_LIMITS.LINKED_EMAILS_MAX} contas por roteiro.`);
      return;
    }
    setError(null);
    await onUpdateMembers([...itinerary.linkedEmails, clean]);
    setEmailInput('');
  };

  const handleRemove = async (email: string) => {
    if (email === itinerary.ownerEmail) return;
    setError(null);
    await onUpdateMembers(itinerary.linkedEmails.filter((e) => e !== email));
  };

  const cleanCurrent = normalizeEmail(currentUserEmail);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-900" />
            <span>Contas Gmail vinculadas</span>
          </h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Todos os e-mails vinculados visualizam e editam livremente todas as datas deste roteiro.
          </p>
        </div>

        <button
          type="button"
          onClick={onSendDigestEmail}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Mail className="w-4 h-4 text-teal-900" />
          <span>Enviar resumo por Gmail</span>
        </button>
      </div>

      <form onSubmit={(e) => void handleAdd(e)} className="mt-5 flex flex-col sm:flex-row gap-2.5">
        <input
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="Adicionar conta Gmail (ex.: amigo@gmail.com)"
          disabled={isUpdating}
          className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-900/20 focus:border-teal-900"
        />
        <button
          type="submit"
          disabled={isUpdating}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-900 text-xs font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{isUpdating ? 'Vinculando...' : 'Vincular conta'}</span>
        </button>
      </form>

      {error && (
        <p className="mt-2.5 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}

      <ul className="mt-5 divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
        {itinerary.linkedEmails.map((email) => {
          const isOwner = email === itinerary.ownerEmail;
          const isMe = email === cleanCurrent;
          return (
            <li
              key={email}
              className="px-4 py-3.5 bg-white flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{email}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isOwner ? 'Criador do roteiro' : 'Editor completo'}
                  {isMe ? ' · Você' : ''}
                </p>
              </div>
              {!isOwner && (
                <button
                  type="button"
                  onClick={() => void handleRemove(email)}
                  disabled={isUpdating}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  aria-label={`Desvincular ${email}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
