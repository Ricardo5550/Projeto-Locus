import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../services/apiClient';
import './AuthRecovery.css';

interface VerifyEmailProps {
  onBackToLogin: () => void;
}

type VerificationState = 'loading' | 'success' | 'error';

export default function VerifyEmail({ onBackToLogin }: VerifyEmailProps) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const key = params.get('verify_email') ?? '';
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('Confirmando seu e-mail...');

  useEffect(() => {
    if (!key) {
      setState('error');
      setMessage('O link de confirmação é inválido ou incompleto.');
      return;
    }

    let cancelled = false;

    apiFetch(
      '/auth/verify-email/',
      {
        method: 'POST',
        body: JSON.stringify({ key }),
      },
      { auth: false }
    )
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setState('error');
          setMessage('Não foi possível confirmar este e-mail. O link pode ter expirado ou já ter sido utilizado.');
          return;
        }
        setState('success');
        setMessage('E-mail confirmado com sucesso. Você já pode entrar.');
        window.history.replaceState({}, '', '/');
      })
      .catch(() => {
        if (!cancelled) {
          setState('error');
          setMessage('Não foi possível conectar ao servidor para confirmar o e-mail.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <div className="page-background">
      <div className="auth-recovery-card">
        <div className="logo-pill">Locus</div>
        <h1>Confirmação de e-mail</h1>
        <p
          className={`auth-recovery-message ${
            state === 'success'
              ? 'auth-recovery-message--success'
              : state === 'error'
                ? 'auth-recovery-message--error'
                : ''
          }`}
          role="status"
        >
          {message}
        </p>
        {state !== 'loading' && (
          <button type="button" className="auth-recovery-primary" onClick={onBackToLogin}>
            Ir para o login
          </button>
        )}
      </div>
    </div>
  );
}
