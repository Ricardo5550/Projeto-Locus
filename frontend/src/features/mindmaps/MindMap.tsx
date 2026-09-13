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
  ArrowLeft,
  Circle,
  Link2,
  Menu,
  Octagon,
  PanelLeftClose,
  Square,
  Save,
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

import EditableBlock from './EditableBlock';
import { createMindMap, loadMindMap, updateMindMap } from './mindMapApi';
import { createNote } from '../notes/noteApi';
import MindMapEditor from './MindMapEditor';

import type {
  BlockData,
  BlockShape,
  ContentType,
  MindMapData,
  MindMapView,
} from './mindMapTypes';
import './MindMap.css';

type MindMapProps = {
  mapId: number | null;
  breadcrumb: string[];
  initialViewStack?: string[];
  onBack: () => void;
  onMapCreated: (id: number, title: string) => void;
  onOpenAnnotation: (
    blockName: string,
    noteId: number,
    parentMapId: number,
    viewStack: string[]
  ) => void;
};

const SHAPE_SIZE = 140;
const ROOT_VIEW_ID = 'root';
const nodeTypes = { editable: EditableBlock };

function createBlockData(
  label: string,
  elementKind: 'shape' | 'text' = 'shape'
): BlockData {
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

function createEmptyMapData(title: string): MindMapData {
  return {
    rootViewId: ROOT_VIEW_ID,
    views: {
      [ROOT_VIEW_ID]: {
        title,
        nodes: [],
        edges: [],
      },
    },
  };
}

function resetConnectionMode(data: MindMapData): MindMapData {
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

function getLinkedContentType(
  data: BlockData
): ContentType | undefined {
  return data.linkedContentType;
}

function normalizeMapData(data: MindMapData): MindMapData {
  return resetConnectionMode(data);
}

function validViewStack(data: MindMapData, requested?: string[]): string[] {
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
  shape: BlockShape;
  label: string;
  icon: ReactNode;
}> = [
  { shape: 'square', label: 'Quadrado', icon: <Square /> },
  { shape: 'circle', label: 'Círculo', icon: <Circle /> },
  { shape: 'triangle', label: 'Triângulo', icon: <Triangle /> },
  { shape: 'octagon', label: 'Octógono', icon: <Octagon /> },
  { shape: 'star', label: 'Estrela', icon: <Star /> },
];

export default function MindMap({
  mapId,
  breadcrumb,
  initialViewStack,
  onBack,
  onMapCreated,
  onOpenAnnotation,
}: MindMapProps) {
  const breadcrumbTitle = breadcrumb[breadcrumb.length - 1] || 'Mapa mental';

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<BlockData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [flow, setFlow] =
    useState<ReactFlowInstance<Node<BlockData>, Edge> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [enteringNode, setEnteringNode] = useState<Node<BlockData> | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [storedMapId, setStoredMapId] = useState<number | null>(mapId);
  const [mapTitle, setMapTitle] = useState(mapId === null ? '' : breadcrumbTitle);
  const [projectData, setProjectData] = useState<MindMapData>(() =>
    createEmptyMapData(breadcrumbTitle)
  );
  const [viewStack, setViewStack] = useState<string[]>([ROOT_VIEW_ID]);
  const loadedSourceId = useRef<number | null | undefined>(undefined);


  useEffect(() => {
    if (loadedSourceId.current === mapId) return;

    loadedSourceId.current = mapId;
    setStoredMapId(mapId);
    setEnteringNode(null);
    setIsConnecting(false);

    if (mapId === null) {
      setMapTitle('');
      const empty = createEmptyMapData('Mapa mental');
      setProjectData(empty);
      setViewStack([empty.rootViewId]);
      setNodes([]);
      setEdges([]);
      setSaveStatus('Novo mapa.');
      return;
    }

    setSaveStatus('Carregando...');

    loadMindMap(mapId)
      .then((map) => {
        setMapTitle(map.titulo);
        const normalized = normalizeMapData(map.dados);
        const nextStack = validViewStack(normalized, initialViewStack);
        const nextViewId = nextStack[nextStack.length - 1];
        const nextView = normalized.views[nextViewId];

        setProjectData(normalized);
        setViewStack(nextStack);
        setNodes(nextView?.nodes ?? []);
        setEdges(nextView?.edges ?? []);
        setSaveStatus('Mapa carregado do banco.');
        setTimeout(() => flow?.fitView({ padding: 0.2 }), 0);
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

  function snapshotCurrentView(
    nextNodes: Node<BlockData>[] = nodes,
    nextEdges: Edge[] = edges,
    baseData: MindMapData = projectData
  ): MindMapData {
    const viewId = viewStack[viewStack.length - 1] ?? baseData.rootViewId;
    const existingView: MindMapView = baseData.views[viewId] ?? {
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

  async function persistProject(data: MindMapData): Promise<number> {
    data = resetConnectionMode(data);
    let finalTitle = mapTitle.trim();

    if (!finalTitle && storedMapId === null) {
      const typedTitle = window.prompt('Nome do mapa mental:');
      finalTitle = typedTitle?.trim() ?? '';

      if (!finalTitle) {
        setSaveStatus('Informe um nome para salvar o mapa.');
        throw new Error('MAP_NAME_REQUIRED');
      }

      setMapTitle(finalTitle);
    }

    if (!finalTitle) {
      finalTitle = breadcrumbTitle;
    }

    const rootView = data.views[data.rootViewId];
    const dataWithTitle: MindMapData = rootView
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
      const saved = await createMindMap(finalTitle, dataWithTitle);
      setStoredMapId(saved.id);
      setMapTitle(saved.titulo);
      loadedSourceId.current = saved.id;
      onMapCreated(saved.id, saved.titulo);
      return saved.id;
    }

    const saved = await updateMindMap(storedMapId, finalTitle, dataWithTitle);
    setMapTitle(saved.titulo);
    return storedMapId;
  }

  function updateSelectedNode(changes: Partial<BlockData>) {
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
    shape?: BlockShape
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
      shape?: BlockShape;
    };

    const position = flow.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const isText = dragged.kind === 'text';

    const node: Node<BlockData> = {
      id: crypto.randomUUID(),
      type: 'editable',
      position,
      style: {
        width: isText ? 220 : SHAPE_SIZE,
        height: isText ? 70 : SHAPE_SIZE,
      },
      data: {
        ...createBlockData(isText ? 'Novo texto' : 'Novo conceito', dragged.kind),
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
      setSaveStatus('Erro ao salvar. Verifique se o backend está rodando.');
    }
  }


  async function handleBackFromMap() {
    if (viewStack.length <= 1) {
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
      setTimeout(() => flow?.fitView({ padding: 0.2 }), 0);
    } catch (error) {
      if (error instanceof Error && error.message === 'MAP_NAME_REQUIRED') return;
      console.error(error);
      setSaveStatus('Erro ao salvar antes de voltar.');
    }
  }

  function handleEnterNode(node: Node<BlockData>) {
    const fixedContentType = getLinkedContentType(node.data);

    if (fixedContentType) {
      void handleEnterContent(fixedContentType, node);
      return;
    }

    setEnteringNode(node);
  }

  async function handleEnterContent(
    contentType: ContentType,
    targetNode: Node<BlockData> | null = enteringNode
  ) {
    if (!targetNode) return;

    try {
      setSaveStatus('Preparando conteúdo...');
      const currentNode = targetNode;
      const fixedContentType = getLinkedContentType(currentNode.data);

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
                  linkedContentType: 'mindmap' as ContentType,
                  linkedViewId: childViewId,
                  linkedAnnotationId: undefined,
                  linkedMapId: undefined,
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
        setTimeout(() => flow?.fitView({ padding: 0.2 }), 0);
        return;
      }

      let noteId = currentNode.data.linkedAnnotationId;

      if (!noteId) {
        const note = await createNote(currentNode.data.label || 'Anotação');
        noteId = note.id;
      }

      const updatedNodes: Node<BlockData>[] = nodes.map((node) =>
        node.id === currentNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                linkedContentType: 'annotation' as ContentType,
                linkedAnnotationId: noteId,
                linkedViewId: undefined,
                linkedMapId: undefined,
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
        viewStack
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'MAP_NAME_REQUIRED') return;
      console.error(error);
      setSaveStatus('Erro ao criar ou abrir o conteúdo associado.');
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

  return (
    <div className="mindmap">
      <header className="mindmap-header">
        <button
          type="button"
          onClick={() => void handleBackFromMap()}
          className="mindmap-header__back"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="mindmap-header__title">
          <small>{fullBreadcrumb.join(' / ')}</small>
        </div>

        <div className="mindmap-header__actions">
          {saveStatus && <small className="mindmap-header__status">{saveStatus}</small>}

          <button
            type="button"
            onClick={handleSave}
            className="mindmap-header__action is-primary"
          >
            <Save size={16} />
            Salvar
          </button>

          <span className="mindmap-header__tag">Mapa mental</span>
        </div>
      </header>

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

            <MindMapEditor
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
        onInit={setFlow}
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
