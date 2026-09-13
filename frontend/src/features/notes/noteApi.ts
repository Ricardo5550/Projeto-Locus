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

const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Erro HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function ensureOk(response: Response): Promise<void> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Erro HTTP ${response.status}`);
  }
}

export async function createNote(
  titulo: string,
  conteudo: NoteContent = EMPTY_NOTE_CONTENT
): Promise<StoredNote> {
  const response = await fetch(`${API_URL}/anotacoes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo, conteudo }),
  });

  return readJson<StoredNote>(response);
}

export async function updateNote(
  id: number,
  titulo: string,
  conteudo: NoteContent
): Promise<StoredNote> {
  const response = await fetch(`${API_URL}/anotacoes/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo, conteudo }),
  });

  return readJson<StoredNote>(response);
}

export async function renameNote(
  id: number,
  titulo: string
): Promise<StoredNote> {
  const response = await fetch(`${API_URL}/anotacoes/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo }),
  });

  return readJson<StoredNote>(response);
}

export async function deleteNote(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/anotacoes/${id}/`, {
    method: 'DELETE',
  });

  await ensureOk(response);
}

export async function loadNote(id: number): Promise<StoredNote> {
  const response = await fetch(`${API_URL}/anotacoes/${id}/`);
  return readJson<StoredNote>(response);
}

export async function listNotes(): Promise<StoredNote[]> {
  const response = await fetch(`${API_URL}/anotacoes/`);
  return readJson<StoredNote[]>(response);
}
