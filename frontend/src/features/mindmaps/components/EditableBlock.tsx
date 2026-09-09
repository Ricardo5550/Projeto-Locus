import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { BlockData, BlockShape } from '../mindMapTypes';
import { roundedPolygonPath, shapePoints } from './shapeGeometry';
import './EditableBlock.css';

type EditableBlockNode = Node<BlockData, 'editable'>;

type ShapeBackgroundProps = {
  shape: BlockShape;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
};

function ShapeBackground({
  shape,
  backgroundColor,
  borderColor,
  borderWidth,
  borderRadius,
}: ShapeBackgroundProps) {
  const common = {
    fill: backgroundColor,
    stroke: borderColor,
    strokeWidth: borderWidth,
    vectorEffect: 'non-scaling-stroke' as const,
    strokeLinejoin: 'round' as const,
  };

  if (shape === 'circle') {
    return <ellipse cx="50" cy="50" rx="47" ry="47" {...common} />;
  }

  if (shape === 'square') {
    return (
      <rect
        x="3"
        y="3"
        width="94"
        height="94"
        rx={Math.min(borderRadius, 50)}
        ry={Math.min(borderRadius, 50)}
        {...common}
      />
    );
  }

  return (
    <path
      d={roundedPolygonPath(shapePoints[shape], borderRadius)}
      {...common}
    />
  );
}

export default function EditableBlock({
  id,
  data,
  selected,
}: NodeProps<EditableBlockNode>) {
  const { updateNodeData, updateNode } =
    useReactFlow<Node<BlockData>, Edge>();

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const isText = data.elementKind === 'text';
  const isPreview = data.isPreview === true;

  useLayoutEffect(() => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';

    const contentHeight = Math.max(
      textarea.scrollHeight,
      isText ? 46 : 34
    );

    textarea.style.height = `${contentHeight}px`;

    if (isText && !isPreview) {
      updateNode(id, {
        style: {
          height: Math.max(contentHeight + 20, 70),
        },
      });
    }
  }, [
    id,
    data.label,
    data.fontSize,
    data.fontFamily,
    data.bold,
    data.italic,
    data.strike,
    isText,
    isPreview,
    updateNode,
  ]);

  const verticalJustify =
    data.verticalAlign === 'top'
      ? 'flex-start'
      : data.verticalAlign === 'bottom'
        ? 'flex-end'
        : 'center';

  const contentStyle = {
    '--block-justify': verticalJustify,
    '--block-inset': isText ? '6px' : '14% 13% 4% 13%',
  } as CSSProperties;

  const textStyle = {
    '--block-text-align': data.textAlign,
    '--block-text-color': data.textColor,
    '--block-font-family': data.fontFamily,
    '--block-font-size': `${data.fontSize}px`,
    '--block-font-weight': data.bold ? '700' : '400',
    '--block-font-style': data.italic ? 'italic' : 'normal',
    '--block-text-decoration': data.strike ? 'line-through' : 'none',
    '--block-text-transform': isText ? 'none' : 'translateY(2px)',
  } as CSSProperties;

  return (
    <div className={`editable-block ${isPreview ? 'editable-block--preview' : ''}`}>
      {!isPreview && (
        <NodeResizer
          isVisible={selected}
          minWidth={isText ? 120 : 70}
          minHeight={isText ? 60 : 70}
          keepAspectRatio={false}
        />
      )}

      {!isText && (
        <svg
          className="editable-block__shape"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <ShapeBackground
            shape={data.shape}
            backgroundColor={data.backgroundColor}
            borderColor={data.borderColor}
            borderWidth={data.borderWidth}
            borderRadius={data.borderRadius}
          />
        </svg>
      )}

      <div className="editable-block__content" style={contentStyle}>
        <textarea
          ref={textAreaRef}
          className={`editable-block__textarea nodrag ${
            isText && selected && !isPreview
              ? 'editable-block__textarea--selected-text'
              : ''
          }`}
          value={data.label}
          readOnly={isPreview}
          onChange={(event) =>
            updateNodeData(id, { label: event.target.value })
          }
          rows={1}
          placeholder={isText ? 'Digite o texto...' : 'Digite o conteúdo...'}
          style={textStyle}
        />
      </div>

      {!isText && !isPreview && (
        <Handle
          className="editable-block__handle"
          type="source"
          position={Position.Right}
          style={{
            opacity: data.connectionMode ? 1 : 0,
            pointerEvents: data.connectionMode ? 'all' : 'none',
          }}
        />
      )}
    </div>
  );
}
