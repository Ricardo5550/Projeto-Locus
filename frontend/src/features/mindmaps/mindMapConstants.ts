import type { Node } from '@xyflow/react';
import type { BlockData, ElementKind } from './mindMapTypes';

export const SHAPE_SIZE = 140;
export const TEXT_WIDTH = 220;
export const TEXT_HEIGHT = 70;

export function createBlockData(
  label: string,
  elementKind: ElementKind = 'shape'
): BlockData {
  return {
    label,
    elementKind,
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
    shape: 'square',
    borderColor: '#333333',
    borderWidth: elementKind === 'text' ? 0 : 1,
    borderRadius: 0,
  };
}

export const initialNodes: Node<BlockData>[] = [
  {
    id: '1',
    type: 'editable',
    position: { x: 300, y: 150 },
    style: { width: SHAPE_SIZE, height: SHAPE_SIZE },
    data: createBlockData('Célula'),
  },
];
