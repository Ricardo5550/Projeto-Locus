import { caminhos } from "../../navegacao/rotas";
import { apiJson } from "../../services/apiClient";

export const ROTA_GESTAO = caminhos.gestao;
export type PaginaGestao<T> = {
  itens: T[];
  pagina: number;
  total_paginas: number;
  total: number;
};
export type ContaGestao = {
  id: string;
  nome: string;
  email_oculto: string;
  ativa: boolean;
  administrador: boolean;
  supremo: boolean;
};
export type DetalheConta = ContaGestao & {
  ultimo_supremo: boolean;
  pedido_encerramento: { id: string; motivo: string; criada_em: string } | null;
  email_confirmado: boolean;
  mfa_ativo: boolean;
  cadastro: string;
  ultimo_acesso: string | null;
  pode_atender: boolean;
  acoes: { valor: string; nome: string }[];
};
export type TutorGestao = {
  id: string;
  nome: string;
  usuario: string;
  area: string;
  aprovado: boolean;
  situacao: "pendente" | "aprovado" | "rejeitado";
  ativo: boolean;
  conta_ativa: boolean;
  criado_em: string;
};
export type DetalheTutor = TutorGestao & {
  descricao: string;
  motivo_rejeicao: string;
  formacoes: { titulo: string; instituicao: string; link: string }[];
};
export type RegistroGestao = {
  id: string;
  data: string;
  responsavel: string;
  acao: string;
  recurso: string;
  recurso_id: string | null;
  resultado: string;
  ip: string | null;
  descricao: string;
};
export type OpcoesAuditoria = { acoes: string[]; recursos: string[] };
export const atenderConta = (
  id: string,
  acao: string,
  motivo: string,
  senha_atual = "",
) =>
  apiJson<{ detail: string; email?: string }>(`/gestao/contas/${id}/`, {
    method: "POST",
    body: JSON.stringify({ acao, motivo, senha_atual }),
  });
export const decidirTutor = (id: string, aprovado: string, motivo: string) =>
  apiJson<{ detail: string }>(`/gestao/tutores/${id}/`, {
    method: "POST",
    body: JSON.stringify({ aprovado, motivo }),
  });
export const dataGestao = (valor: string | null) =>
  valor ? new Date(valor).toLocaleString("pt-BR") : "—";
