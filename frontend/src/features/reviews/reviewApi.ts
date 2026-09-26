const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api';

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

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await response.text() || `Erro HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function listQuestions(annotationId?: number): Promise<StudyQuestion[]> {
  const query = annotationId === undefined ? '' : `?anotacao=${annotationId}`;
  return json<StudyQuestion[]>(await fetch(`${API_URL}/perguntas/${query}`));
}

export async function createQuestion(data: Pick<StudyQuestion, 'anotacao' | 'enunciado' | 'resposta' | 'trecho_origem'>): Promise<StudyQuestion> {
  return json<StudyQuestion>(await fetch(`${API_URL}/perguntas/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }));
}

export async function updateQuestion(
  id: number,
  data: Pick<StudyQuestion, 'enunciado' | 'resposta'>
): Promise<StudyQuestion> {
  return json<StudyQuestion>(await fetch(`${API_URL}/perguntas/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }));
}

export async function deleteQuestion(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/perguntas/${id}/`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await response.text() || `Erro HTTP ${response.status}`);
}

export async function listAttempts(questionId?: number): Promise<StudyAttempt[]> {
  const query = questionId === undefined ? '' : `?pergunta=${questionId}`;
  return json<StudyAttempt[]>(await fetch(`${API_URL}/tentativas/${query}`));
}

export async function registerAttempt(data: Pick<StudyAttempt, 'pergunta' | 'resposta_digitada' | 'acertou'>): Promise<StudyAttempt> {
  return json<StudyAttempt>(await fetch(`${API_URL}/tentativas/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }));
}
