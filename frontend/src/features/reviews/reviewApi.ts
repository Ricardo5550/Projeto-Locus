import { apiJson, apiVoid } from '../../services/apiClient';

export type StudyQuestion = {
  id: number;
  anotacao: number;
  titulo_anotacao: string;
  enunciado: string;
  resposta: string;
  trecho_origem: string;
  data_criacao: string;
  total_tentativas: number;
};

export type StudyAttempt = {
  id: number;
  pergunta: number;
  resposta_digitada: string;
  acertou: boolean;
  data_criacao: string;
};

export function listQuestions(annotationId?: number): Promise<StudyQuestion[]> {
  const query = annotationId === undefined ? '' : `?anotacao=${annotationId}`;
  return apiJson<StudyQuestion[]>(`/perguntas/${query}`);
}

export function createQuestion(
  data: Pick<StudyQuestion, 'anotacao' | 'enunciado' | 'resposta' | 'trecho_origem'>
): Promise<StudyQuestion> {
  return apiJson<StudyQuestion>('/perguntas/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateQuestion(
  id: number,
  data: Pick<StudyQuestion, 'enunciado' | 'resposta'>
): Promise<StudyQuestion> {
  return apiJson<StudyQuestion>(`/perguntas/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteQuestion(id: number): Promise<void> {
  return apiVoid(`/perguntas/${id}/`, { method: 'DELETE' });
}

export function registerAttempt(
  data: Pick<StudyAttempt, 'pergunta' | 'resposta_digitada' | 'acertou'>
): Promise<StudyAttempt> {
  return apiJson<StudyAttempt>('/tentativas/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
