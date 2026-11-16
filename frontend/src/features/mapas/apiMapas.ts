import { apiJson } from "../../services/apiClient";
import type { DadosMapaMental } from "./tiposMapa";

export type MapaMentalSalvo = {
  id: string;
  pasta: string | null;
  titulo: string;
  dados: DadosMapaMental;
  autor: string | null;
  data_criacao: string;
  data_atualizacao: string;
};

export function criarMapaMental(
  titulo: string,
  dados: DadosMapaMental,
  pasta: string | null = null,
): Promise<MapaMentalSalvo> {
  return apiJson<MapaMentalSalvo>("/mapas-mentais/", {
    method: "POST",
    body: JSON.stringify({ titulo, dados, pasta }),
  });
}

export function atualizarMapaMental(
  id: string,
  titulo: string,
  dados: DadosMapaMental,
  versao: string,
): Promise<MapaMentalSalvo> {
  return apiJson<MapaMentalSalvo>(`/mapas-mentais/${id}/`, {
    method: "PUT",
    body: JSON.stringify({ titulo, dados, versao }),
  });
}

export function renomearMapaMental(
  id: string,
  titulo: string,
): Promise<MapaMentalSalvo> {
  return apiJson<MapaMentalSalvo>(`/mapas-mentais/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ titulo }),
  });
}

export function excluirMapaMental(
  id: string,
  modo: "excluir_tudo" | "manter_anotacoes",
): Promise<{ pasta_id: string | null }> {
  return apiJson(`/mapas-mentais/${id}/?modo=${modo}`, { method: "DELETE" });
}

export function carregarMapaMental(id: string): Promise<MapaMentalSalvo> {
  return apiJson<MapaMentalSalvo>(`/mapas-mentais/${id}/`);
}

export function listarMapasMentais(): Promise<MapaMentalSalvo[]> {
  return apiJson<MapaMentalSalvo[]>("/mapas-mentais/");
}
