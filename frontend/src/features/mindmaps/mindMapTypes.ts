import type { Edge, Node } from '@xyflow/react';

export type BlockShape =
  | 'square'
  | 'circle'
  | 'triangle'
  | 'octagon'
  | 'star';

export type ElementKind = 'shape' | 'text';
export type TextAlignMode = 'left' | 'center' | 'right';
export type VerticalAlignMode = 'top' | 'center' | 'bottom';
export type ContentType = 'annotation' | 'mindmap';

export type BlockData = {
  label: string;
  elementKind: ElementKind;
  connectionMode: boolean;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  textAlign: TextAlignMode;
  verticalAlign: VerticalAlignMode;
  backgroundColor: string;
  shape: BlockShape;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  isPreview?: boolean;
};

export type DragPayload =
  | { kind: 'shape'; shape: BlockShape }
  | { kind: 'text' };

export type HistoryState = {
  nodes: Node<BlockData>[];
  edges: Edge[];
};

export type ClipboardState = HistoryState;

export type MindMapProps = {
  onBack: () => void;
  breadcrumb: string[];
  relatedNames?: string[];
  onEnterBlock: (
    blockName: string,
    relatedNames: string[],
    contentType: ContentType
  ) => void;
};
