import { useEditorState, type Editor } from "@tiptap/react";
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, RemoveFormatting } from "lucide-react";

export default function AnotacaoToolbar({ editor }: { editor: Editor | null }) {
  const formato = useEditorState({
    editor,
    selector: ({ editor: atual }) => ({
      fonte: atual?.getAttributes("textStyle").fontFamily || "Arial",
      tamanho: atual?.getAttributes("textStyle").fontSize || "",
      negrito: atual?.isActive("bold") ?? false,
      italico: atual?.isActive("italic") ?? false,
      sublinhado: atual?.isActive("underline") ?? false,
    }),
  });
  if (!editor || !formato) return null;

  return (
    <div className="note-toolbar" aria-label="Formatação de texto"
      onMouseDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) event.preventDefault();
      }}
    >
      <button
        type="button"
        aria-label="Texto normal" title="Texto normal"
        onClick={() =>
          editor.chain().focus().clearNodes().unsetAllMarks().run()
        }
      >
        <RemoveFormatting className="note-toolbar__icon" size={18} aria-hidden="true" />
      </button>

      <button
        type="button"
        className={formato.negrito ? "is-active" : ""}
        aria-label="Negrito" title="Negrito" aria-pressed={formato.negrito}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="note-toolbar__icon" size={18} aria-hidden="true" />
        <span className="note-toolbar__label">Negrito</span>
      </button>

      <button
        type="button"
        className={formato.sublinhado ? "is-active" : ""}
        aria-label="Sublinhado" title="Sublinhado" aria-pressed={formato.sublinhado}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="note-toolbar__icon" size={18} aria-hidden="true" />
        <span className="note-toolbar__label">Sublinhado</span>
      </button>

      <button
        type="button"
        className={formato.italico ? "is-active" : ""}
        aria-label="Itálico" title="Itálico" aria-pressed={formato.italico}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="note-toolbar__icon" size={18} aria-hidden="true" />
        <span className="note-toolbar__label">Itálico</span>
      </button>

      <button
        type="button"
        aria-label="Alinhar à esquerda" title="Esquerda"
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft className="note-toolbar__icon" size={18} aria-hidden="true" />
        <span className="note-toolbar__label">Esquerda</span>
      </button>

      <button
        type="button"
        aria-label="Centralizar texto" title="Centro"
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="note-toolbar__icon" size={18} aria-hidden="true" />
        <span className="note-toolbar__label">Centro</span>
      </button>

      <button
        type="button"
        aria-label="Alinhar à direita" title="Direita"
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="note-toolbar__icon" size={18} aria-hidden="true" />
        <span className="note-toolbar__label">Direita</span>
      </button>

      <select
        aria-label="Fonte"
        value={formato.fonte}
        onChange={(event) =>
          editor.chain().focus().setFontFamily(event.target.value).run()
        }
      >
        <option value="Arial">Arial</option>
        <option value="Georgia">Georgia</option>
        <option value="Verdana">Verdana</option>
        <option value="Tahoma">Tahoma</option>
      </select>

      <select
        aria-label="Tamanho da fonte" title="Tamanho da fonte"
        value={formato.tamanho}
        onChange={(event) => {
          const tamanho = event.target.value;
          if (tamanho) editor.chain().focus().setFontSize(tamanho).run();
          else editor.chain().focus().unsetFontSize().run();
        }}
      >
        <option value="">Padrão</option>
        {[12, 14, 16, 18, 24, 32, 48].map((tamanho) => (
          <option key={tamanho} value={`${tamanho}px`}>{tamanho} px</option>
        ))}
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
