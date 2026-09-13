import type { ChangeEvent } from 'react';
import type { Editor } from '@tiptap/react';

 type NoteHeaderProps = {
  title: string;
  setTitle: (value: string) => void;
  editor: Editor | null;
  status: string;
  onBack: () => void;
  onSave: () => void;
};

export default function NoteHeader({
  title,
  setTitle,
  editor,
  status,
  onBack,
  onSave,
}: NoteHeaderProps) {
  function insertImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !editor) return;

    if (!file.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        editor.chain().focus().setImage({ src: reader.result }).run();
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <header className="note-header">
      <button type="button" className="note-header__back" onClick={onBack}>
        ←
      </button>

      <input
        className="note-header__title"
        type="text"
        placeholder="Digite o título da anotação..."
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <div className="note-header__actions">
        {status && <span className="note-header__status">{status}</span>}

        <label className="note-header__button">
          Inserir imagem
          <input type="file" accept="image/*" onChange={insertImage} hidden />
        </label>

        <button type="button" className="note-header__button is-primary" onClick={onSave}>
          Salvar
        </button>
      </div>
    </header>
  );
}
