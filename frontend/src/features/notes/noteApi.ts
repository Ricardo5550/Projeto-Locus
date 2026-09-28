import { apiJson, apiVoid } from '../../services/apiClient';

export type NoteContent = any;

export type StoredNote = {
  id: number;
  titulo: string;
  conteudo: NoteContent;
  autor: number | null;
  data_criacao: string;
  data_atualizacao: string;
};

export const EMPTY_NOTE_CONTENT: NoteContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export function createNote(
  titulo: string,
  conteudo: NoteContent = EMPTY_NOTE_CONTENT
): Promise<StoredNote> {
  return apiJson<StoredNote>('/anotacoes/', {
    method: 'POST',
    body: JSON.stringify({ titulo, conteudo }),
  });
}

export function updateNote(
  id: number,
  titulo: string,
  conteudo: NoteContent
): Promise<StoredNote> {
  return apiJson<StoredNote>(`/anotacoes/${id}/`, {
    method: 'PUT',
    body: JSON.stringify({ titulo, conteudo }),
  });
}

export function renameNote(id: number, titulo: string): Promise<StoredNote> {
  return apiJson<StoredNote>(`/anotacoes/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ titulo }),
  });
}

export function deleteNote(id: number): Promise<void> {
  return apiVoid(`/anotacoes/${id}/`, { method: 'DELETE' });
}

export function loadNote(id: number): Promise<StoredNote> {
  return apiJson<StoredNote>(`/anotacoes/${id}/`);
}

export function listNotes(): Promise<StoredNote[]> {
  return apiJson<StoredNote[]>('/anotacoes/');
}
