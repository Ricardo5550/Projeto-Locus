import type { DragEvent } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type {
  BlockData,
  BlockShape,
  DragPayload,
  TextAlignMode,
  VerticalAlignMode,
} from '../mindMapTypes';

type MindMapSidebarProps = {
  open: boolean;
  isConnecting: boolean;
  selectedNodes: Node<BlockData>[];
  selectedEdges: Edge[];
  onToggle: () => void;
  onToggleConnection: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, payload: DragPayload) => void;
  onDragEnd: () => void;
  onEnterNode: (node: Node<BlockData>) => void;
  onUpdateBlocks: (changes: Partial<BlockData>) => void;
  onUpdateShape: (shape: BlockShape) => void;
  onUpdateEdges: (color?: string, width?: number) => void;
};

const shapes: Array<[BlockShape, string, string]> = [
  ['square', '□', 'Quadrado'],
  ['circle', '○', 'Círculo'],
  ['triangle', '△', 'Triângulo'],
  ['octagon', '⯃', 'Octógono'],
  ['star', '☆', 'Estrela'],
];

export default function MindMapSidebar({
  open,
  isConnecting,
  selectedNodes,
  selectedEdges,
  onToggle,
  onToggleConnection,
  onDragStart,
  onDragEnd,
  onEnterNode,
  onUpdateBlocks,
  onUpdateShape,
  onUpdateEdges,
}: MindMapSidebarProps) {
  const firstSelectedNode = selectedNodes[0];
  const firstSelectedEdge = selectedEdges[0];

  return (
    <aside className={`mindmap-sidebar ${open ? 'mindmap-sidebar--open' : ''}`}>
      <button
        className="mindmap-sidebar__toggle"
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Fechar painel' : 'Abrir painel'}
      >
        {open ? '←' : '☰'}
      </button>

      {open && (
        <div className="mindmap-sidebar__content">
          <hr />

          <h4 className="mindmap-sidebar__section-title">Elementos</h4>

          <div className="mindmap-sidebar__palette">
            {shapes.map(([shape, symbol, title]) => (
              <div
                key={shape}
                className="mindmap-sidebar__palette-item"
                draggable
                title={title}
                onDragStart={(event) =>
                  onDragStart(event, { kind: 'shape', shape })
                }
                onDragEnd={onDragEnd}
              >
                {symbol}
              </div>
            ))}

            <div
              className="mindmap-sidebar__palette-item mindmap-sidebar__palette-text"
              draggable
              title="Texto"
              onDragStart={(event) => onDragStart(event, { kind: 'text' })}
              onDragEnd={onDragEnd}
            >
              T
            </div>
          </div>

          <button
            className={`mindmap-sidebar__connect ${
              isConnecting ? 'mindmap-sidebar__connect--active' : ''
            }`}
            type="button"
            onClick={onToggleConnection}
          >
            {isConnecting ? '✓ Conectando' : 'Associar elementos'}
          </button>

          <hr />

          {!firstSelectedNode && !firstSelectedEdge && (
            <p className="mindmap-sidebar__hint">
              Selecione um elemento para editar.
            </p>
          )}

          {firstSelectedNode && (
            <NodeEditor
              node={firstSelectedNode}
              onlyOneSelected={selectedNodes.length === 1}
              onEnterNode={onEnterNode}
              onUpdateBlocks={onUpdateBlocks}
              onUpdateShape={onUpdateShape}
            />
          )}

          {firstSelectedEdge && (
            <EdgeEditor
              edge={firstSelectedEdge}
              onUpdateEdges={onUpdateEdges}
            />
          )}
        </div>
      )}
    </aside>
  );
}

type NodeEditorProps = {
  node: Node<BlockData>;
  onlyOneSelected: boolean;
  onEnterNode: (node: Node<BlockData>) => void;
  onUpdateBlocks: (changes: Partial<BlockData>) => void;
  onUpdateShape: (shape: BlockShape) => void;
};

