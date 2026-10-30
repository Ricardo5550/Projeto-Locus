import { apiJson } from '../../services/apiClient';
import type { MindMapData } from './mindMapTypes';

export type StoredMindMap = {
  id: number;
  pasta: number | null;
  titulo: string;
  dados: MindMapData;
  autor: number | null;
  data_criacao: string;
  data_atualizacao: string;
};

export function createMindMap(
  titulo: string,
  dados: MindMapData,
  pasta: number | null = null
): Promise<StoredMindMap> {
  return apiJson<StoredMindMap>('/mapas-mentais/', {
    method: 'POST',
    body: JSON.stringify({ titulo, dados, pasta }),
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

export function deleteMindMap(id: number, modo: 'excluir_tudo' | 'manter_anotacoes'): Promise<{pasta_id:number|null}> {
  return apiJson(`/mapas-mentais/${id}/?modo=${modo}`, { method: 'DELETE' });
}

export function loadMindMap(id: number): Promise<StoredMindMap> {
  return apiJson<StoredMindMap>(`/mapas-mentais/${id}/`);
}

export function listMindMaps(): Promise<StoredMindMap[]> {
  return apiJson<StoredMindMap[]>('/mapas-mentais/');
}
