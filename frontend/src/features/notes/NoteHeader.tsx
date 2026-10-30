import type { ChangeEvent } from 'react';
import PageHeader from '../../components/PageHeader';
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
    <PageHeader
      title={title} onTitleChange={setTitle} onBack={onBack} status={status}
      titleLabel="Nome da anotação" placeholder="Digite o título da anotação..." maxLength={100}
      actions={<>
        <label className="page-action">
          Inserir imagem
          <input type="file" accept="image/*" onChange={insertImage} hidden />
        </label>
        <button type="button" className="page-action is-primary" onClick={onSave}>Salvar</button>
      </>}
    />
  );
}
