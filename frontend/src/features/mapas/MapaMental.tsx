import PageHeader from '../../components/PageHeader';
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  ConnectionLineType,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react';

import {
  Circle,
  Link2,
  Menu,
  Octagon,
  PanelLeftClose,
  Square,
  Star,
  Triangle,
  Type,
} from 'lucide-react';

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';

import '@xyflow/react/dist/style.css';

import BlocoEditavel from './BlocoEditavel';
import { criarMapaMental, carregarMapaMental, atualizarMapaMental } from './apiMapas';
import { criarAnotacao } from '../anotacoes/apiAnotacoes';
import MapaMentalEditor from './MapaMentalEditor';

import type {
  DadosBloco,
  FormatoBloco,
  TipoConteudo,
  DadosMapaMental,
  VisaoMapaMental,
} from './tiposMapa';
import './MapaMental.css';

type MapaMentalProps = {
  mapId: number | null;
  initialFolderId?: number | null;
  breadcrumb: string[];
  initialViewStack?: string[];
  initialSelectedNodeId?: string;
  onBack: () => void;
  onHome: () => void;
  onMapCreated: (id: number, title: string) => void;
  onOpenAnnotation: (
    blockName: string,
    noteId: number,
    parentMapId: number,
    viewStack: string[],
    sourceNodeId: string
  ) => void;
};

const TAMANHO_FORMA = 140;
const ID_VISAO_RAIZ = 'root';
const nodeTypes = { editable: BlocoEditavel };

function criarDadosBloco(
  label: string,
  elementKind: 'shape' | 'text' = 'shape'
): DadosBloco {
  return {
    label,
    elementKind,
    shape: 'square',
    connectionMode: false,
    fontSize: 16,
    fontFamily: 'Arial',
    textColor: '#000000',
    bold: false,
    italic: false,
    strike: false,
    textAlign: elementKind === 'text' ? 'left' : 'center',
    verticalAlign: 'center',
    backgroundColor: elementKind === 'text' ? 'transparent' : '#ffffff',
    borderColor: '#5e402b',
    borderWidth: elementKind === 'text' ? 0 : 1,
    borderRadius: 0,
  };
}

function criarMapaVazio(title: string): DadosMapaMental {
  return {
    rootViewId: ID_VISAO_RAIZ,
    views: {
      [ID_VISAO_RAIZ]: {
        title,
        nodes: [],
        edges: [],
      },
    },
  };
}

function redefinirModoConexao(data: DadosMapaMental): DadosMapaMental {
  return {
    ...data,
    views: Object.fromEntries(
      Object.entries(data.views).map(([viewId, view]) => [
        viewId,
        {
          ...view,
          nodes: view.nodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              connectionMode: false,
            },
          })),
        },
      ])
    ),
  };
}

function obterTipoConteudoVinculado(
  data: DadosBloco
): TipoConteudo | undefined {
  return data.linkedContentType;
}

function normalizarDadosMapa(data: DadosMapaMental): DadosMapaMental {
  return redefinirModoConexao(data);
}

function validarCaminhoVisoes(data: DadosMapaMental, requested?: string[]): string[] {
  if (
    requested &&
    requested.length > 0 &&
    requested[0] === data.rootViewId &&
    requested.every((viewId) => Boolean(data.views[viewId]))
  ) {
    return requested;
  }

  return [data.rootViewId];
}

const shapeOptions: Array<{
  shape: FormatoBloco;
  label: string;
  icon: ReactNode;
}> = [
  { shape: 'square', label: 'Quadrado', icon: <Square /> },
  { shape: 'circle', label: 'Círculo', icon: <Circle /> },
  { shape: 'triangle', label: 'Triângulo', icon: <Triangle /> },
  { shape: 'octagon', label: 'Octógono', icon: <Octagon /> },
  { shape: 'star', label: 'Estrela', icon: <Star /> },
];

