import { apiJson, apiSemRetorno } from "../../services/apiClient";

export type EspacoAcompanhamento = {
  id: string;
  nome: string;
};

export type EspacoParticipando = EspacoAcompanhamento & {
  proprietario_id: string;
};

export function listarMeusEspacos(): Promise<EspacoAcompanhamento[]> {
  return apiJson<EspacoAcompanhamento[]>("/acompanhamento/espacos/");
}

export function listarEspacosComoTutor(): Promise<EspacoParticipando[]> {
  return apiJson<EspacoParticipando[]>("/acompanhamento/espacos/participando/");
}

export function criarEspaco(nome: string): Promise<EspacoAcompanhamento> {
  return apiJson<EspacoAcompanhamento>("/acompanhamento/espacos/", {
    method: "POST",
    body: JSON.stringify({ nome }),
  });
}

export function renomearCanal(
  id: string,
  nome: string,
): Promise<EspacoAcompanhamento> {
  return apiJson<EspacoAcompanhamento>(`/acompanhamento/espacos/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ nome }),
  });
}

export function excluirCanal(id: string): Promise<void> {
  return apiSemRetorno(`/acompanhamento/espacos/${id}/`, { method: "DELETE" });
}

export type MaterialCompartilhado = {
  id: string;
  titulo: string;
};

export type MateriaisEspaco = {
  anotacoes: MaterialCompartilhado[];
  mapas: MaterialCompartilhado[];
  questionarios: MaterialCompartilhado[];
};

export function listarMateriaisEspaco(
  espacoId: string,
): Promise<MateriaisEspaco> {
  return apiJson<MateriaisEspaco>(
    `/acompanhamento/espacos/${espacoId}/materiais/`,
  );
}

export type ConviteRecebido = {
  id: string;
  espaco_id: string;
  espaco_nome: string;
  solicitado_por_id: string;
  status: string;
};

export function listarConvitesRecebidos(): Promise<ConviteRecebido[]> {
  return apiJson<ConviteRecebido[]>("/acompanhamento/convites/recebidos/");
}

export function aceitarConvite(conviteId: string): Promise<{ status: string }> {
  return apiJson<{ status: string }>(
    `/acompanhamento/convites/${conviteId}/aceitar/`,
    { method: "POST" },
  );
}

export function recusarConvite(
  conviteId: string,
): Promise<{ id: string; status: string }> {
  return apiJson<{ id: string; status: string }>(
    `/acompanhamento/convites/${conviteId}/recusar/`,
    { method: "POST" },
  );
}

export type TutorEspaco = {
  participacao_id: string;
  tutor_id: string;
  nome_apresentacao: string;
};

export function listarTutoresEspaco(espacoId: string): Promise<TutorEspaco[]> {
  return apiJson<TutorEspaco[]>(`/acompanhamento/espacos/${espacoId}/tutores/`);
}

export function removerTutorEspaco(
  espacoId: string,
  tutorId: string,
): Promise<void> {
  return apiSemRetorno(
    `/acompanhamento/espacos/${espacoId}/tutores/${tutorId}/`,
    { method: "DELETE" },
  );
}

export type ConviteCriado = {
  id: string;
  status: string;
};

export function criarConvite(
  espacoId: string,
  tutor: { tutor_id: string } | { usuario_tutor: string },
): Promise<ConviteCriado> {
  return apiJson<ConviteCriado>("/acompanhamento/convites/", {
    method: "POST",
    body: JSON.stringify({
      espaco_id: espacoId,
      ...tutor,
    }),
  });
}

export type TutorDisponivel = QualificacaoTutor & {
  descricao: string;
  id: string;
  nome_apresentacao: string;
};

export function buscarTutoresDisponiveis(
  busca: string,
): Promise<TutorDisponivel[]> {
  const termo = busca.trim();

  if (termo.length < 2) {
    return Promise.resolve([]);
  }

  return apiJson<TutorDisponivel[]>(
    `/acompanhamento/tutores/disponiveis/?busca=${encodeURIComponent(termo)}`,
  );
}

export type CompartilhamentoAnotacao = {
  id: string;
  espaco_id: string;
  anotacao_id: string;
};

export type CompartilhamentoMapa = {
  id: string;
  espaco_id: string;
  mapa_id: string;
};

export function compartilharAnotacao(
  espacoId: string,
  anotacaoId: string,
): Promise<CompartilhamentoAnotacao> {
  return apiJson<CompartilhamentoAnotacao>(
    `/acompanhamento/espacos/${espacoId}/anotacoes/${anotacaoId}/compartilhar/`,
    { method: "POST" },
  );
}

export function compartilharMapa(
  espacoId: string,
  mapaId: string,
): Promise<CompartilhamentoMapa> {
  return apiJson<CompartilhamentoMapa>(
    `/acompanhamento/espacos/${espacoId}/mapas/${mapaId}/compartilhar/`,
    { method: "POST" },
  );
}

export function compartilharQuestionario(espacoId: string, questionarioId: string) {
  return apiJson<{ id: string; espaco_id: string; questionario_id: string }>(
    `/acompanhamento/espacos/${espacoId}/questionarios/${questionarioId}/compartilhar/`,
    { method: "POST" },
  );
}

export type PerfilTutor = DadosPerfilTutor & {
  situacao: "pendente" | "aprovado" | "rejeitado";
  motivo_rejeicao: string;
  rejeitado_em: string | null;
  id: string;
  criado_em: string;
  aprovado: boolean;
};

export type DadosPerfilTutor = QualificacaoTutor & {
  nome_apresentacao: string;
  descricao: string;
  visibilidade: "publico" | "privado";
  ativo: boolean;
};

export function obterMeuPerfilTutor(): Promise<PerfilTutor> {
  return apiJson<PerfilTutor>("/acompanhamento/tutores/perfil/");
}

export function criarPerfilTutor(
  dados: DadosPerfilTutor,
): Promise<PerfilTutor> {
  return apiJson<PerfilTutor>("/acompanhamento/tutores/perfil/", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export function atualizarPerfilTutor(
  dados: Partial<DadosPerfilTutor>,
): Promise<PerfilTutor> {
  return apiJson<PerfilTutor>("/acompanhamento/tutores/perfil/", {
    method: "PATCH",
    body: JSON.stringify(dados),
  });
}

export type AnotacaoCompartilhadaDetalhe = {
  id: string;
  titulo: string;
  conteudo: unknown;
};

export type MapaCompartilhadoDetalhe = {
  id: string;
  titulo: string;
  dados: unknown;
};

export function obterAnotacaoCompartilhada(
  anotacaoId: string,
): Promise<AnotacaoCompartilhadaDetalhe> {
  return apiJson<AnotacaoCompartilhadaDetalhe>(
    `/acompanhamento/anotacoes/${anotacaoId}/`,
  );
}

export function obterAnotacaoDoMapa(
  espacoId: string,
  mapaId: string,
  anotacaoId: string,
) {
  return apiJson<AnotacaoCompartilhadaDetalhe>(
    `/acompanhamento/espacos/${espacoId}/mapas/${mapaId}/anotacoes/${anotacaoId}/`,
  );
}

export function obterMapaCompartilhado(
  mapaId: string,
): Promise<MapaCompartilhadoDetalhe> {
  return apiJson<MapaCompartilhadoDetalhe>(`/acompanhamento/mapas/${mapaId}/`);
}
export type MaterialSelecionado = MaterialCompartilhado & {
  tipo: "anotacao" | "mapa" | "questionario";
};

export type QuestionarioCompartilhadoDetalhe = MaterialCompartilhado & {
  perguntas: {
    id: string;
    enunciado: string;
    resposta: string;
    tipo: "dissertativa" | "alternativa";
    alternativas: string[];
    alternativa_correta: number | null;
  }[];
};

export function obterQuestionarioCompartilhado(espacoId: string, questionarioId: string) {
  return apiJson<QuestionarioCompartilhadoDetalhe>(
    `/acompanhamento/espacos/${espacoId}/questionarios/${questionarioId}/`,
  );
}

export type MensagemAcompanhamento = {
  id: string;
  autor_nome: string;
  texto: string;
  criada_em: string;
  resposta_a: string | null;
  pode_gerenciar: boolean;
};

function enderecoMensagens(espacoId: string, material?: MaterialSelecionado) {
  const base = `/acompanhamento/espacos/${espacoId}/`;
  return material
    ? `${base}materiais/${material.tipo}/${material.id}/comentarios/`
    : `${base}duvidas/`;
}

export function listarMensagens(
  espacoId: string,
  material?: MaterialSelecionado,
) {
  return apiJson<MensagemAcompanhamento[]>(
    enderecoMensagens(espacoId, material),
  );
}

export function publicarMensagem(
  espacoId: string,
  texto: string,
  resposta_a?: string,
  material?: MaterialSelecionado,
) {
  return apiJson<MensagemAcompanhamento>(
    enderecoMensagens(espacoId, material),
    {
      method: "POST",
      body: JSON.stringify({ texto, resposta_a }),
    },
  );
}

export const areasTutor = {
  linguagens: "Linguagens",
  matematica: "Matemática",
  natureza: "Ciências da Natureza",
  humanas: "Ciências Humanas",
  educacao: "Educação",
  tecnologia: "Tecnologia",
  saude: "Saúde",
  outras: "Outras áreas",
} as const;

type QualificacaoTutor = {
  area: keyof typeof areasTutor | "";
  formacoes: FormacaoTutor[];
};

export type FormacaoTutor = {
  titulo: string;
  instituicao: string;
  link_comprovante: string;
};

export function editarComentario(
  espacoId: string,
  material: MaterialSelecionado,
  id: string,
  texto: string,
) {
  return apiJson<MensagemAcompanhamento>(
    `${enderecoMensagens(espacoId, material)}${id}/`,
    {
      method: "PATCH",
      body: JSON.stringify({ texto }),
    },
  );
}

export function excluirComentario(
  espacoId: string,
  material: MaterialSelecionado,
  id: string,
) {
  return apiSemRetorno(`${enderecoMensagens(espacoId, material)}${id}/`, {
    method: "DELETE",
  });
}
