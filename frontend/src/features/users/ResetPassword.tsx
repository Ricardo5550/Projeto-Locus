import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { apiFetch } from '../../services/apiClient';
import './AuthRecovery.css';

interface ResetPasswordProps {
  onBackToLogin: () => void;
}

function firstError(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Não foi possível redefinir a senha.';
  const payload = data as Record<string, unknown>;
  for (const key of ['new_password1', 'new_password2', 'token', 'uid', 'detail', 'error']) {
    const value = payload[key];
    if (Array.isArray(value) && value.length > 0) return String(value[0]);
    if (typeof value === 'string') return value;
  }
  return 'Não foi possível redefinir a senha.';
}

export default function ResetPassword({ onBackToLogin }: ResetPasswordProps) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const uid = params.get('reset_uid') ?? '';
  const token = params.get('reset_token') ?? '';
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!uid || !token) {
      setMessage('O link de redefinição é inválido ou incompleto.');
      return;
    }
    if (password1.length < 7) {
      setMessage('A senha deve ter no mínimo 7 caracteres.');
      return;
    }
    if (password1 !== password2) {
      setMessage('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiFetch(
        '/auth/password/reset/confirm/',
        {
          method: 'POST',
          body: JSON.stringify({
            uid,
            token,
            new_password1: password1,
            new_password2: password2,
          }),
        },
        { auth: false }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(firstError(data));
        return;
      }

      setSuccess(true);
      setMessage('Senha redefinida com sucesso.');
      window.history.replaceState({}, '', '/');
    } catch {
      setMessage('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-background">
      <div className="auth-recovery-card">
        <div className="logo-pill">Locus</div>
        <h1>Nova senha</h1>

        {!success ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="new-password-1">Nova senha</label>
              <input
                id="new-password-1"
                type="password"
                value={password1}
                onChange={(event) => setPassword1(event.target.value)}
                autoComplete="new-password"
                minLength={7}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-password-2">Confirmar nova senha</label>
              <input
                id="new-password-2"
                type="password"
                value={password2}
                onChange={(event) => setPassword2(event.target.value)}
                autoComplete="new-password"
                minLength={7}
                required
                disabled={isSubmitting}
              />
            </div>

            {message && <p className="auth-recovery-message auth-recovery-message--error" role="alert">{message}</p>}

            <button type="submit" className="auth-recovery-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        ) : (
          <p className="auth-recovery-message auth-recovery-message--success">{message}</p>
        )}

        <button type="button" className="auth-recovery-link" onClick={onBackToLogin}>
          Ir para o login
        </button>
      </div>
    </div>
  );
}
