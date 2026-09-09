import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  ConnectionLineType,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import '@xyflow/react/dist/style.css';

import EditableBlock from './components/EditableBlock';
import EnterBlockModal from './components/EnterBlockModal';
import MindMapHeader from './components/MindMapHeader';
import MindMapSidebar from './components/MindMapSidebar';
import RelatedSidebar from './components/RelatedSidebar';
import {
  SHAPE_SIZE,
  TEXT_HEIGHT,
  TEXT_WIDTH,
  createBlockData,
  initialNodes,
} from './mindMapConstants';
import type {
  BlockData,
  BlockShape,
  ClipboardState,
  ContentType,
  DragPayload,
  HistoryState,
  MindMapProps,
} from './mindMapTypes';
import './MindMap.css';

const nodeTypes = {
  editable: EditableBlock,
};

export default function MindMap({
  onBack,
  onEnterBlock,
  breadcrumb,
  relatedNames = [],
}: MindMapProps) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<Node<BlockData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance<Node<BlockData>, Edge> | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [enteringNode, setEnteringNode] = useState<Node<BlockData> | null>(null);

  const [dragPreview, setDragPreview] = useState<{
    payload: DragPayload;
    position: { x: number; y: number };
  } | null>(null);

  const draggingPayload = useRef<DragPayload | null>(null);
  const history = useRef<HistoryState[]>([]);
  const clipboard = useRef<ClipboardState>({ nodes: [], edges: [] });
  const isResizing = useRef(false);

  const selectedNodes = nodes.filter((node) => node.selected);
  const selectedEdges = edges.filter((edge) => edge.selected);

  function saveHistory() {
    history.current.push({
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    });

    if (history.current.length > 100) {
      history.current.shift();
    }
  }

  function undo() {
    const previous = history.current.pop();
    if (!previous) return;

    setNodes(previous.nodes);
    setEdges(previous.edges);
  }

  function copySelected() {
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
    const edgesToCopy = edges.filter(
      (edge) =>
        edge.selected ||
        (selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target))
    );

    clipboard.current = {
      nodes: structuredClone(selectedNodes),
      edges: structuredClone(edgesToCopy),
    };
  }

  function pasteClipboard() {
    if (
      clipboard.current.nodes.length === 0 &&
      clipboard.current.edges.length === 0
    ) {
      return;
    }

    saveHistory();

    const idMap = new Map<string, string>();

    clipboard.current.nodes.forEach((node) => {
      idMap.set(node.id, crypto.randomUUID());
    });

    const pastedNodes: Node<BlockData>[] = clipboard.current.nodes.map((node) => ({
      ...structuredClone(node),
      id: idMap.get(node.id)!,
      position: {
        x: node.position.x + 40,
        y: node.position.y + 40,
      },
      selected: true,
      data: {
        ...structuredClone(node.data),
        isPreview: false,
        connectionMode:
          node.data.elementKind === 'shape' ? isConnecting : false,
      },
    }));

    const pastedEdges: Edge[] = clipboard.current.edges
      .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
      .map((edge) => ({
        ...structuredClone(edge),
        id: crypto.randomUUID(),
        source: idMap.get(edge.source)!,
        target: idMap.get(edge.target)!,
        selected: true,
      }));

    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      ...pastedNodes,
    ]);

    setEdges((current) => [
      ...current.map((edge) => ({ ...edge, selected: false })),
      ...pastedEdges,
    ]);

    clipboard.current = {
      nodes: structuredClone(pastedNodes),
      edges: structuredClone(pastedEdges),
    };
  }

  function deleteSelected() {
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    saveHistory();

    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));

    setNodes((current) => current.filter((node) => !node.selected));

    setEdges((current) =>
      current.filter(
        (edge) =>
          !edge.selected &&
          !selectedNodeIds.has(edge.source) &&
          !selectedNodeIds.has(edge.target)
      )
    );
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;

      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if (isTyping) return;

      if (event.ctrlKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copySelected();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteClipboard();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelected();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  function getRelatedNames(nodeId: string) {
    return edges
      .filter((edge) => edge.source === nodeId || edge.target === nodeId)
      .map((edge) => {
        const relatedId = edge.source === nodeId ? edge.target : edge.source;
        return nodes.find((node) => node.id === relatedId)?.data.label;
      })
      .filter((name): name is string => name !== undefined);
  }

  function handleNodesChange(changes: NodeChange<Node<BlockData>>[]) {
    const resizeStarted = changes.some(
      (change) =>
        change.type === 'dimensions' &&
        change.resizing === true
    );

    const resizeEnded = changes.some(
      (change) =>
        change.type === 'dimensions' &&
        change.resizing === false
    );

    if (resizeStarted && !isResizing.current) {
      saveHistory();
      isResizing.current = true;
    }

    if (resizeEnded) {
      isResizing.current = false;
    }

    onNodesChange(changes);
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    onEdgesChange(changes);
  }

  function handleConnect(connection: Connection) {
    saveHistory();

    const newEdge: Edge = {
      ...connection,
      id: crypto.randomUUID(),
      type: 'straight',
      style: {
        stroke: '#333333',
        strokeWidth: 2,
      },
    };

    setEdges((current) => addEdge(newEdge, current));
  }

  function toggleConnectionMode() {
    const next = !isConnecting;

    setIsConnecting(next);

    setNodes((current) =>
      current.map((node) => ({
        ...node,
        data: {
          ...node.data,
          connectionMode:
            node.data.elementKind === 'shape' ? next : false,
        },
      }))
    );
  }

  function updateSelectedBlocks(changes: Partial<BlockData>) {
    if (selectedNodes.length === 0) return;

    saveHistory();

    setNodes((current) =>
      current.map((node) =>
        node.selected
          ? {
              ...node,
              data: {
                ...node.data,
                ...changes,
              },
            }
          : node
      )
    );
  }

  function updateSelectedShape(shape: BlockShape) {
    if (selectedNodes.length === 0) return;

    saveHistory();

    setNodes((current) =>
      current.map((node) =>
        node.selected && node.data.elementKind === 'shape'
          ? {
              ...node,
              data: {
                ...node.data,
                shape,
              },
            }
          : node
      )
    );
  }

  function updateSelectedEdges(color?: string, width?: number) {
    if (selectedEdges.length === 0) return;

    saveHistory();

    setEdges((current) =>
      current.map((edge) =>
        edge.selected
          ? {
              ...edge,
              style: {
                ...edge.style,
                stroke: color ?? edge.style?.stroke ?? '#333333',
                strokeWidth: width ?? edge.style?.strokeWidth ?? 2,
              },
            }
          : edge
      )
    );
  }

  function handleElementDragStart(
    event: DragEvent<HTMLDivElement>,
    payload: DragPayload
  ) {
    draggingPayload.current = payload;

    event.dataTransfer.setData(
      'application/locus-element',
      JSON.stringify(payload)
    );

    event.dataTransfer.effectAllowed = 'copy';
  }

  function handleElementDragEnd() {
    draggingPayload.current = null;
    setDragPreview(null);
  }

  function readDragPayload(event: DragEvent): DragPayload | null {
    if (draggingPayload.current) {
      return draggingPayload.current;
    }

    const raw = event.dataTransfer.getData('application/locus-element');
    if (!raw) return null;

    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  }

  function getDropPosition(
    event: DragEvent,
    payload: DragPayload
  ) {
    if (!reactFlowInstance) return null;

    const point = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const width = payload.kind === 'text' ? TEXT_WIDTH : SHAPE_SIZE;
    const height = payload.kind === 'text' ? TEXT_HEIGHT : SHAPE_SIZE;

    return {
      x: point.x - width / 2,
      y: point.y - height / 2,
    };
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';

    const payload = draggingPayload.current;

    if (!payload || !reactFlowInstance) return;

    const position = getDropPosition(event, payload);
    if (!position) return;

    setDragPreview({
      payload,
      position,
    });
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    const payload = readDragPayload(event);

    if (!payload || !reactFlowInstance) return;

    const position = getDropPosition(event, payload);
    if (!position) return;

    saveHistory();

    const newNode: Node<BlockData> =
      payload.kind === 'text'
        ? {
            id: crypto.randomUUID(),
            type: 'editable',
            position,
            style: {
              width: TEXT_WIDTH,
              height: TEXT_HEIGHT,
            },
            data: {
              ...createBlockData('Novo texto', 'text'),
              connectionMode: false,
            },
          }
        : {
            id: crypto.randomUUID(),
            type: 'editable',
            position,
            style: {
              width: SHAPE_SIZE,
              height: SHAPE_SIZE,
            },
            data: {
              ...createBlockData('Novo conceito', 'shape'),
              shape: payload.shape,
              connectionMode: isConnecting,
            },
          };

    setNodes((current) => [...current, newNode]);
    draggingPayload.current = null;
    setDragPreview(null);
  }

  const previewNode = useMemo<Node<BlockData> | null>(() => {
    if (!dragPreview) return null;

    const isText = dragPreview.payload.kind === 'text';

    const data: BlockData = isText
      ? {
          ...createBlockData('Novo texto', 'text'),
          isPreview: true,
          connectionMode: false,
        }
      : {
          ...createBlockData('Novo conceito', 'shape'),
          shape:
            dragPreview.payload.kind === 'shape'
              ? dragPreview.payload.shape
              : 'square',
          isPreview: true,
          connectionMode: false,
        };

    return {
      id: '__drag_preview__',
      type: 'editable',
      position: dragPreview.position,
      selectable: false,
      draggable: false,
      connectable: false,
      style: {
        width: isText ? TEXT_WIDTH : SHAPE_SIZE,
        height: isText ? TEXT_HEIGHT : SHAPE_SIZE,
        opacity: 0.38,
        pointerEvents: 'none',
      },
      data,
    };
  }, [dragPreview]);

  const renderedNodes = previewNode
    ? [...nodes, previewNode]
    : nodes;

  function chooseNestedContent(contentType: ContentType) {
    if (!enteringNode) return;

    onEnterBlock(
      enteringNode.data.label,
      getRelatedNames(enteringNode.id),
      contentType
    );

    setEnteringNode(null);
  }

  return (
    <div className="mindmap-page">
      <MindMapHeader
        breadcrumb={breadcrumb}
        onBack={onBack}
      />

      <MindMapSidebar
        open={sidebarOpen}
        isConnecting={isConnecting}
        selectedNodes={selectedNodes}
        selectedEdges={selectedEdges}
        onToggle={() => setSidebarOpen((current) => !current)}
        onToggleConnection={toggleConnectionMode}
        onDragStart={handleElementDragStart}
        onDragEnd={handleElementDragEnd}
        onEnterNode={setEnteringNode}
        onUpdateBlocks={updateSelectedBlocks}
        onUpdateShape={updateSelectedShape}
        onUpdateEdges={updateSelectedEdges}
      />

      {breadcrumb.length > 2 && (
        <RelatedSidebar relatedNames={relatedNames} />
      )}

      <ReactFlow
        nodes={renderedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={setReactFlowInstance}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeDragStart={saveHistory}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Straight}
        multiSelectionKeyCode="Shift"
        deleteKeyCode={null}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>

      {enteringNode && (
        <EnterBlockModal
          node={enteringNode}
          onClose={() => setEnteringNode(null)}
          onChoose={chooseNestedContent}
        />
      )}
    </div>
  );
}
