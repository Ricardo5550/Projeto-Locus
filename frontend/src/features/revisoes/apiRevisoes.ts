import { apiJson, apiSemRetorno } from '../../services/apiClient';

export type PerguntaEstudo = {
  id: number;
  anotacao: number;
  questionario?: number|null;
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
  data: Pick<PerguntaEstudo, 'anotacao' | 'enunciado' | 'resposta' | 'trecho_origem'> & {mapa_origem?:number; visao_origem?:string; confirmar_reinicio?:boolean}
): Promise<PerguntaEstudo> {
  return apiJson<PerguntaEstudo>('/perguntas/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function atualizarPergunta(
  id: number,
  data: Pick<PerguntaEstudo, 'enunciado' | 'resposta'> & {questionario?:number; manter_agendamento?:boolean; confirmar_reinicio?:boolean}
): Promise<PerguntaEstudo> {
  return apiJson<PerguntaEstudo>(`/perguntas/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function excluirPergunta(id: number): Promise<void> {
  return apiSemRetorno(`/perguntas/${id}/?confirmar_reinicio=true`, { method: 'DELETE' });
}

export function registrarTentativa(
  data: Pick<TentativaEstudo, 'pergunta' | 'resposta_digitada' | 'acertou'>
): Promise<TentativaEstudo> {
  return apiJson<TentativaEstudo>('/tentativas/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export type QuestionarioSalvo = {id:number; titulo:string; versao:number; limite_dias:number|null; proxima_revisao:string|null; ultima_revisao:string|null; total_perguntas:number; intervalo:number};
export type Classificacao = 'errei'|'parcial'|'acertei';
export type RespostaSessao = {pergunta:number; resposta_digitada:string; resultado:Classificacao};
export type Devolutiva = {id:number; versao:number; treino:boolean; data_criacao:string; acertos:number; parciais:number; total:number; qualidade:number; pontuacao:number; respostas:(RespostaSessao & {enunciado:string; resposta:string; anotacao:number|null; titulo_anotacao:string; anotacao_disponivel:boolean})[]};
export const listarQuestionarios = () => apiJson<QuestionarioSalvo[]>('/questionarios/');
export const obterQuestionario = (id:number) => apiJson<QuestionarioSalvo>(`/questionarios/${id}/`);
export const salvarQuestionario = (data:{titulo:string; limite_dias:number|null},id:number) => apiJson<QuestionarioSalvo>(`/questionarios/${id}/`,{method:'PATCH',body:JSON.stringify(data)});
export const removerQuestionario = (id:number) => apiSemRetorno(`/questionarios/${id}/`,{method:'DELETE'});
export const perguntasQuestionario = async (id:number) => (await apiJson<PerguntaEstudo[]>(`/perguntas/?questionario=${id}`)).sort((a,b)=>a.id-b.id);
export const obterDevolutiva = async (id:number):Promise<Devolutiva|null> => {const d=await apiJson<Devolutiva|{vazia:true}>(`/questionarios/${id}/devolutiva/?incluir_treino=true`);return 'vazia' in d?null:d;};
export const finalizarQuestionario = (id:number,data:{chave:string; versao:number; treino:boolean; respostas:RespostaSessao[]}) => apiJson<Devolutiva>(`/questionarios/${id}/finalizar/`,{method:'POST',body:JSON.stringify(data)});
export type DadosResultados = {barras:{id:number|null;nome:string;total:number;acertos:number;parciais:number}[]; linha:{data:string;total:number;acertos:number}[]; total:number;acertos:number;parciais:number;sessoes:number;hoje:number;atrasadas:number};
export const obterResultados = (params:URLSearchParams) => apiJson<DadosResultados>(`/resultados/?${params}`);
