import { apiJson } from '../../services/apiClient';

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