function NodeEditor({
  node,
  onlyOneSelected,
  onEnterNode,
  onUpdateBlocks,
  onUpdateShape,
}: NodeEditorProps) {
  const data = node.data;

  return (
    <section className="mindmap-editor-panel">
      <h3>{data.elementKind === 'text' ? 'Editar texto' : 'Editar forma'}</h3>

      {onlyOneSelected && data.elementKind === 'shape' && (
        <button
          className="mindmap-editor-panel__enter"
          type="button"
          onClick={() => onEnterNode(node)}
        >
          Entrar no bloco
        </button>
      )}

      <label className="mindmap-field">
        <span>Fonte</span>
        <select
          value={data.fontFamily}
          onChange={(event) =>
            onUpdateBlocks({ fontFamily: event.target.value })
          }
        >
          <option value="Arial">Arial</option>
          <option value="Verdana">Verdana</option>
          <option value="Georgia">Georgia</option>
          <option value="Tahoma">Tahoma</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
        </select>
      </label>

      <label className="mindmap-field">
        <span>Tamanho da fonte</span>
        <input
          type="number"
          min="8"
          max="72"
          value={data.fontSize}
          onChange={(event) =>
            onUpdateBlocks({ fontSize: Number(event.target.value) })
          }
        />
      </label>

      <label className="mindmap-field">
        <span>Cor do texto</span>
        <input
          className="mindmap-color-input"
          type="color"
          value={data.textColor}
          onChange={(event) =>
            onUpdateBlocks({ textColor: event.target.value })
          }
        />
      </label>

      <div className="mindmap-checks">
        <label>
          <input
            type="checkbox"
            checked={data.bold}
            onChange={(event) =>
              onUpdateBlocks({ bold: event.target.checked })
            }
          />
          Negrito
        </label>

        <label>
          <input
            type="checkbox"
            checked={data.italic}
            onChange={(event) =>
              onUpdateBlocks({ italic: event.target.checked })
            }
          />
          Itálico
        </label>

        <label>
          <input
            type="checkbox"
            checked={data.strike}
            onChange={(event) =>
              onUpdateBlocks({ strike: event.target.checked })
            }
          />
          Tachado
        </label>
      </div>

      <div className="mindmap-two-columns">
        <label className="mindmap-field">
          <span>Alinhamento</span>
          <select
            value={data.textAlign}
            onChange={(event) =>
              onUpdateBlocks({
                textAlign: event.target.value as TextAlignMode,
              })
            }
          >
            <option value="left">Esquerda</option>
            <option value="center">Centro</option>
            <option value="right">Direita</option>
          </select>
        </label>

        <label className="mindmap-field">
          <span>Posição</span>
          <select
            value={data.verticalAlign}
            onChange={(event) =>
              onUpdateBlocks({
                verticalAlign: event.target.value as VerticalAlignMode,
              })
            }
          >
            <option value="top">Topo</option>
            <option value="center">Centro</option>
            <option value="bottom">Base</option>
          </select>
        </label>
      </div>

      {data.elementKind === 'shape' && (
        <>
          <hr />

          <label className="mindmap-field">
            <span>Formato</span>
            <select
              value={data.shape}
              onChange={(event) =>
                onUpdateShape(event.target.value as BlockShape)
              }
            >
              <option value="square">Quadrado</option>
              <option value="circle">Círculo</option>
              <option value="triangle">Triângulo</option>
              <option value="octagon">Octógono</option>
              <option value="star">Estrela</option>
            </select>
          </label>

          <label className="mindmap-field">
            <span>Cor da forma</span>
            <input
              className="mindmap-color-input"
              type="color"
              value={data.backgroundColor}
              onChange={(event) =>
                onUpdateBlocks({ backgroundColor: event.target.value })
              }
            />
          </label>

          <label className="mindmap-field">
            <span>Cor da borda</span>
            <input
              className="mindmap-color-input"
              type="color"
              value={data.borderColor}
              onChange={(event) =>
                onUpdateBlocks({ borderColor: event.target.value })
              }
            />
          </label>

          <RangeNumberField
            label="Espessura da borda"
            min={0}
            max={12}
            value={data.borderWidth}
            onChange={(value) => onUpdateBlocks({ borderWidth: value })}
          />

          <RangeNumberField
            label="Arredondamento"
            min={0}
            max={50}
            value={data.borderRadius}
            onChange={(value) => onUpdateBlocks({ borderRadius: value })}
          />
        </>
      )}
    </section>
  );
}

type EdgeEditorProps = {
  edge: Edge;
  onUpdateEdges: (color?: string, width?: number) => void;
};

function EdgeEditor({
  edge,
  onUpdateEdges,
}: EdgeEditorProps) {
  const color =
    typeof edge.style?.stroke === 'string'
      ? edge.style.stroke
      : '#333333';

  const width = Number(edge.style?.strokeWidth) || 2;

  return (
    <section className="mindmap-editor-panel">
      <hr />
      <h3>Conexão</h3>

      <label className="mindmap-field">
        <span>Cor da linha</span>
        <input
          className="mindmap-color-input"
          type="color"
          value={color}
          onChange={(event) => onUpdateEdges(event.target.value)}
        />
      </label>

      <RangeNumberField
        label="Espessura"
        min={1}
        max={10}
        value={width}
        onChange={(value) => onUpdateEdges(undefined, value)}
      />
    </section>
  );
}

type RangeNumberFieldProps = {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
};

function RangeNumberField({
  label,
  min,
  max,
  value,
  onChange,
}: RangeNumberFieldProps) {
  return (
    <label className="mindmap-field">
      <span>{label}</span>
      <div className="mindmap-range-number">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </label>
  );
}