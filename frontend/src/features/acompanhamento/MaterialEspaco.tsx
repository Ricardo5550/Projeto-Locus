import { useEffect, useState } from 'react';
import { Background, ConnectionMode, Controls, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BlocoLeitura } from '../mapas/BlocoEditavel';
import '../mapas/MapaMental.css';
import type { DadosMapaMental, VisaoMapaMental } from '../mapas/tiposMapa';
import ConversaEspaco from './ConversaEspaco';
import VisualizarAnotacaoCompartilhada from './VisualizarAnotacaoCompartilhada';
import { obterMapaCompartilhado, type MaterialSelecionado } from './apiAcompanhamento';

const tiposDeBloco = { leitura: BlocoLeitura };

function MapaCompartilhado({ id, espacoId }: { id: number; espacoId: number }) {
  const [mapa, setMapa] = useState<DadosMapaMental | null>(null);
  const [caminho, setCaminho] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [anotacao, setAnotacao] = useState<{ id: number; titulo: string } | null>(null);

  useEffect(() => {
    let ativo = true;
    obterMapaCompartilhado(id).then(({ dados, titulo }) => {
      if (!ativo) return;
      const estrutura = dados as (DadosMapaMental & Partial<VisaoMapaMental>) | null;
      if (estrutura?.views && estrutura.views[estrutura.rootViewId]) {
        setMapa(estrutura);
        setCaminho([estrutura.rootViewId]);
      } else if (Array.isArray(estrutura?.nodes) && Array.isArray(estrutura.edges)) {
        setMapa({ rootViewId: 'root', views: { root: { title: titulo, nodes: estrutura.nodes, edges: estrutura.edges } } });
        setCaminho(['root']);
      } else {
        setErro('Não foi possível interpretar este mapa.');
      }
    }).catch((erro: Error) => { if (ativo) setErro(erro.message); });
    return () => { ativo = false; };
  }, [id]);

  if (erro) return <p role="alert">{erro}</p>;
  if (!mapa) return <p role="status">Carregando mapa…</p>;

  const visaoId = caminho[caminho.length - 1];
  const visao = mapa.views[visaoId];
  const nodes = visao.nodes.map(node => {
    const { data } = node;
    const destino = data.linkedViewId;
    const anotacaoId = data.linkedAnnotationId;
    let abrirConteudo: (() => void) | undefined;
    if (destino && !caminho.includes(destino) && mapa.views[destino]) {
      abrirConteudo = () => setCaminho(atual => [...atual, destino]);
    } else if (anotacaoId) {
      abrirConteudo = () => setAnotacao({ id: anotacaoId, titulo: data.label });
    }

    return {
      ...node,
      type: 'leitura',
      width: node.width ?? (node.style?.width ? undefined : 140),
      height: node.height ?? (node.style?.height ? undefined : 140),
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      ariaLabel: data.label,
      data: { ...data, abrirConteudo },
    };
  });

  return <section aria-label="Mapa mental em modo de leitura">
    <nav className="acompanhamento-acoes" aria-label="Caminho do mapa">
      {caminho.slice(0, -1).map((item, indice) => <button key={item} type="button"
        onClick={() => { setAnotacao(null); setCaminho(atual => atual.slice(0, indice + 1)); }}>
        {mapa.views[item].title}
      </button>)}
      <span>{visao.title}</span>
    </nav>
    {anotacao ? <>
      <button type="button" onClick={() => setAnotacao(null)}>Voltar ao mapa</button>
      <h3>{anotacao.titulo}</h3>
      <VisualizarAnotacaoCompartilhada key={anotacao.id} anotacaoId={anotacao.id} espacoId={espacoId} mapaId={id} />
    </> : <div className="acompanhamento-mapa">
      <ReactFlow key={visaoId} nodes={nodes} edges={visao.edges} nodeTypes={tiposDeBloco}
        connectionMode={ConnectionMode.Loose} nodesDraggable={false} nodesConnectable={false}
        elementsSelectable={false} fitView>
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>}
  </section>;
}

export default function MaterialEspaco({ espacoId, material }: { espacoId: number; material: MaterialSelecionado }) {
  return <section className="acompanhamento-page">
    <h2>{material.titulo}</h2>
    {material.tipo === 'anotacao' ? <VisualizarAnotacaoCompartilhada anotacaoId={material.id} /> :
      <MapaCompartilhado id={material.id} espacoId={espacoId} />}
    <ConversaEspaco espacoId={espacoId} material={material} podePublicar />
  </section>;
}
