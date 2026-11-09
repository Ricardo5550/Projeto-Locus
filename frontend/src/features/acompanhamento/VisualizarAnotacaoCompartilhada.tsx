import { useEffect, useState } from 'react';
import {
  obterAnotacaoCompartilhada,
  type AnotacaoCompartilhadaDetalhe,
} from './apiAcompanhamento';

type Props = {
  anotacaoId: number;
  onFechar: () => void;
};

type NoAnotacao = {
  type?: string;
  text?: string;
  content?: NoAnotacao[];
};

function extrairTexto(conteudo: unknown): string {
  if (!conteudo || typeof conteudo !== 'object') {
    return '';
  }

  const no = conteudo as NoAnotacao;

  if (no.type === 'text') {
    return no.text ?? '';
  }

  if (no.type === 'hardBreak') {
    return '\n';
  }

  const filhos = Array.isArray(no.content)
    ? no.content
    : [];

  const texto = filhos
    .map((filho) => extrairTexto(filho))
    .join('');

  if (
    no.type === 'paragraph' ||
    no.type === 'heading' ||
    no.type === 'listItem'
  ) {
    return `${texto}\n`;
  }

  return texto;
}

export default function VisualizarAnotacaoCompartilhada({
  anotacaoId,
  onFechar,
}: Props) {
  const [anotacao, setAnotacao] =
    useState<AnotacaoCompartilhadaDetalhe | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;

    setCarregando(true);
    setErro('');
    setAnotacao(null);

    obterAnotacaoCompartilhada(anotacaoId)
      .then((dados) => {
        if (ativo) {
          setAnotacao(dados);
        }
      })
      .catch((error) => {
        if (ativo) {
          setErro(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar a anotação.'
          );
        }
      })
      .finally(() => {
        if (ativo) {
          setCarregando(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [anotacaoId]);

  return (
    <section className="visualizar-anotacao-compartilhada">
      <header className="visualizar-anotacao-cabecalho">
        <h2>Visualizar anotação</h2>

        <button
          type="button"
          onClick={onFechar}
        >
          Voltar aos materiais
        </button>
      </header>

      {carregando && (
        <p role="status">
          Carregando anotação...
        </p>
      )}

      {erro && (
        <p role="alert">
          {erro}
        </p>
      )}

      {!carregando && !erro && anotacao && (
        <article className="visualizar-anotacao-conteudo">
          <h3>{anotacao.titulo}</h3>

          <div className="visualizar-anotacao-texto">
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {extrairTexto(anotacao.conteudo).trim() ||
                'Esta anotação não possui conteúdo textual.'}
            </p>
          </div>
        </article>
      )}
    </section>
  );
}