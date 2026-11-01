import type { Edge, Node } from '@xyflow/react';

export type FormatoBloco =
  | 'square'
  | 'circle'
  | 'triangle'
  | 'octagon'
  | 'star';

export type TipoConteudo = 'annotation' | 'mindmap';

export type DadosBloco = {
  label: string;
  elementKind: 'shape' | 'text';
  shape: FormatoBloco;
  connectionMode: boolean;

  /** Tipo escolhido para o conteúdo deste bloco. Depois de definido, não muda. */
  linkedContentType?: TipoConteudo;

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

export type VisaoMapaMental = {
  title: string;
  nodes: Node<DadosBloco>[];
  edges: Edge[];
};

/**
 * Um único registro de MapaMental contém todas as telas internas.
 * Cada bloco pode apontar para outra view por linkedViewId.
 */
export type DadosMapaMental = {
  rootViewId: string;
  views: Record<string, VisaoMapaMental>;
};

