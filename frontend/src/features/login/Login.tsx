import { useRef, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { requisicaoApi } from "../../services/apiClient";
import "./Login.css";
import TermosUso from "../usuarios/TermosUso";
import PoliticaPrivacidade, {
  type DadosPolitica,
} from "../usuarios/PoliticaPrivacidade";
import type { DadosDocumentoLegal } from "../usuarios/versoesLegais";
import SegundoFatorLogin from "./SegundoFatorLogin";

interface LoginProps {
  onLoginSuccess: () => void;
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
  notice?: string;
}

function lerMensagemApi(data: unknown): string {
  if (!data || typeof data !== "object")
    return "Não foi possível entrar. Tente novamente.";

  const payload = data as Record<string, unknown>;
  const message = payload.error ?? payload.detail ?? payload.non_field_errors;

  if (Array.isArray(message))
    return String(message[0] ?? "Não foi possível entrar.");
  if (typeof message === "string") return message;

  return "Não foi possível entrar. Verifique seus dados e tente novamente.";
}

export default function Login({
  onLoginSuccess,
  onNavigateToRegister,
  onNavigateToForgotPassword,
  notice,
}: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const captchaRef = useRef<ReCAPTCHA>(null);
  const [secondFactor, setSecondFactor] = useState<{
    challenge: string;
    setup: boolean;
  } | null>(null);

  const [desafioLegal, setDesafioLegal] = useState<{
    challenge: string;
    politica: DadosPolitica;
    termos: DadosDocumentoLegal;
  } | null>(null);
  const [documento, setDocumento] = useState<"termos" | "privacidade" | null>(
    null,
  );
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [leuPolitica, setLeuPolitica] = useState(false);

  function continuar(data: Record<string, unknown>) {
    if (data.mfa_required === true && typeof data.challenge === "string") {
      setSecondFactor({
        challenge: data.challenge,
        setup: data.setup_required === true,
      });
      return;
    }
    onLoginSuccess();
  }

  async function aceitarDocumentos(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!aceitouTermos || !leuPolitica || !desafioLegal || isSubmitting) return;
    setIsSubmitting(true);
    setMessage("");
    try {
      const response = await requisicaoApi(
        "/auth/documentos/aceitar/",
        {
          method: "POST",
          body: JSON.stringify({
            challenge: desafioLegal.challenge,
            aceite_termos: aceitouTermos,
            ciencia_privacidade: leuPolitica,
            termos_versao: desafioLegal.termos.versao,
            privacidade_versao: desafioLegal.politica.versao,
          }),
        },
        { auth: false },
      );
      const data = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!response.ok) {
        setMessage(lerMensagemApi(data));
        return;
      }
      setDesafioLegal(null);
      continuar(data);
    } catch {
      setMessage(
        "Não foi possível registrar sua confirmação. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setNeedsVerification(false);

    if (!captchaToken) {
      setMessage("Confirme o reCAPTCHA antes de entrar.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await requisicaoApi(
        "/auth/login/",
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            password,
            captcha_token: captchaToken,
          }),
        },
        { auth: false },
      );

      const data = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (!response.ok) {
        if (response.status === 403 && data.code === "email_not_verified") {
          setMessage(
            "Seu e-mail ainda não foi validado. Confirme o endereço pelo link enviado para poder acessar sua conta.",
          );
          setNeedsVerification(true);
        } else {
          setMessage(lerMensagemApi(data));
          setNeedsVerification(false);
        }
        captchaRef.current?.reset();
        setCaptchaToken(null);
        return;
      }

      setPassword("");
      if (data.legal_required === true && typeof data.challenge === "string") {
        setAceitouTermos(false);
        setLeuPolitica(false);
        setCaptchaToken(null);
        setDesafioLegal({
          challenge: data.challenge,
          politica: data.politica as DadosPolitica,
          termos: data.termos as DadosDocumentoLegal,
        });
        return;
      }
      continuar(data);
    } catch {
      setMessage("Não foi possível conectar ao servidor. Tente novamente.");
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      setMessage("Informe seu e-mail para reenviar a confirmação.");
      return;
    }

    setIsResending(true);
    try {
      const response = await requisicaoApi(
        "/auth/resend-verification/",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim() }),
        },
        { auth: false },
      );
      if (!response.ok) {
        setMessage("Não foi possível reenviar a confirmação. Tente novamente.");
        return;
      }
      setMessage(
        "Um novo e-mail de confirmação foi solicitado. Verifique sua caixa de entrada e a pasta de spam.",
      );
      setNeedsVerification(true);
    } catch {
      setMessage("Não foi possível reenviar a confirmação. Tente novamente.");
    } finally {
      setIsResending(false);
    }
  }

  if (documento === "termos" && desafioLegal)
    return (
      <TermosUso dados={desafioLegal.termos} embedded onBack={() => setDocumento(null)} />
    );
  if (documento === "privacidade" && desafioLegal)
    return (
      <PoliticaPrivacidade
        politica={desafioLegal.politica}
        embedded
        onBack={() => setDocumento(null)}
      />
    );
  if (desafioLegal)
    return (
      <div className="page-background">
        <div className="card-login">
          <h1>Documentos legais atualizados</h1>
          <p>
            Para entrar, aceite os Termos de Uso e confirme a leitura da
            Política de Privacidade.
          </p>
          <form className="aceite-legal-form" onSubmit={aceitarDocumentos}>
            <button
              className="auth-link auth-link-button"
              type="button"
              disabled={isSubmitting}
              onClick={() => setDocumento("termos")}
            >
              Ler os Termos de Uso
            </button>
            <button
              className="auth-link auth-link-button"
              type="button"
              disabled={isSubmitting}
              onClick={() => setDocumento("privacidade")}
            >
              Ler a Política de Privacidade
            </button>
            <label>
              <input
                type="checkbox"
                checked={aceitouTermos}
                disabled={isSubmitting}
                onChange={(e) => setAceitouTermos(e.target.checked)}
              />{" "}
              Aceito os Termos de Uso
            </label>
            <label>
              <input
                type="checkbox"
                checked={leuPolitica}
                disabled={isSubmitting}
                onChange={(e) => setLeuPolitica(e.target.checked)}
              />{" "}
              Li a Política de Privacidade
            </label>
            {message && <p role="alert">{message}</p>}
            <button
              className="btn-entrar"
              type="submit"
              disabled={isSubmitting || !aceitouTermos || !leuPolitica}
            >
              Aceitar e continuar
            </button>
            <button
              className="auth-link auth-link-button"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setDesafioLegal(null);
                setMessage("");
              }}
            >
              Voltar ao login
            </button>
          </form>
        </div>
      </div>
    );

  if (secondFactor)
    return (
      <SegundoFatorLogin
        challenge={secondFactor.challenge}
        setup={secondFactor.setup}
        onSuccess={onLoginSuccess}
        onCancel={() => {
          setSecondFactor(null);
          setCaptchaToken(null);
          setMessage("");
        }}
      />
    );

  return (
    <div className="page-background">
      <div className="card-login">
        <div className="logo-pill">Locus</div>
        <h1>Bem-vindo!</h1>

        <form onSubmit={handleSubmit}>
          {notice && !needsVerification && (
            <p
              className="auth-message auth-message--success auth-message--login-top"
              role="status"
            >
              {notice}
            </p>
          )}

          {needsVerification && (
            <div className="email-verification-panel" role="alert">
              <p className="auth-message auth-message--warning">{message}</p>
              <button
                type="button"
                className="auth-link auth-link-button email-verification-panel__resend"
                onClick={() => void handleResendVerification()}
                disabled={isResending}
              >
                {isResending
                  ? "Reenviando..."
                  : "Reenviar e-mail de confirmação"}
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
            {isSubmitting ? "Entrando..." : "Entrar"}
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
