export type AcademicReference = {
  titulo: string;
  autores: string[];
  ano: number | null;
  publicacao: string;
  doi: string;
  url: string;
  tipo: string;
};

type SearchResponse = { resultados: AcademicReference[] };

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api';

export async function searchReferences(
  term: string,
  signal?: AbortSignal
): Promise<AcademicReference[]> {
  const query = term.trim();
  if (query.length < 2 || query.length > 200) {
    throw new Error('Informe entre 2 e 200 caracteres para pesquisar.');
  }

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/referencias/?q=${encodeURIComponent(query)}`,
      { signal }
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Não foi possível consultar as fontes agora. Tente novamente em alguns instantes.');
  }

  if (!response.ok) {
    throw new Error(
      response.status === 400
        ? 'Revise os termos de pesquisa e tente novamente.'
        : 'Não foi possível consultar as fontes agora. Tente novamente em alguns instantes.'
    );
  }

  let data: SearchResponse;
  try {
    data = (await response.json()) as SearchResponse;
  } catch {
    throw new Error('Não foi possível interpretar os resultados da pesquisa.');
  }
  if (!Array.isArray(data.resultados)) {
    throw new Error('Não foi possível interpretar os resultados da pesquisa.');
  }
  return data.resultados;
}
