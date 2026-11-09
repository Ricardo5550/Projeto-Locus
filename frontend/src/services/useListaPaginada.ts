import { useEffect, useState } from 'react';
import { apiJson } from './apiClient';

type Pagina<T> = {
  itens: T[];
  pagina: number;
  total_paginas: number;
  total: number;
};

export function useListaPaginada<T>(rota: string | null) {
  const [revisao, setRevisao] = useState(0);
  const [resultado, setResultado] = useState<{ chave: string; dados?: Pagina<T>; erro?: string }>();
  const chave = rota === null ? null : `${rota}|${revisao}`;

  useEffect(() => {
    if (rota === null || chave === null) return;
    const controlador = new AbortController();
    const espera = window.setTimeout(() => {
      apiJson<Pagina<T>>(rota, { signal: controlador.signal })
        .then(dados => {
          if (!controlador.signal.aborted) setResultado({ chave, dados });
        })
        .catch(erro => {
          if (!controlador.signal.aborted) {
            setResultado({ chave, erro: erro instanceof Error ? erro.message : 'Não foi possível carregar a lista.' });
          }
        });
    }, 180);
    return () => {
      window.clearTimeout(espera);
      controlador.abort();
    };
  }, [rota, chave]);

  const atual = resultado?.chave === chave ? resultado : undefined;
  return {
    dados: atual?.dados,
    erro: atual?.erro,
    carregando: chave !== null && !atual,
    atualizar: () => setRevisao(revisaoAtual => revisaoAtual + 1),
  };
}
