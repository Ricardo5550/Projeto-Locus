import type { ChangeEvent } from 'react';
import PageHeader from '../../components/PageHeader';
import type { Editor } from '@tiptap/react';

 type AnotacaoHeaderProps = {
  title: string;
  setTitle: (value: string) => void;
  editor: Editor | null;
  status: string;
  onBack: () => void;
  onHome: () => void;
  onSave: () => void;
};

export default function AnotacaoHeader({
  title,
  setTitle,
  editor,
  status,
  onBack,
  onHome,
  onSave,
}: AnotacaoHeaderProps) {
  function insertImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !editor) return;

    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      alert('Selecione uma imagem PNG, JPEG, GIF ou WebP.');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 3 MB. A anotação inteira deve ter até 5 MB.');
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
      title={title} onTitleChange={setTitle} onBack={onBack} onHome={onHome} status={status}
      titleLabel="Nome da anotação" placeholder="Digite o título da anotação..." maxLength={100}
      actions={<>
        <label className="page-action">
          Inserir imagem
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={insertImage} hidden />
        </label>
        <button type="button" className="page-action is-primary" onClick={onSave}>Salvar</button>
      </>}
    />
  );
}
