import type { MindMapData, StoredMindMapData } from './mindMapTypes';

const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api';

export type StoredMindMap = {
  id: number;
  titulo: string;
  dados: StoredMindMapData;
  data_criacao: string;
  data_atualizacao: string;
};

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

export async function createMindMap(
  titulo: string,
  dados: MindMapData
): Promise<StoredMindMap> {
  const response = await fetch(`${API_URL}/mapas-mentais/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo, dados }),
  });

  return readJson<StoredMindMap>(response);
}

export async function updateMindMap(
  id: number,
  titulo: string,
  dados: MindMapData
): Promise<StoredMindMap> {
  const response = await fetch(`${API_URL}/mapas-mentais/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo, dados }),
  });

  return readJson<StoredMindMap>(response);
}

export async function renameMindMap(
  id: number,
  titulo: string
): Promise<StoredMindMap> {
  const response = await fetch(`${API_URL}/mapas-mentais/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo }),
  });

  return readJson<StoredMindMap>(response);
}

export async function deleteMindMap(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/mapas-mentais/${id}/`, {
    method: 'DELETE',
  });

  await ensureOk(response);
}

export async function loadMindMap(id: number): Promise<StoredMindMap> {
  const response = await fetch(`${API_URL}/mapas-mentais/${id}/`);
  return readJson<StoredMindMap>(response);
}

export async function listMindMaps(): Promise<StoredMindMap[]> {
  const response = await fetch(`${API_URL}/mapas-mentais/`);
  return readJson<StoredMindMap[]>(response);
}
