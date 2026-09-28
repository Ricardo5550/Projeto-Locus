import { useState } from 'react';
import type { FormEvent } from 'react';
import { apiFetch } from '../../services/apiClient';
import UserPrivacyPolicy from './UserPrivacyPolicy';
import UserTerms from './UserTerms';
import './UserRegister.css';

interface UserRegisterProps {
  onNavigateToLogin: () => void;
  onRegistrationSuccess: () => void;
}

type FieldErrors = {
  username?: string;
  email?: string;
  password1?: string;
  password2?: string;
  legal?: string;
  general?: string;
};

type LegalDocument = 'terms' | 'privacy' | null;

function firstMessage(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : undefined;
  if (typeof value === 'string') return value;
  return undefined;
}

function parseRegisterErrors(data: unknown): FieldErrors {
  if (!data || typeof data !== 'object') {
    return { general: 'Não foi possível criar a conta. Tente novamente.' };
  }

  const payload = data as Record<string, unknown>;
  const errors: FieldErrors = {};

  if (payload.username) {
    const raw = firstMessage(payload.username) ?? '';
    errors.username = /already|exist|já existe/i.test(raw)
      ? 'Este nome de usuário já existe.'
      : raw;
  }

  if (payload.email) {
    const raw = firstMessage(payload.email) ?? '';
    errors.email = /already|registered|exist|unique|já existe/i.test(raw)
      ? 'Este e-mail já está registrado.'
      : raw;
  }

  if (payload.password1) errors.password1 = firstMessage(payload.password1);
  if (payload.password2) errors.password2 = firstMessage(payload.password2);

  errors.legal =
    firstMessage(payload.aceite_termos) ??
    firstMessage(payload.ciencia_privacidade);

  errors.general =
    firstMessage(payload.non_field_errors) ??
    firstMessage(payload.detail) ??
    firstMessage(payload.error);

  return errors;
}

export default function UserRegister({
  onNavigateToLogin,
  onRegistrationSuccess,
}: UserRegisterProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyReadConfirmed, setPrivacyReadConfirmed] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canRegister = termsAccepted && privacyAcknowledged && !isSubmitting;

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const validationErrors: FieldErrors = {};
    if (!username.trim()) validationErrors.username = 'Informe um nome de usuário.';
    if (!email.trim()) validationErrors.email = 'Informe um e-mail.';
    if (password1.length < 7) validationErrors.password1 = 'A senha deve ter no mínimo 7 caracteres.';
    if (password1 !== password2) validationErrors.password2 = 'As senhas não coincidem.';
    if (!termsAccepted || !privacyAcknowledged) {
      validationErrors.legal = 'Leia e confirme os documentos obrigatórios antes de criar a conta.';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch('/auth/registro/', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password1,
          password2,
          aceite_termos: termsAccepted,
          ciencia_privacidade: privacyAcknowledged,
        }),
      }, { auth: false });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrors(parseRegisterErrors(data));
        return;
      }

      onRegistrationSuccess();
    } catch {
      setErrors({ general: 'Não foi possível conectar ao servidor. Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-background">
      <div className="card-registro">
        <div className="logo-pill">Locus</div>
        <h1>Crie sua conta</h1>

        <form onSubmit={handleRegister} noValidate>
          <div className="form-group">
            <label htmlFor="username">Nome de usuário</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.username)}
            />
            {errors.username && <span className="field-error">{errors.username}</span>}
          </div>

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
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password1">Senha</label>
            <input
              type="password"
              id="password1"
              value={password1}
              onChange={(event) => setPassword1(event.target.value)}
              autoComplete="new-password"
              minLength={7}
              required
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.password1)}
            />
            <span className="field-hint">Mínimo de 7 caracteres.</span>
            {errors.password1 && <span className="field-error">{errors.password1}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password2">Confirmar senha</label>
            <input
              type="password"
              id="password2"
              value={password2}
              onChange={(event) => setPassword2(event.target.value)}
              autoComplete="new-password"
              minLength={7}
              required
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.password2)}
            />
            {errors.password2 && <span className="field-error">{errors.password2}</span>}
          </div>

          {errors.general && (
            <p className="auth-message auth-message--error" role="alert">{errors.general}</p>
          )}

          <button type="submit" className="btn-registrar" disabled={!canRegister}>
            {isSubmitting ? 'Criando...' : 'Registrar'}
          </button>

          <div className="legal-consents" aria-label="Documentos legais obrigatórios">
            <label className="legal-consent-row">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                disabled={isSubmitting}
              />
              <span>
                Li e aceito os{' '}
                <button
                  type="button"
                  className="legal-inline-link"
                  onClick={() => setLegalDocument('terms')}
                  disabled={isSubmitting}
                >
                  Termos de Uso
                </button>
                .
              </span>
            </label>

            <label className={`legal-consent-row${privacyReadConfirmed ? '' : ' is-locked'}`}>
              <input
                type="checkbox"
                checked={privacyAcknowledged}
                onChange={(event) => setPrivacyAcknowledged(event.target.checked)}
                disabled={!privacyReadConfirmed || isSubmitting}
              />
              <span>
                Declaro que li e estou ciente da{' '}
                <button
                  type="button"
                  className="legal-inline-link"
                  onClick={() => setLegalDocument('privacy')}
                  disabled={isSubmitting}
                >
                  Política de Privacidade
                </button>
                .
              </span>
            </label>

            {!privacyReadConfirmed && (
              <span className="legal-consent-hint">
                Abra a Política de Privacidade e confirme a leitura no final para habilitar esta opção.
              </span>
            )}

            {errors.legal && <span className="field-error legal-consent-error">{errors.legal}</span>}
          </div>

          <button
            type="button"
            className="auth-link auth-link-button"
            onClick={onNavigateToLogin}
            disabled={isSubmitting}
          >
            Já tem conta? Entre aqui!
          </button>
        </form>
      </div>

      {legalDocument && (
        <div className="legal-modal-backdrop" role="dialog" aria-modal="true">
          <div className="legal-modal-panel">
            {legalDocument === 'terms' ? (
              <UserTerms
                onBack={() => setLegalDocument(null)}
                backLabel="Voltar ao cadastro"
              />
            ) : (
              <UserPrivacyPolicy
                onBack={() => setLegalDocument(null)}
                backLabel="Voltar ao cadastro"
                requireReadConfirmation
                readConfirmed={privacyReadConfirmed}
                onReadConfirmedChange={(checked) => {
                  setPrivacyReadConfirmed(checked);
                  if (!checked) setPrivacyAcknowledged(false);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
