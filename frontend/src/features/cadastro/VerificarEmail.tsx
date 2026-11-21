import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { requisicaoApi } from "../../services/apiClient";
import { caminhos } from "../../navegacao/rotas";
import "../login/RecuperacaoAcesso.css";

interface VerificarEmailProps {
  onBackToLogin: () => void;
}

type EstadoVerificacao = "loading" | "success" | "error";

export default function VerificarEmail({ onBackToLogin }: VerificarEmailProps) {
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const key = params.get("verify_email") ?? "";
  const [state, setState] = useState<EstadoVerificacao>("loading");
  const [message, setMessage] = useState("Confirmando seu e-mail...");
  const [administrativo, setAdministrativo] = useState(false);
  const verificacao = useRef<Promise<{ ok: boolean; administrativo?: boolean }> | null>(null);

  useEffect(() => {
    if (!key) {
      setState("error");
      setMessage("O link de confirmação é inválido ou incompleto.");
      return;
    }

    let cancelled = false;

    // Reutiliza a mesma requisição quando o StrictMode repete o efeito.
    verificacao.current ??= requisicaoApi(
      "/auth/verify-email/",
      {
        method: "POST",
        body: JSON.stringify({ key }),
      },
      { auth: false },
    ).then(async (response) => ({
      ok: response.ok,
      ...(response.ok ? await response.json() : {}),
    }));

    verificacao.current
      .then((dados) => {
        if (cancelled) return;
        if (!dados.ok) {
          setState("error");
          setMessage(
            "Não foi possível confirmar este e-mail. O link pode ter expirado ou já ter sido utilizado.",
          );
          return;
        }
        setAdministrativo(dados.administrativo === true);
        setState("success");
        setMessage("E-mail confirmado com sucesso. Você já pode entrar.");
        void navigate({ search: "" }, { replace: true });
      })
      .catch(() => {
        if (!cancelled) {
          setState("error");
          setMessage(
            "Não foi possível conectar ao servidor para confirmar o e-mail.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, navigate]);

  return (
    <div className="page-background">
      <div className="auth-recovery-card">
        <div className="logo-pill">Locus</div>
        <h1>Confirmação de e-mail</h1>
        <p
          className={`auth-recovery-message ${
            state === "success"
              ? "auth-recovery-message--success"
              : state === "error"
                ? "auth-recovery-message--error"
                : ""
          }`}
          role="status"
        >
          {message}
        </p>
        {state !== "loading" && (
          <button
            type="button"
            className="auth-recovery-primary"
            onClick={() => administrativo ? void navigate(caminhos["admin-login"]) : onBackToLogin()}
          >
            Ir para o login
          </button>
        )}
      </div>
    </div>
  );
}
