import { apiJson, apiSemRetorno } from "../../services/apiClient";

export type PerguntaEstudo = {
  id: string;
  anotacao: string;
  questionario?: string | null;
  titulo_anotacao: string;
  enunciado: string;
  resposta: string;
  tipo: "dissertativa" | "alternativa";
  alternativas: string[];
  alternativa_correta: number | null;
  trecho_origem: string;
  data_criacao: string;
  total_tentativas: number;
};

export function criarPergunta(
  data: Pick<
    PerguntaEstudo,
    "anotacao" | "enunciado" | "resposta" | "trecho_origem"
  > & {
    mapa_origem?: string;
    visao_origem?: string;
    confirmar_reinicio?: boolean;
  },
): Promise<PerguntaEstudo> {
  return apiJson<PerguntaEstudo>("/perguntas/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function atualizarPergunta(
  id: string,
  data: Pick<PerguntaEstudo, "enunciado" | "resposta"> & {
    tipo?: PerguntaEstudo["tipo"];
    alternativas?: string[];
    alternativa_correta?: number | null;
    questionario?: string;
    manter_agendamento?: boolean;
    confirmar_reinicio?: boolean;
  },
): Promise<PerguntaEstudo> {
  return apiJson<PerguntaEstudo>(`/perguntas/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function excluirPergunta(id: string): Promise<void> {
  return apiSemRetorno(`/perguntas/${id}/?confirmar_reinicio=true`, {
    method: "DELETE",
  });
}

export type QuestionarioSalvo = {
  id: string;
  titulo: string;
  versao: number;
  limite_dias: number | null;
  proxima_revisao: string | null;
  ultima_revisao: string | null;
  total_perguntas: number;
  intervalo: number;
};
export type Classificacao = "errei" | "parcial" | "acertei";
export type RespostaSessao = {
  pergunta: string;
  resposta_digitada: string;
  resultado: Classificacao;
  alternativa?: number;
};
export type Devolutiva = {
  id: string;
  versao: number;
  treino: boolean;
  data_criacao: string;
  acertos: number;
  parciais: number;
  total: number;
  qualidade: number;
  pontuacao: number;
  respostas: (RespostaSessao & {
    enunciado: string;
    resposta: string;
    anotacao: string | null;
    titulo_anotacao: string;
    anotacao_disponivel: boolean;
  })[];
};
export const listarQuestionarios = () =>
  apiJson<QuestionarioSalvo[]>("/questionarios/");
export const obterQuestionario = (id: string) =>
  apiJson<QuestionarioSalvo>(`/questionarios/${id}/`);
export const salvarQuestionario = (
  data: { titulo: string; limite_dias: number | null },
  id: string,
) =>
  apiJson<QuestionarioSalvo>(`/questionarios/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const removerQuestionario = (id: string) =>
  apiSemRetorno(`/questionarios/${id}/`, { method: "DELETE" });
export const perguntasQuestionario = async (id: string) =>
  (await apiJson<PerguntaEstudo[]>(`/perguntas/?questionario=${id}`)).sort(
    (a, b) =>
      a.data_criacao.localeCompare(b.data_criacao) || a.id.localeCompare(b.id),
  );
export const obterDevolutiva = async (
  id: string,
): Promise<Devolutiva | null> => {
  const d = await apiJson<Devolutiva | { vazia: true }>(
    `/questionarios/${id}/devolutiva/?incluir_treino=true`,
  );
  return "vazia" in d ? null : d;
};
export const finalizarQuestionario = (
  id: string,
  data: {
    chave: string;
    versao: number;
    treino: boolean;
    respostas: RespostaSessao[];
  },
) =>
  apiJson<Devolutiva>(`/questionarios/${id}/finalizar/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
export type DadosResultados = {
  barras: {
    id: string | null;
    nome: string;
    total: number;
    acertos: number;
    parciais: number;
  }[];
  linha: { data: string; total: number; acertos: number }[];
  total: number;
  acertos: number;
  parciais: number;
  sessoes: number;
  hoje: number;
  atrasadas: number;
};
export const obterResultados = (params: URLSearchParams) =>
  apiJson<DadosResultados>(`/resultados/?${params}`);
