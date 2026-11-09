import type { Edge, Node } from '@xyflow/react';
import { Trash2 } from 'lucide-react';

import type {
  DadosBloco,
  FormatoBloco,
} from './tiposMapa';

type MapaMentalEditorProps = {
  selectedNode?: Node<DadosBloco>;
  selectedEdge?: Edge;

  onUpdateNode: (
    changes: Partial<DadosBloco>
  ) => void;

  onUpdateEdge: (
    color?: string,
    width?: number
  ) => void;

  onEnter: () => void;
  onDelete: () => void;
};

export default function MapaMentalEditor({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
  onEnter,
  onDelete,
}: MapaMentalEditorProps) {
  if (!selectedNode && !selectedEdge) {
    return null;
  }

  return (
    <>
      {selectedNode && (
        <BlocoEditor
          node={selectedNode}
          onUpdate={onUpdateNode}
          onEnter={onEnter}
        />
      )}

      {selectedEdge && (
        <ConexaoEditor
          edge={selectedEdge}
          onUpdate={onUpdateEdge}
        />
      )}

      <button
        type="button"
        className="mindmap-editor__delete"
        onClick={onDelete}
      >
        <Trash2 size={16} />
        Excluir selecionado
      </button>
    </>
  );
}

type BlocoEditorProps = {
  node: Node<DadosBloco>;

  onUpdate: (
    changes: Partial<DadosBloco>
  ) => void;

  onEnter: () => void;
};

function BlocoEditor({
  node,
  onUpdate,
  onEnter,
}: BlocoEditorProps) {
  const data = node.data;

  return (
    <div className="mindmap-editor">
      <h3>
        {data.elementKind === 'text'
          ? 'Editar texto'
          : 'Editar forma'}
      </h3>

      {data.elementKind === 'shape' && (
        <>
          <button
            type="button"
            className="mindmap-editor__enter"
            onClick={onEnter}
          >
            Entrar no bloco
          </button>

          {(data.linkedViewId ||
            data.linkedAnnotationId) && (
            <small className="mindmap-editor__linked">
              Conteúdo associado a este bloco.
            </small>
          )}
        </>
      )}

      <label>
        Fonte

        <select
          value={data.fontFamily}
          onChange={(event) =>
            onUpdate({
              fontFamily: event.target.value,
            })
          }
        >
          <option>Arial</option>
          <option>Verdana</option>
          <option>Georgia</option>
          <option>Tahoma</option>
        </select>
      </label>

      <label>
        Tamanho

        <input
          type="number"
          min="8"
          max="72"
          value={data.fontSize}
          onChange={(event) =>
            onUpdate({
              fontSize: Number(
                event.target.value
              ),
            })
          }
        />
      </label>

      <label>
        Cor do texto

        <input
          type="color"
          value={data.textColor}
          onChange={(event) =>
            onUpdate({
              textColor: event.target.value,
            })
          }
        />
      </label>

      <div className="mindmap-editor__checks">
        <label>
          <input
            type="checkbox"
            checked={data.bold}
            onChange={(event) =>
              onUpdate({
                bold: event.target.checked,
              })
            }
          />
          Negrito
        </label>

        <label>
          <input
            type="checkbox"
            checked={data.italic}
            onChange={(event) =>
              onUpdate({
                italic: event.target.checked,
              })
            }
          />
          Itálico
        </label>

        <label>
          <input
            type="checkbox"
            checked={data.strike}
            onChange={(event) =>
              onUpdate({
                strike: event.target.checked,
              })
            }
          />
          Tachado
        </label>
      </div>

      {data.elementKind === 'shape' && (
        <>
          <label>
            Formato

            <select
              value={data.shape}
              onChange={(event) =>
                onUpdate({
                  shape:
                    event.target.value as FormatoBloco,
                })
              }
            >
              <option value="square">
                Quadrado
              </option>
              <option value="circle">
                Círculo
              </option>
              <option value="triangle">
                Triângulo
              </option>
              <option value="octagon">
                Octógono
              </option>
              <option value="star">
                Estrela
              </option>
            </select>
          </label>

          <label>
            Cor da forma

            <input
              type="color"
              value={data.backgroundColor}
              onChange={(event) =>
                onUpdate({
                  backgroundColor:
                    event.target.value,
                })
              }
            />
          </label>

          <label>
            Cor da borda

            <input
              type="color"
              value={data.borderColor}
              onChange={(event) =>
                onUpdate({
                  borderColor:
                    event.target.value,
                })
              }
            />
          </label>

          <RangeField
            label="Espessura da borda"
            min={0}
            max={12}
            value={data.borderWidth}
            onChange={(borderWidth) =>
              onUpdate({ borderWidth })
            }
          />

          <RangeField
            label="Arredondamento"
            min={0}
            max={50}
            value={data.borderRadius}
            onChange={(borderRadius) =>
              onUpdate({ borderRadius })
            }
          />
        </>
      )}
    </div>
  );
}

type ConexaoEditorProps = {
  edge: Edge;

  onUpdate: (
    color?: string,
    width?: number
  ) => void;
};

function ConexaoEditor({
  edge,
  onUpdate,
}: ConexaoEditorProps) {
  return (
    <div className="mindmap-editor">
      <h3>Conexão</h3>

      <label>
        Cor da linha

        <input
          type="color"
          value={
            typeof edge.style?.stroke === 'string'
              ? edge.style.stroke
              : '#333333'
          }
          onChange={(event) =>
            onUpdate(event.target.value)
          }
        />
      </label>

      <label>
        Espessura

        <input
          type="range"
          min="1"
          max="10"
          value={
            Number(edge.style?.strokeWidth) || 2
          }
          onChange={(event) =>
            onUpdate(
              undefined,
              Number(event.target.value)
            )
          }
        />
      </label>
    </div>
  );
}

type RangeFieldProps = {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
};

function RangeField({
  label,
  min,
  max,
  value,
  onChange,
}: RangeFieldProps) {
  return (
    <label>
      {label}

      <div className="mindmap-editor__range">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) =>
            onChange(Number(event.target.value))
          }
        />

        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) =>
            onChange(Number(event.target.value))
          }
        />
      </div>
    </label>
  );
}