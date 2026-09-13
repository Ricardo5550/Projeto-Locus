import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { BlockData, BlockShape } from './mindMapTypes';

type EditableNode = Node<BlockData, 'editable'>;

type Point = {
  x: number;
  y: number;
};

const SHAPE_POINTS: Record<
  Exclude<BlockShape, 'square' | 'circle'>,
  Point[]
> = {
  triangle: [
    { x: 50, y: 4 },
    { x: 96, y: 94 },
    { x: 4, y: 94 },
  ],

  octagon: [
    { x: 30, y: 4 },
    { x: 70, y: 4 },
    { x: 96, y: 30 },
    { x: 96, y: 70 },
    { x: 70, y: 96 },
    { x: 30, y: 96 },
    { x: 4, y: 70 },
    { x: 4, y: 30 },
  ],

  star: [
    { x: 50, y: 3 },
    { x: 61, y: 36 },
    { x: 96, y: 36 },
    { x: 68, y: 57 },
    { x: 79, y: 93 },
    { x: 50, y: 72 },
    { x: 21, y: 93 },
    { x: 32, y: 57 },
    { x: 4, y: 36 },
    { x: 39, y: 36 },
  ],
};

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointTowards(from: Point, to: Point, amount: number): Point {
  const length = distance(from, to);

  if (length === 0) {
    return from;
  }

  const ratio = Math.min(amount / length, 0.45);

  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

function roundedPolygonPath(points: Point[], radius: number) {
  if (radius <= 0) {
    return `${points
      .map((point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
      )
      .join(' ')} Z`;
  }

  const cornerRadius = Math.min(radius, 18);

  const starts = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    return pointTowards(point, previous, cornerRadius);
  });

  const ends = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return pointTowards(point, next, cornerRadius);
  });

  let path = `M ${starts[0].x} ${starts[0].y}`;

  points.forEach((point, index) => {
    path += ` Q ${point.x} ${point.y} ${ends[index].x} ${ends[index].y}`;

    const nextIndex = (index + 1) % points.length;

    if (nextIndex !== 0) {
      path += ` L ${starts[nextIndex].x} ${starts[nextIndex].y}`;
    }
  });

  return `${path} Z`;
}

function Shape({
  data,
}: {
  data: BlockData;
}) {
  const common = {
    fill: data.backgroundColor,
    stroke: data.borderColor,
    strokeWidth: data.borderWidth,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  if (data.shape === 'square') {
    return (
      <svg
        className="mindmap-block__shape"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="98"
          height="98"
          rx={Math.min(data.borderRadius, 50)}
          ry={Math.min(data.borderRadius, 50)}
          {...common}
        />
      </svg>
    );
  }

  if (data.shape === 'circle') {
    return (
      <svg
        className="mindmap-block__shape"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ellipse
          cx="50"
          cy="50"
          rx="49"
          ry="49"
          {...common}
        />
      </svg>
    );
  }

  const points = SHAPE_POINTS[data.shape];

  return (
    <svg
      className="mindmap-block__shape"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={roundedPolygonPath(points, data.borderRadius)}
        strokeLinejoin="round"
        {...common}
      />
    </svg>
  );
}

export default function EditableBlock({
  id,
  data,
  selected,
}: NodeProps<EditableNode>) {
  const { updateNodeData } = useReactFlow();
  const isText = data.elementKind === 'text';

  const textStyle: CSSProperties = {
    color: data.textColor,
    fontFamily: data.fontFamily,
    fontSize: data.fontSize,
    fontWeight: data.bold ? 700 : 400,
    fontStyle: data.italic ? 'italic' : 'normal',
    textDecoration: data.strike ? 'line-through' : 'none',
    textAlign: data.textAlign,
    lineHeight: 1.2,
    height: `${Math.max(1, data.label.split('\n').length) * data.fontSize * 1.2}px`,
  };

  return (
    <div className={`mindmap-block ${isText ? 'is-text' : ''}`}>
      <NodeResizer
        isVisible={selected}
        minWidth={isText ? 120 : 70}
        minHeight={isText ? 60 : 70}
        keepAspectRatio={false}
        lineClassName="mindmap-resizer__line"
        handleClassName="mindmap-resizer__handle"
      />

      {!isText && <Shape data={data} />}

      <div className={`mindmap-block__text is-${data.verticalAlign}`}>
        <textarea
          className="nodrag"
          value={data.label}
          onChange={(event) =>
            updateNodeData(id, { label: event.target.value })
          }
          style={textStyle}
          rows={1}
          aria-label="Texto do bloco"
        />
      </div>

      {!isText && (
        <Handle
          id="connection"
          type="source"
          position={Position.Right}
          className="mindmap-block__handle"
          isConnectable={data.connectionMode}
          style={{
            opacity: data.connectionMode ? 1 : 0,
            pointerEvents: data.connectionMode ? 'all' : 'none',
          }}
        />
      )}
    </div>
  );
}
