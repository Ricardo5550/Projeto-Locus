import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { extensoesAnotacao } from '../anotacoes/extensoesAnotacao';
import { obterAnotacaoCompartilhada, obterAnotacaoDoMapa, type AnotacaoCompartilhadaDetalhe } from './apiAcompanhamento';

function AnotacaoLeitura({ conteudo }: { conteudo: unknown }) {
  const [invalida, setInvalida] = useState(false);
  const editor = useEditor({
    extensions: extensoesAnotacao(),
    editable: false,
    enableContentCheck: true,
    content: conteudo as JSONContent,
    onContentError: () => setInvalida(true),
  });

  if (invalida) return <p role="alert">Esta anotação contém formatação que não pode ser exibida.</p>;
  if (editor?.isEmpty) return <p>Esta anotação está vazia.</p>;
  return <EditorContent editor={editor} className="acompanhamento-anotacao" />;
}

export default function VisualizarAnotacaoCompartilhada({ anotacaoId, espacoId, mapaId }: {
  anotacaoId: number;
  espacoId?: number;
  mapaId?: number;
}) {
  const [anotacao, setAnotacao] = useState<AnotacaoCompartilhadaDetalhe | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    const pedido = espacoId !== undefined && mapaId !== undefined
      ? obterAnotacaoDoMapa(espacoId, mapaId, anotacaoId)
      : obterAnotacaoCompartilhada(anotacaoId);
    pedido
      .then(dados => { if (ativo) setAnotacao(dados); })
      .catch((erro: Error) => { if (ativo) setErro(erro.message); });
    return () => { ativo = false; };
  }, [anotacaoId, espacoId, mapaId]);

  return <section className="visualizar-anotacao-compartilhada" aria-label="Anotação em modo de leitura">
    {erro && <p role="alert">{erro}</p>}
    {!anotacao && !erro && <p role="status">Carregando anotação…</p>}
    {anotacao && <AnotacaoLeitura conteudo={anotacao.conteudo} />}
  </section>;
}
