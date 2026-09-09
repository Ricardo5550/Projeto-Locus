import type { Node } from '@xyflow/react';
import type { BlockData, ContentType } from '../mindMapTypes';

type EnterBlockModalProps = {
  node: Node<BlockData>;
  onClose: () => void;
  onChoose: (type: ContentType) => void;
};

export default function EnterBlockModal({
  node,
  onClose,
  onChoose,
}: EnterBlockModalProps) {
  return (
    <div className="enter-block-modal" onClick={onClose}>
      <div
        className="enter-block-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="enter-block-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="enter-block-modal__eyebrow">
          {node.data.label}
        </span>

        <h2 id="enter-block-title">O que deseja criar?</h2>

        <div className="enter-block-modal__options">
          <button
            className="enter-block-modal__option"
            type="button"
            onClick={() => onChoose('annotation')}
          >
            <div className="enter-block-modal__preview enter-block-modal__preview--note">
              ≡
            </div>
            <strong>Anotação</strong>
          </button>

          <button
            className="enter-block-modal__option"
            type="button"
            onClick={() => onChoose('mindmap')}
          >
            <div className="enter-block-modal__preview">
              □ ─ ○
            </div>
            <strong>Mapa mental</strong>
          </button>
        </div>

        <button
          className="enter-block-modal__cancel"
          type="button"
          onClick={onClose}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
