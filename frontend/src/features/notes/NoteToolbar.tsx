import type { Editor } from '@tiptap/react';

export default function NoteToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  return (
    <div className="note-toolbar" aria-label="Formatação de texto">
      <button
        type="button"
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      >
        Texto normal
      </button>

      <button
        type="button"
        className={editor.isActive('bold') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        Negrito
      </button>

      <button
        type="button"
        className={editor.isActive('italic') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        Itálico
      </button>

      <button
        type="button"
        className={editor.isActive('underline') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        Sublinhado
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        Esquerda
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        Centro
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        Direita
      </button>

      <select
        aria-label="Fonte"
        defaultValue="Arial"
        onChange={(event) =>
          editor.chain().focus().setFontFamily(event.target.value).run()
        }
      >
        <option value="Arial">Arial</option>
        <option value="Georgia">Georgia</option>
        <option value="Verdana">Verdana</option>
        <option value="Tahoma">Tahoma</option>
      </select>

      <label className="note-toolbar__color" title="Cor do texto">
        Cor
        <input
          type="color"
          defaultValue="#24170f"
          onChange={(event) =>
            editor.chain().focus().setColor(event.target.value).run()
          }
        />
      </label>
    </div>
  );
}
