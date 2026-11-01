import { apiJson, apiSemRetorno } from '../../services/apiClient';

export type PerguntaEstudo = {
  id: number;
  anotacao: number;
  titulo_anotacao: string;
  enunciado: string;
  resposta: string;
  trecho_origem: string;
  data_criacao: string;
  total_tentativas: number;
};

export type TentativaEstudo = {
  id: number;
  pergunta: number;
  resposta_digitada: string;
  acertou: boolean;
  data_criacao: string;
};

export function listarPerguntas(annotationId?: number): Promise<PerguntaEstudo[]> {
  const query = annotationId === undefined ? '' : `?anotacao=${annotationId}`;
  return apiJson<PerguntaEstudo[]>(`/perguntas/${query}`);
}

export function criarPergunta(
  data: Pick<PerguntaEstudo, 'anotacao' | 'enunciado' | 'resposta' | 'trecho_origem'>
): Promise<PerguntaEstudo> {
  return apiJson<PerguntaEstudo>('/perguntas/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function atualizarPergunta(
  id: number,
  data: Pick<PerguntaEstudo, 'enunciado' | 'resposta'>
): Promise<PerguntaEstudo> {
  return apiJson<PerguntaEstudo>(`/perguntas/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function excluirPergunta(id: number): Promise<void> {
  return apiSemRetorno(`/perguntas/${id}/`, { method: 'DELETE' });
}

export function registrarTentativa(
  data: Pick<TentativaEstudo, 'pergunta' | 'resposta_digitada' | 'acertou'>
): Promise<TentativaEstudo> {
  return apiJson<TentativaEstudo>('/tentativas/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
