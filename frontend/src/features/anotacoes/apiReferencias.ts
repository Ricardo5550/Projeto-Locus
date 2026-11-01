import { ErroApi, requisicaoApi } from '../../services/apiClient';

export type ReferenciaAcademica = {
  titulo: string;
  autores: string[];
  ano: number | null;
  publicacao: string;
  doi: string;
  url: string;
  tipo: string;
};

type RespostaPesquisa = { resultados: ReferenciaAcademica[] };

export async function pesquisarReferencias(
  term: string,
  signal?: AbortSignal
): Promise<ReferenciaAcademica[]> {
  const query = term.trim();
  if (query.length < 2 || query.length > 200) {
    throw new Error('Informe entre 2 e 200 caracteres para pesquisar.');
  }

  let response: Response;
  try {
    response = await requisicaoApi(
      `/referencias/?q=${encodeURIComponent(query)}`,
      { signal }
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Não foi possível consultar as fontes agora. Tente novamente em alguns instantes.');
  }

  if (!response.ok) {
    throw new ErroApi(
      response.status === 400
        ? 'Revise os termos de pesquisa e tente novamente.'
        : 'Não foi possível consultar as fontes agora. Tente novamente em alguns instantes.',
      response.status
    );
  }

  const data = (await response.json()) as RespostaPesquisa;
  if (!Array.isArray(data.resultados)) {
    throw new Error('Não foi possível interpretar os resultados da pesquisa.');
  }
  return data.resultados;
}
