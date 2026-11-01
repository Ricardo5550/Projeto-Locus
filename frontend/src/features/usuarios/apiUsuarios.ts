import { apiJson, apiSemRetorno } from '../../services/apiClient';

export type UsuarioAtual = {
  pk: number;
  username: string;
  email: string;
  pending_email?: string | null;
  is_staff?: boolean;
};

export function obterUsuarioAtual(): Promise<UsuarioAtual> {
  return apiJson<UsuarioAtual>('/auth/account/');
}

export function atualizarConta(username: string): Promise<UsuarioAtual> {
  return apiJson<UsuarioAtual>('/auth/account/', {
    method: 'PATCH',
    body: JSON.stringify({ username }),
  });
}

export function excluirConta(password: string): Promise<void> {
  return apiSemRetorno('/auth/account/', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
}

export function solicitarAlteracaoEmail(email:string,password:string):Promise<{detail:string}> {
  return apiJson('/auth/account/email/',{method:'POST',body:JSON.stringify({email,password})});
}
