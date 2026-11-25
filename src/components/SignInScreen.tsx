import React from 'react';
import { Calendar, Mail, Smartphone, Users } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface SignInScreenProps {
  onSignIn: () => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onSignIn,
  isLoading,
  errorMessage,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="w-full max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-8">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Nosso Roteiro
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton variant="header" />
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-10 sm:py-16 flex flex-col justify-center">
        <div>
          <p className="text-xs font-semibold text-rose-600 tracking-wide">
            Agenda compartilhada · Web e celular
          </p>
          <h1 className="mt-3 font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] text-balance">
            Roteiros planejados em conjunto, direto com sua conta Gmail.
          </h1>
          <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-2xl">
            Crie roteiros para viagens, feriados ou passeios, vincule as contas Gmail dos
            participantes e deixe todos editarem datas, horários, locais e anexos em tempo real.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={() => void onSignIn()}
              disabled={isLoading}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                </div>
                <span>{isLoading ? 'Entrando...' : 'Entrar com Google'}</span>
              </div>
            </button>
          </div>

          {errorMessage && (
            <p className="mt-3 text-sm text-red-600 font-medium" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Edição colaborativa</h2>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                  Qualquer conta Gmail vinculada ao roteiro pode incluir ou ajustar horários.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Google Agenda integrado</h2>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                  Marque e atualize compromissos com convidados diretamente na sua agenda.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Avisos pelo Gmail</h2>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                  Notifique todos os participantes sempre que uma nova data for incluída ou alterada.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Instalável no celular</h2>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                  Use no navegador ou instale na tela inicial do Android e iPhone como aplicativo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
