import { apiJson, apiSemRetorno } from '../../services/apiClient';

export type EspacoAcompanhamento = {
  id: number;
  nome: string;
};

export type EspacoParticipando = EspacoAcompanhamento & {
  proprietario_id: number;
};

export function listarMeusEspacos(): Promise<EspacoAcompanhamento[]> {
  return apiJson<EspacoAcompanhamento[]>(
    '/acompanhamento/espacos/'
  );
}

export function listarEspacosComoTutor(): Promise<EspacoParticipando[]> {
  return apiJson<EspacoParticipando[]>(
    '/acompanhamento/espacos/participando/'
  );
}

export function criarEspaco(
  nome: string
): Promise<EspacoAcompanhamento> {
  return apiJson<EspacoAcompanhamento>(
    '/acompanhamento/espacos/',
    {
      method: 'POST',
      body: JSON.stringify({ nome }),
    }
  );
}

export function renomearCanal(id: number, nome: string): Promise<EspacoAcompanhamento> {
  return apiJson<EspacoAcompanhamento>(`/acompanhamento/espacos/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ nome }),
  });
}

export function excluirCanal(id: number): Promise<void> {
  return apiSemRetorno(`/acompanhamento/espacos/${id}/`, { method: 'DELETE' });
}

export type MaterialCompartilhado = {
  id: number;
  titulo: string;
};

export type MateriaisEspaco = {
  anotacoes: MaterialCompartilhado[];
  mapas: MaterialCompartilhado[];
};

export function listarMateriaisEspaco(
  espacoId: number
): Promise<MateriaisEspaco> {
  return apiJson<MateriaisEspaco>(
    `/acompanhamento/espacos/${espacoId}/materiais/`
  );
}

export type ConviteRecebido = {
  id: number;
  espaco_id: number;
  espaco_nome: string;
  solicitado_por_id: number;
  status: string;
};

export function listarConvitesRecebidos(): Promise<ConviteRecebido[]> {
  return apiJson<ConviteRecebido[]>(
    '/acompanhamento/convites/recebidos/'
  );
}

export function aceitarConvite(
  conviteId: number
): Promise<{ status: string }> {
  return apiJson<{ status: string }>(
    `/acompanhamento/convites/${conviteId}/aceitar/`,
    { method: 'POST' }
  );
}

export function recusarConvite(
  conviteId: number
): Promise<{ id: number; status: string }> {
  return apiJson<{ id: number; status: string }>(
    `/acompanhamento/convites/${conviteId}/recusar/`,
    { method: 'POST' }
  );
}

export type TutorEspaco = {
  participacao_id: number;
  tutor_id: number;
  nome_apresentacao: string;
};

export function listarTutoresEspaco(
  espacoId: number
): Promise<TutorEspaco[]> {
  return apiJson<TutorEspaco[]>(
    `/acompanhamento/espacos/${espacoId}/tutores/`
  );
}

export function removerTutorEspaco(
  espacoId: number,
  tutorId: number
): Promise<void> {
  return apiSemRetorno(
    `/acompanhamento/espacos/${espacoId}/tutores/${tutorId}/`,
    { method: 'DELETE' }
  );
}

export type ConviteCriado = {
  id: number;
  status: string;
};

export function criarConvite(
  espacoId: number,
  tutor: number | string
): Promise<ConviteCriado> {
  return apiJson<ConviteCriado>(
    '/acompanhamento/convites/',
    {
      method: 'POST',
      body: JSON.stringify({
        espaco_id: espacoId,
        ...(typeof tutor === 'number' ? { tutor_id: tutor } : { usuario_tutor: tutor }),
      }),
    }
  );
}

export type TutorDisponivel = QualificacaoTutor & {
  descricao: string;
  id: number;
  nome_apresentacao: string;
};

export function buscarTutoresDisponiveis(
  busca: string
): Promise<TutorDisponivel[]> {
  const termo = busca.trim();

  if (termo.length < 2) {
    return Promise.resolve([]);
  }

  return apiJson<TutorDisponivel[]>(
    `/acompanhamento/tutores/disponiveis/?busca=${encodeURIComponent(termo)}`
  );
}

export type CompartilhamentoAnotacao = {
  id: number;
  espaco_id: number;
  anotacao_id: number;
};

export type CompartilhamentoMapa = {
  id: number;
  espaco_id: number;
  mapa_id: number;
};

export function compartilharAnotacao(
  espacoId: number,
  anotacaoId: number
): Promise<CompartilhamentoAnotacao> {
  return apiJson<CompartilhamentoAnotacao>(
    `/acompanhamento/espacos/${espacoId}/anotacoes/${anotacaoId}/compartilhar/`,
    { method: 'POST' }
  );
}

export function compartilharMapa(
  espacoId: number,
  mapaId: number
): Promise<CompartilhamentoMapa> {
  return apiJson<CompartilhamentoMapa>(
    `/acompanhamento/espacos/${espacoId}/mapas/${mapaId}/compartilhar/`,
    { method: 'POST' }
  );
}

export type PerfilTutor = DadosPerfilTutor & {
  id: number;
  criado_em: string;
};

export type DadosPerfilTutor = QualificacaoTutor & {
  nome_apresentacao: string;
  descricao: string;
  visibilidade: 'publico' | 'privado';
  ativo: boolean;
};

export function obterMeuPerfilTutor(): Promise<PerfilTutor> {
  return apiJson<PerfilTutor>(
    '/acompanhamento/tutores/perfil/'
  );
}

export function criarPerfilTutor(
  dados: DadosPerfilTutor
): Promise<PerfilTutor> {
  return apiJson<PerfilTutor>(
    '/acompanhamento/tutores/perfil/',
    {
      method: 'POST',
      body: JSON.stringify(dados),
    }
  );
}

export function atualizarPerfilTutor(
  dados: Partial<DadosPerfilTutor>
): Promise<PerfilTutor> {
  return apiJson<PerfilTutor>(
    '/acompanhamento/tutores/perfil/',
    {
      method: 'PATCH',
      body: JSON.stringify(dados),
    }
  );
}

export type AnotacaoCompartilhadaDetalhe = {
  id: number;
  titulo: string;
  conteudo: unknown;
};

export type MapaCompartilhadoDetalhe = {
  id: number;
  titulo: string;
  dados: unknown;
};

export function obterAnotacaoCompartilhada(
  anotacaoId: number
): Promise<AnotacaoCompartilhadaDetalhe> {
  return apiJson<AnotacaoCompartilhadaDetalhe>(
    `/acompanhamento/anotacoes/${anotacaoId}/`
  );
}

export function obterAnotacaoDoMapa(espacoId: number, mapaId: number, anotacaoId: number) {
  return apiJson<AnotacaoCompartilhadaDetalhe>(
    `/acompanhamento/espacos/${espacoId}/mapas/${mapaId}/anotacoes/${anotacaoId}/`
  );
}

export function obterMapaCompartilhado(
  mapaId: number
): Promise<MapaCompartilhadoDetalhe> {
  return apiJson<MapaCompartilhadoDetalhe>(
    `/acompanhamento/mapas/${mapaId}/`
  );
}
export type MaterialSelecionado = MaterialCompartilhado & { tipo: 'anotacao' | 'mapa' };

export type MensagemAcompanhamento = {
  id: number;
  autor_nome: string;
  texto: string;
  criada_em: string;
  resposta_a: number | null;
  pode_gerenciar: boolean;
};

function enderecoMensagens(espacoId: number, material?: MaterialSelecionado) {
  const base = `/acompanhamento/espacos/${espacoId}/`;
  return material ? `${base}materiais/${material.tipo}/${material.id}/comentarios/` : `${base}duvidas/`;
}

export function listarMensagens(espacoId: number, material?: MaterialSelecionado) {
  return apiJson<MensagemAcompanhamento[]>(enderecoMensagens(espacoId, material));
}

export function publicarMensagem(espacoId: number, texto: string, resposta_a?: number, material?: MaterialSelecionado) {
  return apiJson<MensagemAcompanhamento>(enderecoMensagens(espacoId, material), {
    method: 'POST',
    body: JSON.stringify({ texto, resposta_a }),
  });
}

export const areasTutor = {
  linguagens: 'Linguagens', matematica: 'Matemática', natureza: 'Ciências da Natureza',
  humanas: 'Ciências Humanas', educacao: 'Educação', tecnologia: 'Tecnologia',
  saude: 'Saúde', outras: 'Outras áreas',
} as const;

type QualificacaoTutor = {
  area: keyof typeof areasTutor | '';
  formacoes: FormacaoTutor[];
};

export type FormacaoTutor = {
  titulo: string;
  instituicao: string;
  link_comprovante: string;
};


export function editarComentario(espacoId: number, material: MaterialSelecionado, id: number, texto: string) {
  return apiJson<MensagemAcompanhamento>(`${enderecoMensagens(espacoId, material)}${id}/`, {
    method: 'PATCH', body: JSON.stringify({ texto }),
  });
}

export function excluirComentario(espacoId: number, material: MaterialSelecionado, id: number) {
  return apiSemRetorno(`${enderecoMensagens(espacoId, material)}${id}/`, { method: 'DELETE' });
}
