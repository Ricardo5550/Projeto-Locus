import type { Edge, Node } from '@xyflow/react';

export type BlockShape =
  | 'square'
  | 'circle'
  | 'triangle'
  | 'octagon'
  | 'star';

export type ContentType = 'annotation' | 'mindmap';

export type BlockData = {
  label: string;
  elementKind: 'shape' | 'text';
  shape: BlockShape;
  connectionMode: boolean;

  /** Tipo escolhido para o conteúdo deste bloco. Depois de definido, não muda. */
  linkedContentType?: ContentType;

  /** ID de uma visão interna do mesmo projeto de mapa mental. */
  linkedViewId?: string;
  linkedAnnotationId?: number;

  fontSize: number;
  fontFamily: string;
  textColor: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'center' | 'bottom';

  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
};

export type MindMapView = {
  title: string;
  nodes: Node<BlockData>[];
  edges: Edge[];
};

/**
 * Um único registro de MapaMental contém todas as telas internas.
 * Cada bloco pode apontar para outra view por linkedViewId.
 */
export type MindMapData = {
  rootViewId: string;
  views: Record<string, MindMapView>;
};

export type StoredMindMapData = MindMapData;