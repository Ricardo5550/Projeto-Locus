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
  tutorId: number
): Promise<ConviteCriado> {
  return apiJson<ConviteCriado>(
    '/acompanhamento/convites/',
    {
      method: 'POST',
      body: JSON.stringify({
        espaco_id: espacoId,
        tutor_id: tutorId,
      }),
    }
  );
}

export type TutorDisponivel = {
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

export type PerfilTutor = {
  id: number;
  nome_apresentacao: string;
  descricao: string;
  visibilidade: 'publico' | 'privado';
  ativo: boolean;
  criado_em: string;
};

export type DadosPerfilTutor = {
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

export function obterMapaCompartilhado(
  mapaId: number
): Promise<MapaCompartilhadoDetalhe> {
  return apiJson<MapaCompartilhadoDetalhe>(
    `/acompanhamento/mapas/${mapaId}/`
  );
}