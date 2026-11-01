import { apiJson } from '../../services/apiClient';
import type { DadosMapaMental } from './tiposMapa';

export type MapaMentalSalvo = {
  id: number;
  pasta: number | null;
  titulo: string;
  dados: DadosMapaMental;
  autor: number | null;
  data_criacao: string;
  data_atualizacao: string;
};

export function criarMapaMental(
  titulo: string,
  dados: DadosMapaMental,
  pasta: number | null = null
): Promise<MapaMentalSalvo> {
  return apiJson<MapaMentalSalvo>('/mapas-mentais/', {
    method: 'POST',
    body: JSON.stringify({ titulo, dados, pasta }),
  });
}

export function atualizarMapaMental(
  id: number,
  titulo: string,
  dados: DadosMapaMental,
  versao: string
): Promise<MapaMentalSalvo> {
  return apiJson<MapaMentalSalvo>(`/mapas-mentais/${id}/`, {
    method: 'PUT',
    body: JSON.stringify({ titulo, dados, versao }),
  });
}

export function renomearMapaMental(id: number, titulo: string): Promise<MapaMentalSalvo> {
  return apiJson<MapaMentalSalvo>(`/mapas-mentais/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ titulo }),
  });
}

export function excluirMapaMental(id: number, modo: 'excluir_tudo' | 'manter_anotacoes'): Promise<{pasta_id:number|null}> {
  return apiJson(`/mapas-mentais/${id}/?modo=${modo}`, { method: 'DELETE' });
}

export function carregarMapaMental(id: number): Promise<MapaMentalSalvo> {
  return apiJson<MapaMentalSalvo>(`/mapas-mentais/${id}/`);
}

export function listarMapasMentais(): Promise<MapaMentalSalvo[]> {
  return apiJson<MapaMentalSalvo[]>('/mapas-mentais/');
}
