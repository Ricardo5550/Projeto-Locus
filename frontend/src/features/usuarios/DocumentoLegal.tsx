import { useEffect, useState } from "react";
import { apiJson } from "../../services/apiClient";

import type { DadosDocumentoLegal } from "./versoesLegais";
import PageHeader, { CloseButton } from "../../components/PageHeader";
import "./DocumentosLegais.css";

export type DocumentoLegalProps = {
  onBack: () => void;
  embedded?: boolean;
  backLabel?: string;
  dados?: DadosDocumentoLegal;
  versaoConfirmada?: string;
  requireReadConfirmation?: boolean;
  readConfirmed?: boolean;
  onReadConfirmedChange?: (checked: boolean, versao: string) => void;
};

export default function DocumentoLegal({
  onBack,
  backLabel = "Voltar",
  embedded = false,
  dados,
  titulo,
  categoria,
  versaoConfirmada,
  requireReadConfirmation = false,
  readConfirmed = false,
  onReadConfirmedChange,
}: DocumentoLegalProps & {
  titulo: string;
  categoria: "privacidade" | "termos";
}) {
  const [carregada, setCarregada] = useState<DadosDocumentoLegal | null>(null);
  const [erro, setErro] = useState("");
  const atual = dados ?? carregada;
  useEffect(() => {
    if (dados) return;
    let ativo = true;
    apiJson<DadosDocumentoLegal>(
      `/auth/documentos/${categoria}/`,
      {},
      { auth: false },
    )
      .then((dados) => {
        if (ativo) setCarregada(dados);
      })
      .catch(() => {
        if (ativo)
          setErro(
            "Não foi possível carregar o documento. Volte e tente novamente.",
          );
      });
    return () => {
      ativo = false;
    };
  }, [categoria, dados]);

  return (
    <div
      className={`legal-page${categoria === "privacidade" ? " privacy-legal-page" : ""}${embedded ? " is-embedded" : ""}`}
    >
      {!embedded && (
        <PageHeader
          title={titulo}
          actions={
            <CloseButton
              onClick={onBack}
              label={backLabel === "Voltar" ? `Fechar ${titulo}` : backLabel}
            />
          }
        />
      )}
      <article
        className={
          categoria === "privacidade" ? "policy-container" : "terms-container"
        }
      >
        <div className="legal-document__header">
          <div className="legal-document__topo">
            <span className="legal-document__brand">Locus</span>
            {embedded && (
              <CloseButton
                onClick={onBack}
                label={backLabel === "Voltar" ? `Fechar ${titulo}` : backLabel}
              />
            )}
          </div>
          <h1>{titulo}</h1>
          {atual && <p>Versão {atual.versao}</p>}
        </div>

        <div className="policy-content">
          {atual?.conteudo
            .replace(/\r\n?/g, "\n")
            .split(/\n[ \t]*\n/)
            .map((bloco, indice) =>
              bloco.startsWith("## ") ? (
                <h2 key={indice}>{bloco.slice(3)}</h2>
              ) : (
                <p key={indice}>{bloco}</p>
              ),
            )}
        </div>
        {erro && <p role="alert">{erro}</p>}
        {!atual && !erro && <p role="status">Carregando documento…</p>}

        {requireReadConfirmation && atual && (
          <label className="privacy-read-confirmation">
            <input
              type="checkbox"
              checked={readConfirmed && versaoConfirmada === atual.versao}
              onChange={(event) =>
                onReadConfirmedChange?.(event.target.checked, atual.versao)
              }
            />
            <span>
              Confirmo que li esta Política de Privacidade até o final e estou
              ciente das informações apresentadas.
            </span>
          </label>
        )}

        <div className="legal-document__footer">
          {atual && (
            <strong>
              {titulo} — versão {atual.versao}
            </strong>
          )}
        </div>
      </article>
    </div>
  );
}
