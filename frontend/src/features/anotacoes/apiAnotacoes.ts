import { apiJson, apiSemRetorno } from '../../services/apiClient';

export type ConteudoAnotacao = any;

export type AnotacaoSalva = {
  id: number;
  pasta: number | null;
  titulo: string;
  conteudo: ConteudoAnotacao;
  autor: number | null;
  data_criacao: string;
  data_atualizacao: string;
};

export const CONTEUDO_ANOTACAO_VAZIA: ConteudoAnotacao = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export function criarAnotacao(
  titulo: string,
  conteudo: ConteudoAnotacao = CONTEUDO_ANOTACAO_VAZIA,
  pasta: number | null = null
): Promise<AnotacaoSalva> {
  return apiJson<AnotacaoSalva>('/anotacoes/', {
    method: 'POST',
    body: JSON.stringify({ titulo, conteudo, pasta }),
  });
}

export function atualizarAnotacao(
  id: number,
  titulo: string,
  conteudo: ConteudoAnotacao
): Promise<AnotacaoSalva> {
  return apiJson<AnotacaoSalva>(`/anotacoes/${id}/`, {
    method: 'PUT',
    body: JSON.stringify({ titulo, conteudo }),
  });
}

export function renomearAnotacao(id: number, titulo: string): Promise<AnotacaoSalva> {
  return apiJson<AnotacaoSalva>(`/anotacoes/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ titulo }),
  });
}

export function excluirAnotacao(id: number): Promise<void> {
  return apiSemRetorno(`/anotacoes/${id}/`, { method: 'DELETE' });
}

export function carregarAnotacao(id: number): Promise<AnotacaoSalva> {
  return apiJson<AnotacaoSalva>(`/anotacoes/${id}/`);
}

export function listarAnotacoes(): Promise<AnotacaoSalva[]> {
  return apiJson<AnotacaoSalva[]>('/anotacoes/');
}
