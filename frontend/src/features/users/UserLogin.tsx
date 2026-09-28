import { useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { apiFetch, setAuthTokens } from '../../services/apiClient';
import './UserLogin.css';

interface UserLoginProps {
  onLoginSuccess: () => void;
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
  notice?: string;
}

function readApiMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Não foi possível entrar. Tente novamente.';

  const payload = data as Record<string, unknown>;
  const message = payload.error ?? payload.detail ?? payload.non_field_errors;

  if (Array.isArray(message)) return String(message[0] ?? 'Não foi possível entrar.');
  if (typeof message === 'string') return message;

  return 'Não foi possível entrar. Verifique seus dados e tente novamente.';
}

export default function UserLogin({
  onLoginSuccess,
  onNavigateToRegister,
  onNavigateToForgotPassword,
  notice,
}: UserLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const captchaRef = useRef<ReCAPTCHA>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setNeedsVerification(false);

    if (!captchaToken) {
      setMessage('Confirme o reCAPTCHA antes de entrar.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch('/auth/login/', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          captcha_token: captchaToken,
        }),
      }, { auth: false });

      const data = await response.json().catch(() => ({})) as Record<string, unknown>;

      if (!response.ok) {
        if (response.status === 403) {
          setMessage(
            'Seu e-mail ainda não foi validado. Confirme o endereço pelo link enviado para poder acessar sua conta.'
          );
          setNeedsVerification(true);
        } else {
          setMessage(readApiMessage(data));
          setNeedsVerification(false);
        }
        captchaRef.current?.reset();
        setCaptchaToken(null);
        return;
      }

      if (typeof data.access !== 'string' || typeof data.refresh !== 'string') {
        setMessage('O servidor não retornou uma sessão válida.');
        return;
      }

      setAuthTokens(data.access, data.refresh);
      onLoginSuccess();
    } catch {
      setMessage('Não foi possível conectar ao servidor. Tente novamente.');
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      setMessage('Informe seu e-mail para reenviar a confirmação.');
      return;
    }

    setIsResending(true);
    try {
      const response = await apiFetch(
        '/auth/resend-verification/',
        {
          method: 'POST',
          body: JSON.stringify({ email: email.trim() }),
        },
        { auth: false }
      );
      if (!response.ok) {
        setMessage('Não foi possível reenviar a confirmação. Tente novamente.');
        return;
      }
      setMessage('Um novo e-mail de confirmação foi solicitado. Verifique sua caixa de entrada e a pasta de spam.');
      setNeedsVerification(true);
    } catch {
      setMessage('Não foi possível reenviar a confirmação. Tente novamente.');
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="page-background">
      <div className="card-login">
        <div className="logo-pill">Locus</div>
        <h1>Bem-vindo!</h1>

        <form onSubmit={handleSubmit}>
          {notice && !needsVerification && (
            <p className="auth-message auth-message--success auth-message--login-top" role="status">
              {notice}
            </p>
          )}

          {needsVerification && (
            <div className="email-verification-panel" role="alert">
              <p className="auth-message auth-message--warning">
                {message}
              </p>
              <button
                type="button"
                className="auth-link auth-link-button email-verification-panel__resend"
                onClick={() => void handleResendVerification()}
                disabled={isResending}
              >
                {isResending ? 'Reenviando...' : 'Reenviar e-mail de confirmação'}
              </button>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              disabled={isSubmitting}
            />
          </div>

          <button
            type="button"
            className="auth-link auth-link-button auth-link-button--forgot"
            onClick={onNavigateToForgotPassword}
            disabled={isSubmitting}
          >
            Esqueci minha senha
          </button>

          <div className="captcha-container">
            <ReCAPTCHA
              ref={captchaRef}
              sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
              onChange={setCaptchaToken}
              onExpired={() => setCaptchaToken(null)}
            />
          </div>

          {message && !needsVerification && (
            <p className="auth-message auth-message--error" role="alert">
              {message}
            </p>
          )}

          <button type="submit" className="btn-entrar" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            type="button"
            className="auth-link auth-link-button"
            onClick={onNavigateToRegister}
            disabled={isSubmitting}
          >
            Não tem conta? Registre-se!
          </button>
        </form>
      </div>
    </div>
  );
}