export default function MapaMental({
  mapId,
  initialFolderId = null,
  breadcrumb,
  initialViewStack,
  initialSelectedNodeId,
  onBack,
  onHome,
  onMapCreated,
  onOpenAnnotation,
}: MapaMentalProps) {
  const breadcrumbTitle = breadcrumb[breadcrumb.length - 1] || 'Mapa mental';

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DadosBloco>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [flow, setFlow] =
    useState<ReactFlowInstance<Node<DadosBloco>, Edge> | null>(null);
  const flowRef=useRef<ReactFlowInstance<Node<DadosBloco>, Edge> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [enteringNode, setEnteringNode] = useState<Node<DadosBloco> | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [isGoingHome, setIsGoingHome] = useState(false);
  const [storedMapId, setStoredMapId] = useState<number | null>(mapId);
  const [mapTitle, setMapTitle] = useState(mapId === null ? '' : breadcrumbTitle);
  const [projectData, setProjectData] = useState<DadosMapaMental>(() =>
    criarMapaVazio(breadcrumbTitle)
  );
  const [viewStack, setViewStack] = useState<string[]>([ID_VISAO_RAIZ]);
  const mapVersion=useRef('');
  const loadedSourceId = useRef<number | null | undefined>(undefined);


  useEffect(() => {
    if (loadedSourceId.current === mapId) return;

    loadedSourceId.current = mapId;
    setStoredMapId(mapId);
    setEnteringNode(null);
    setIsConnecting(false);

    if (mapId === null) {
      setMapTitle('');
      const empty = criarMapaVazio('Mapa mental');
      setProjectData(empty);
      setViewStack([empty.rootViewId]);
      setNodes([]);
      setEdges([]);
      setSaveStatus('Novo mapa.');
      return;
    }

    setSaveStatus('Carregando...');

    carregarMapaMental(mapId)
      .then((map) => {
        setMapTitle(map.titulo);
        mapVersion.current=map.data_atualizacao;
        const normalized = normalizarDadosMapa(map.dados);
        const nextStack = validarCaminhoVisoes(normalized, initialViewStack);
        const nextViewId = nextStack[nextStack.length - 1];
        const nextView = normalized.views[nextViewId];

        setProjectData(normalized);
        setViewStack(nextStack);
        setNodes(
          (nextView?.nodes ?? []).map((node) => ({
            ...node,
            selected: node.id === initialSelectedNodeId,
          }))
        );
        setEdges(nextView?.edges ?? []);
        setSaveStatus('Mapa carregado do banco.');
        setTimeout(() => flowRef.current?.fitView({ padding: 0.2 }), 0);
      })
      .catch((error) => {
        console.error(error);
        setSaveStatus('Erro ao carregar o mapa.');
      });
  }, [mapId, setEdges, setNodes]);

  const selectedNode = nodes.find((node) => node.selected);
  const selectedEdge = edges.find((edge) => edge.selected);

  const internalBreadcrumb = viewStack
    .slice(1)
    .map((viewId) => projectData.views[viewId]?.title)
    .filter((viewTitle): viewTitle is string => Boolean(viewTitle));

  const fullBreadcrumb = [...breadcrumb, ...internalBreadcrumb];

  // Quando estamos dentro de um bloco, as conexões exibidas na lateral
  // pertencem ao bloco da visão externa (pai), e não à seleção atual.
  const externalNavigation = (() => {
    if (viewStack.length <= 1) return null;

    const currentViewId = viewStack[viewStack.length - 1];
    const parentViewId = viewStack[viewStack.length - 2];
    const parentView = projectData.views[parentViewId];
    if (!parentView) return null;

    const sourceNode = parentView.nodes.find(
      (node) => node.data.linkedViewId === currentViewId
    );
    if (!sourceNode) return null;

    const connectedIds = new Set(
      parentView.edges
        .filter(
          (edge) => edge.source === sourceNode.id || edge.target === sourceNode.id
        )
        .map((edge) =>
          edge.source === sourceNode.id ? edge.target : edge.source
        )
    );

    const connectedNodes = parentView.nodes.filter((node) =>
      connectedIds.has(node.id)
    );

    if (!connectedNodes.length) return null;

    return {
      sourceNode,
      connectedNodes,
      parentViewId,
      parentStack: viewStack.slice(0, -1),
    };
  })();

  function snapshotCurrentView(
    nextNodes: Node<DadosBloco>[] = nodes,
    nextEdges: Edge[] = edges,
    baseData: DadosMapaMental = projectData
  ): DadosMapaMental {
    const viewId = viewStack[viewStack.length - 1] ?? baseData.rootViewId;
    const existingView: VisaoMapaMental = baseData.views[viewId] ?? {
      title: mapTitle || breadcrumbTitle,
      nodes: [],
      edges: [],
    };

    return {
      ...baseData,
      views: {
        ...baseData.views,
        [viewId]: {
          ...existingView,
          nodes: nextNodes,
          edges: nextEdges,
        },
      },
    };
  }

  async function persistProject(data: DadosMapaMental): Promise<number> {
    const inputData=data;
    data = redefinirModoConexao(data);
    let finalTitle = mapTitle.trim();

    if (!finalTitle) {
      window.alert('Informe um nome para salvar o mapa mental.');
      setSaveStatus('Informe um nome para salvar o mapa.');
      throw new Error('MAP_NAME_REQUIRED');
    }

    const activeId=viewStack[viewStack.length-1];
    if(viewStack.length>1 && !data.views[activeId]?.title.trim()) {
      window.alert('Informe um título para o mapa interno.');
      throw new Error('MAP_NAME_REQUIRED');
    }
    const rootView = data.views[data.rootViewId];
    const dataWithTitle: DadosMapaMental = rootView
      ? {
          ...data,
          views: {
            ...data.views,
            [data.rootViewId]: {
              ...rootView,
              title: finalTitle,
            },
          },
        }
      : data;

    setProjectData(dataWithTitle);

    if (storedMapId === null) {
      const saved = await criarMapaMental(finalTitle, dataWithTitle, initialFolderId);
      setStoredMapId(saved.id);
      mapVersion.current=saved.data_atualizacao;
      setProjectData(saved.dados);
      Object.assign(inputData,saved.dados);
      setMapTitle(saved.titulo);
      loadedSourceId.current = saved.id;
      onMapCreated(saved.id, saved.titulo);
      return saved.id;
    }

    const saved = await atualizarMapaMental(storedMapId, finalTitle, dataWithTitle, mapVersion.current);
    setMapTitle(saved.titulo);
    mapVersion.current=saved.data_atualizacao;
    setProjectData(saved.dados);
    Object.assign(inputData,saved.dados);
    return storedMapId;
  }

  function updateSelectedNode(changes: Partial<DadosBloco>) {
    setNodes((current) =>
      current.map((node) =>
        node.selected ? { ...node, data: { ...node.data, ...changes } } : node
      )
    );
  }

  function updateSelectedEdge(color?: string, width?: number) {
    setEdges((current) =>
      current.map((edge) =>
        edge.selected
          ? {
              ...edge,
              style: {
                ...edge.style,
                stroke: color ?? edge.style?.stroke ?? '#5e402b',
                strokeWidth: width ?? edge.style?.strokeWidth ?? 2,
              },
            }
          : edge
      )
    );
  }

  function toggleConnectionMode() {
    const next = !isConnecting;
    setIsConnecting(next);
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        data: {
          ...node.data,
          connectionMode: node.data.elementKind === 'shape' ? next : false,
        },
      }))
    );
  }

  function handleConnect(connection: Connection) {
    setEdges((current) =>
      addEdge(
        {
          ...connection,
          id: crypto.randomUUID(),
          type: 'straight',
          style: { stroke: '#5e402b', strokeWidth: 2 },
        },
        current
      )
    );
  }

  function handleDragStart(
    event: DragEvent<HTMLButtonElement>,
    kind: 'shape' | 'text',
    shape?: FormatoBloco
  ) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/locus', JSON.stringify({ kind, shape }));
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    if (!flow) return;

    const raw = event.dataTransfer.getData('application/locus');
    if (!raw) return;

    const dragged = JSON.parse(raw) as {
      kind: 'shape' | 'text';
      shape?: FormatoBloco;
    };

    const position = flow.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const isText = dragged.kind === 'text';

    const node: Node<DadosBloco> = {
      id: crypto.randomUUID(),
      type: 'editable',
      position,
      style: {
        width: isText ? 220 : TAMANHO_FORMA,
        height: isText ? 70 : TAMANHO_FORMA,
      },
      data: {
        ...criarDadosBloco(isText ? 'Novo texto' : 'Novo conceito', dragged.kind),
        shape: dragged.shape ?? 'square',
        connectionMode: !isText && isConnecting,
      },
    };

    setNodes((current) => [...current, node]);
  }

  async function handleSave() {
    try {
      setSaveStatus('Salvando...');
      const nextData = snapshotCurrentView();
      await persistProject(nextData);
      setSaveStatus('Salvo no banco.');
    } catch (error) {
      if (error instanceof Error && error.message === 'MAP_NAME_REQUIRED') return;
      console.error(error);
      setSaveStatus(error instanceof Error ? error.message : 'Erro ao salvar o mapa.');
    }
  }


  async function handleHomeFromMap() {
    if (isGoingHome) return;
    if (!mapTitle.trim()) {
      if (window.confirm('O mapa está sem título. Deseja ir para a Home e descartar as alterações?')) onHome();
      return;
    }
    try {
      setIsGoingHome(true);
      setSaveStatus('Salvando...');
      await persistProject(snapshotCurrentView());
      onHome();
    } catch (error) {
      if (error instanceof Error && error.message === 'MAP_NAME_REQUIRED') return;
      setSaveStatus(error instanceof Error ? error.message : 'Não foi possível salvar antes de ir para a Home.');
    } finally {
      setIsGoingHome(false);
    }
  }

  async function handleBackFromMap() {
    if (viewStack.length <= 1) {
      if(!mapTitle.trim() && !window.confirm('O mapa está sem título. Deseja sair e descartar as alterações?')) return;
      onBack();
      return;
    }

    try {
      setSaveStatus('Salvando...');
      const nextData = snapshotCurrentView();
      await persistProject(nextData);

      const nextStack = viewStack.slice(0, -1);
      const parentViewId = nextStack[nextStack.length - 1] ?? nextData.rootViewId;
      const parentView = nextData.views[parentViewId];

      setViewStack(nextStack);
      setNodes(parentView?.nodes ?? []);
      setEdges(parentView?.edges ?? []);
      setEnteringNode(null);
      setSaveStatus('Salvo no banco.');
      setTimeout(() => flowRef.current?.fitView({ padding: 0.2 }), 0);
    } catch (error) {
      if (error instanceof Error && error.message === 'MAP_NAME_REQUIRED') return;
      console.error(error);
      setSaveStatus('Erro ao salvar antes de voltar.');
    }
  }

  function handleEnterNode(node: Node<DadosBloco>) {
    const fixedContentType = obterTipoConteudoVinculado(node.data);

    if (fixedContentType) {
      void handleEnterContent(fixedContentType, node);
      return;
    }

    setEnteringNode(node);
  }

  async function handleEnterContent(
    contentType: TipoConteudo,
    targetNode: Node<DadosBloco> | null = enteringNode
  ) {
    if (!targetNode) return;

    try {
      setSaveStatus('Preparando conteúdo...');
      const currentNode = targetNode;
      if(!mapTitle.trim() || !currentNode.data.label.trim()) {
        window.alert('Informe um título para o mapa e um nome para o bloco antes de criar o conteúdo.');
        setSaveStatus('Preencha o título do mapa e o nome do bloco.');
        return;
      }
      const fixedContentType = obterTipoConteudoVinculado(currentNode.data);

      if (fixedContentType && fixedContentType !== contentType) {
        setSaveStatus('Este bloco já possui outro tipo de conteúdo associado.');
        setEnteringNode(null);
        return;
      }

      if (contentType === 'mindmap') {
        let childViewId = currentNode.data.linkedViewId;
        let updatedNodes = nodes;
        let nextData = snapshotCurrentView();

        if (!childViewId) {
          childViewId = crypto.randomUUID();
        }

        updatedNodes = nodes.map((node) =>
          node.id === currentNode.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  linkedContentType: 'mindmap' as TipoConteudo,
                  linkedViewId: childViewId,
                  linkedAnnotationId: undefined,
                },
              }
            : node
        );

        if (!nextData.views[childViewId]) {
          nextData = snapshotCurrentView(updatedNodes, edges);
          nextData = {
            ...nextData,
            views: {
              ...nextData.views,
              [childViewId]: {
                title: currentNode.data.label || 'Mapa mental',
                nodes: [],
                edges: [],
              },
            },
          };
        } else {
          nextData = snapshotCurrentView(updatedNodes, edges);
          const existingChild = nextData.views[childViewId];

          nextData = {
            ...nextData,
            views: {
              ...nextData.views,
              [childViewId]: existingChild
                ? {
                    ...existingChild,
                    title: currentNode.data.label || existingChild.title,
                  }
                : {
                    title: currentNode.data.label || 'Mapa mental',
                    nodes: [],
                    edges: [],
                  },
            },
          };
        }

        await persistProject(nextData);

        const childView = nextData.views[childViewId];
        setViewStack((current) => [...current, childViewId]);
        setNodes(childView.nodes);
        setEdges(childView.edges);
        setEnteringNode(null);
        setSaveStatus('Mapa interno aberto.');
        setTimeout(() => flowRef.current?.fitView({ padding: 0.2 }), 0);
        return;
      }

      let noteId = currentNode.data.linkedAnnotationId;

      if (!noteId) {
        const note = await criarAnotacao(currentNode.data.label || 'Anotação');
        noteId = note.id;
      }

      const updatedNodes: Node<DadosBloco>[] = nodes.map((node) =>
        node.id === currentNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                linkedContentType: 'annotation' as TipoConteudo,
                linkedAnnotationId: noteId,
                linkedViewId: undefined,
              },
            }
          : node
      );

      const nextData = snapshotCurrentView(updatedNodes, edges);
      const parentMapId = await persistProject(nextData);

      setNodes(updatedNodes);
      setEnteringNode(null);
      setSaveStatus('Anotação associada.');
      onOpenAnnotation(
        currentNode.data.label,
        noteId,
        parentMapId,
        viewStack,
        currentNode.id
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'MAP_NAME_REQUIRED') return;
      console.error(error);
      setSaveStatus('Erro ao criar ou abrir o conteúdo associado.');
    }
  }

  async function navigateToExternalConnection(targetNode: Node<DadosBloco>) {
    if (!externalNavigation) return;

    try {
      setSaveStatus('Salvando...');
      const nextData = snapshotCurrentView();
      const parentMapId = await persistProject(nextData);
      const contentType = obterTipoConteudoVinculado(targetNode.data);

      if (
        contentType === 'mindmap' &&
        targetNode.data.linkedViewId &&
        nextData.views[targetNode.data.linkedViewId]
      ) {
        const targetViewId = targetNode.data.linkedViewId;
        const targetView = nextData.views[targetViewId];

        setViewStack([...externalNavigation.parentStack, targetViewId]);
        setNodes(targetView.nodes);
        setEdges(targetView.edges);
        setEnteringNode(null);
        setSaveStatus(`Mapa de ${targetNode.data.label || 'bloco'} aberto.`);
        setTimeout(() => flowRef.current?.fitView({ padding: 0.2 }), 0);
        return;
      }

      if (contentType === 'annotation' && targetNode.data.linkedAnnotationId) {
        setSaveStatus('Abrindo anotação conectada...');
        onOpenAnnotation(
          targetNode.data.label || 'Anotação',
          targetNode.data.linkedAnnotationId,
          parentMapId,
          externalNavigation.parentStack,
          targetNode.id
        );
        return;
      }

      // Se o bloco conectado ainda não tem conteúdo interno, volta à visão
      // externa e deixa esse bloco selecionado para o usuário decidir o tipo.
      const parentView = nextData.views[externalNavigation.parentViewId];
      if (!parentView) return;

      const parentNodes = parentView.nodes.map((node) => ({
        ...node,
        selected: node.id === targetNode.id,
      }));

      setViewStack(externalNavigation.parentStack);
      setNodes(parentNodes);
      setEdges(parentView.edges);
      setEnteringNode(null);
      setSaveStatus('Bloco conectado selecionado na visão externa.');
      setTimeout(() => {
        flow?.setCenter(
          targetNode.position.x + TAMANHO_FORMA / 2,
          targetNode.position.y + TAMANHO_FORMA / 2,
          { duration: 350, zoom: 1 }
        );
      }, 0);
    } catch (error) {
      if (error instanceof Error && error.message === 'MAP_NAME_REQUIRED') return;
      console.error(error);
      setSaveStatus('Erro ao abrir o bloco conectado.');
    }
  }

  function deleteSelected() {
    const selectedIds = new Set(
      nodes.filter((node) => node.selected).map((node) => node.id)
    );

    setNodes((current) => current.filter((node) => !node.selected));
    setEdges((current) =>
      current.filter(
        (edge) =>
          !edge.selected &&
          !selectedIds.has(edge.source) &&
          !selectedIds.has(edge.target)
      )
    );
  }

  const currentViewId=viewStack[viewStack.length-1]??projectData.rootViewId;
  const currentTitle=viewStack.length>1 ? projectData.views[currentViewId]?.title??'' : mapTitle;
  function changeCurrentTitle(value:string) {
    if(viewStack.length<=1) {setMapTitle(value);return;}
    setProjectData(current=>({...current,views:Object.fromEntries(Object.entries(current.views).map(([id,view])=>[id,{
      ...view,
      title:id===currentViewId?value:view.title,
      nodes:view.nodes.map(node=>node.data.linkedViewId===currentViewId?{...node,data:{...node.data,label:value}}:node),
    }]))}));
  }

  return (
    <div className="mindmap" data-sidebar-open={sidebarOpen} inert={isGoingHome} aria-busy={isGoingHome}>
      <PageHeader
        title={currentTitle} onTitleChange={changeCurrentTitle}
        onBack={() => void handleBackFromMap()} onHome={() => void handleHomeFromMap()} status={saveStatus}
        titleLabel="Nome do mapa mental" placeholder="Digite o título do mapa mental..." maxLength={150}
        actions={<button type="button" className="page-action is-primary" onClick={() => void handleSave()}>Salvar</button>}
      />
      <div className="mindmap-breadcrumb">{fullBreadcrumb.join(' / ')}</div>

      <aside className={`mindmap-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="mindmap-sidebar__toggle"
          onClick={() => setSidebarOpen((current) => !current)}
          aria-label={sidebarOpen ? 'Fechar ferramentas' : 'Abrir ferramentas'}
        >
          {sidebarOpen ? <PanelLeftClose size={19} /> : <Menu size={19} />}
        </button>

        {sidebarOpen && (
          <div className="mindmap-sidebar__content">
            <h4>ELEMENTOS</h4>

            <div className="mindmap-palette">
              {shapeOptions.map(({ shape, label, icon }) => (
                <button
                  key={shape}
                  type="button"
                  draggable
                  title={label}
                  aria-label={label}
                  onDragStart={(event) => handleDragStart(event, 'shape', shape)}
                >
                  {icon}
                </button>
              ))}

              <button
                type="button"
                draggable
                title="Texto"
                aria-label="Texto"
                onDragStart={(event) => handleDragStart(event, 'text')}
              >
                <Type />
              </button>
            </div>

            <button
              type="button"
              className={
                isConnecting
                  ? 'mindmap-sidebar__connect is-active'
                  : 'mindmap-sidebar__connect'
              }
              onClick={toggleConnectionMode}
            >
              <Link2 size={17} />
              {isConnecting ? 'Conectando' : 'Conectar blocos'}
            </button>

            {isConnecting && (
              <p className="mindmap-sidebar__connect-help">
                Arraste do ponto de um bloco até o ponto de outro.
              </p>
            )}

            <hr />

            <MapaMentalEditor
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              onUpdateNode={updateSelectedNode}
              onUpdateEdge={updateSelectedEdge}
              onEnter={() => {
                if (selectedNode) {
                  handleEnterNode(selectedNode);
                }
              }}
              onDelete={deleteSelected}
            />
            
          </div>
        )}
      </aside>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={instance=>{flowRef.current=instance;setFlow(instance);}}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onDrop={handleDrop}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Straight}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>

      {externalNavigation && (
        <aside className="mindmap-neighbors" aria-label="Blocos conectados na visão externa">
          <h3>Blocos conectados</h3>
          <small>Conexões de {externalNavigation.sourceNode.data.label || 'bloco'}</small>
          {externalNavigation.connectedNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => void navigateToExternalConnection(node)}
            >
              {node.data.label || 'Bloco sem título'} →
            </button>
          ))}
        </aside>
      )}

      {enteringNode && (
        <div className="mindmap-modal" onClick={() => setEnteringNode(null)}>
          <div className="mindmap-modal__box" onClick={(event) => event.stopPropagation()}>
            <small>{enteringNode.data.label}</small>
            <h2>O que deseja criar?</h2>
            <p className="mindmap-modal__description">
              Essa escolha ficará fixa para este bloco.
            </p>

            <div className="mindmap-modal__option">
              <button
                type="button"
                onClick={() => void handleEnterContent('annotation')}
              >
                Criar anotação
              </button>

              <button
                type="button"
                onClick={() => void handleEnterContent('mindmap')}
              >
                Criar mapa mental
              </button>
            </div>

            <button
              type="button"
              className="mindmap-modal__cancel"
              onClick={() => setEnteringNode(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
