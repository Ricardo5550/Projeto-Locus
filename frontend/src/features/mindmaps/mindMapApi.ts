import { apiJson, apiVoid } from '../../services/apiClient';
import type { MindMapData } from './mindMapTypes';

export type StoredMindMap = {
  id: number;
  titulo: string;
  dados: MindMapData;
  autor: number | null;
  data_criacao: string;
  data_atualizacao: string;
};

export function createMindMap(
  titulo: string,
  dados: MindMapData
): Promise<StoredMindMap> {
  return apiJson<StoredMindMap>('/mapas-mentais/', {
    method: 'POST',
    body: JSON.stringify({ titulo, dados }),
  });
}

export function updateMindMap(
  id: number,
  titulo: string,
  dados: MindMapData
): Promise<StoredMindMap> {
  return apiJson<StoredMindMap>(`/mapas-mentais/${id}/`, {
    method: 'PUT',
    body: JSON.stringify({ titulo, dados }),
  });
}

export function renameMindMap(id: number, titulo: string): Promise<StoredMindMap> {
  return apiJson<StoredMindMap>(`/mapas-mentais/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ titulo }),
  });
}

export function deleteMindMap(id: number): Promise<void> {
  return apiVoid(`/mapas-mentais/${id}/`, { method: 'DELETE' });
}

export function loadMindMap(id: number): Promise<StoredMindMap> {
  return apiJson<StoredMindMap>(`/mapas-mentais/${id}/`);
}

export function listMindMaps(): Promise<StoredMindMap[]> {
  return apiJson<StoredMindMap[]>('/mapas-mentais/');
}
