import { apiJson, apiSemRetorno } from "../../services/apiClient";

export type ConteudoAnotacao = any;

export type AnotacaoSalva = {
  id: string;
  pasta: string | null;
  titulo: string;
  conteudo: ConteudoAnotacao;
  autor: string | null;
  data_criacao: string;
  data_atualizacao: string;
};

export const CONTEUDO_ANOTACAO_VAZIA: ConteudoAnotacao = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function criarAnotacao(
  titulo: string,
  conteudo: ConteudoAnotacao = CONTEUDO_ANOTACAO_VAZIA,
  pasta: string | null = null,
): Promise<AnotacaoSalva> {
  return apiJson<AnotacaoSalva>("/anotacoes/", {
    method: "POST",
    body: JSON.stringify({ titulo, conteudo, pasta }),
  });
}

export function atualizarAnotacao(
  id: string,
  titulo: string,
  conteudo: ConteudoAnotacao,
): Promise<AnotacaoSalva> {
  return apiJson<AnotacaoSalva>(`/anotacoes/${id}/`, {
    method: "PUT",
    body: JSON.stringify({ titulo, conteudo }),
  });
}

export function renomearAnotacao(
  id: string,
  titulo: string,
): Promise<AnotacaoSalva> {
  return apiJson<AnotacaoSalva>(`/anotacoes/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ titulo }),
  });
}

export function excluirAnotacao(id: string): Promise<void> {
  return apiSemRetorno(`/anotacoes/${id}/`, { method: "DELETE" });
}

export function carregarAnotacao(id: string): Promise<AnotacaoSalva> {
  return apiJson<AnotacaoSalva>(`/anotacoes/${id}/`);
}

export function listarAnotacoes(): Promise<AnotacaoSalva[]> {
  return apiJson<AnotacaoSalva[]>("/anotacoes/");
}
