import { useEffect, useState } from "react";
import { apiJson } from "../../services/apiClient";

/** Identifica a resposta pela URL: dados de outra conta não aparecem durante a troca. */
export function useDadosGestao<T>(rota: string) {
  const [versao, setVersao] = useState(0);
  const [resposta, setResposta] = useState<{
    chave: string;
    dados?: T;
    erro?: string;
  }>();
  const chave = `${rota}|${versao}`;
  useEffect(() => {
    const controle = new AbortController();
    void apiJson<T>(rota, { signal: controle.signal })
      .then((dados) => {
        if (!controle.signal.aborted) setResposta({ chave, dados });
      })
      .catch((erro: unknown) => {
        if (!controle.signal.aborted)
          setResposta({
            chave,
            erro:
              erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os dados.",
          });
      });
    return () => controle.abort();
  }, [rota, chave]);
  const atual = resposta?.chave === chave ? resposta : undefined;
  return {
    dados: atual?.dados,
    erro: atual?.erro,
    carregando: !atual,
    atualizar: () => setVersao((v) => v + 1),
  };
}
