import { useState } from 'react';
import type { FormEvent } from 'react';
import { apiFetch } from '../../services/apiClient';
import './AuthRecovery.css';

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

export default function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await apiFetch(
        '/auth/password/reset/',
        {
          method: 'POST',
          body: JSON.stringify({ email: email.trim() }),
        },
        { auth: false }
      );

      if (!response.ok) {
        setMessage('Não foi possível solicitar a redefinição. Tente novamente.');
        return;
      }

      // A mesma resposta é exibida independentemente de o e-mail existir.
      setMessage('Se houver uma conta com este e-mail, enviaremos as instruções de redefinição.');
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
        <h1>Redefinir senha</h1>
        <p className="auth-recovery-description">
          Informe o e-mail da sua conta para receber as instruções.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reset-email">E-mail</label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              disabled={isSubmitting}
            />
          </div>

          {message && <p className="auth-recovery-message" role="status">{message}</p>}

          <button type="submit" className="auth-recovery-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Enviar instruções'}
          </button>
          <button type="button" className="auth-recovery-link" onClick={onBackToLogin}>
            Voltar ao login
          </button>
        </form>
      </div>
    </div>
  );
}
