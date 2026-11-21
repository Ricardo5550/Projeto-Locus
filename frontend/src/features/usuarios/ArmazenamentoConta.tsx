import { useEffect, useState } from "react";
import { apiJson } from "../../services/apiClient";

type Uso = {
  usado_bytes: number;
  limite_bytes: number;
  disponivel_bytes: number;
};
const mb = (bytes: number) =>
  (bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default function ArmazenamentoConta() {
  const [versao] = useState(0);
  const [resposta, setResposta] = useState<{
    versao: number;
    uso?: Uso;
    erro?: string;
  }>();
  useEffect(() => {
    const controle = new AbortController();
    void apiJson<Uso>("/auth/armazenamento/", { signal: controle.signal })
      .then((uso) => {
        if (!controle.signal.aborted) setResposta({ versao, uso });
      })
      .catch((erro: unknown) => {
        if (!controle.signal.aborted)
          setResposta({
            versao,
            erro:
              erro instanceof Error
                ? erro.message
                : "Não foi possível consultar o espaço.",
          });
      });
    return () => controle.abort();
  }, [versao]);
  const atual = resposta?.versao === versao ? resposta : undefined;
  const uso = atual?.uso;
  return (
    <section className="account-storage" aria-label="Armazenamento da conta">
      <h2>Armazenamento</h2>
      {!atual && <p role="status">Consultando espaço…</p>}
      {atual?.erro && (
        <p className="account-error" role="alert">
          {atual.erro}
        </p>
      )}
      {uso && (
        <>
          <p>
            Uso estimado: {mb(uso.usado_bytes)} MB de {mb(uso.limite_bytes)} MB.
          </p>
          <progress
            aria-label="Espaço utilizado"
            max={uso.limite_bytes}
            value={Math.min(uso.usado_bytes, uso.limite_bytes)}
          />
          <small>
            Inclui anotações, imagens, mapas, perguntas, revisões, mensagens e
            dados associados.
          </small>
          {uso.disponivel_bytes === 0 && (
            <p className="account-error" role="alert">
              O espaço da conta está cheio. Exclua conteúdos ou reduza as
              imagens para liberar espaço.
            </p>
          )}
        </>
      )}
    </section>
  );
}
