import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Typography from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';

import NoteHeader from './NoteHeader';
import NoteToolbar from './NoteToolbar';
import {
  createNote,
  EMPTY_NOTE_CONTENT,
  loadNote,
  updateNote,
  type NoteContent,
} from './noteApi';
import './NoteEditor.css';

type NoteEditorProps = {
  noteId: number | null;
  initialTitle: string;
  breadcrumb: string[];
  onBack: () => void;
  onCreated: (id: number, title: string) => void;
};

export default function NoteEditor({
  noteId,
  initialTitle,
  breadcrumb,
  onBack,
  onCreated,
}: NoteEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ allowBase64: true }),
      Typography,
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: EMPTY_NOTE_CONTENT,
  });

  useEffect(() => {
    if (!editor) return;

    if (noteId === null) {
      setTitle(initialTitle);
      editor.commands.setContent(EMPTY_NOTE_CONTENT);
      setStatus('Nova anotação.');
      return;
    }

    setStatus('Carregando...');

    loadNote(noteId)
      .then((note) => {
        setTitle(note.titulo);
        editor.commands.setContent(note.conteudo);
        setStatus('Anotação carregada.');
      })
      .catch((error) => {
        console.error(error);
        setStatus('Erro ao carregar a anotação.');
      });
  }, [editor, noteId, initialTitle]);

  async function handleSave() {
    if (!editor) return;

    const finalTitle = title.trim() || 'Anotação sem título';
    const content = editor.getJSON() as NoteContent;

    try {
      setStatus('Salvando...');

      const saved =
        noteId === null
          ? await createNote(finalTitle, content)
          : await updateNote(noteId, finalTitle, content);

      setTitle(saved.titulo);
      onCreated(saved.id, saved.titulo);
      setStatus('Salvo no banco.');
    } catch (error) {
      console.error(error);
      setStatus('Erro ao salvar. Verifique se o backend está rodando.');
    }
  }

  return (
    <div className="note-editor">
      <NoteHeader
        title={title}
        setTitle={setTitle}
        editor={editor}
        status={status}
        onBack={onBack}
        onSave={handleSave}
      />

      <div className="note-editor__breadcrumb">{breadcrumb.join(' / ')}</div>

      <NoteToolbar editor={editor} />

      <main className="note-editor__scroll">
        <EditorContent editor={editor} className="note-editor__paper" />
      </main>
    </div>
  );
}
