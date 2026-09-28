import { apiJson, apiVoid } from '../../services/apiClient';

export type CurrentUser = {
  pk: number;
  username: string;
  email: string;
};

export function getCurrentUser(): Promise<CurrentUser> {
  return apiJson<CurrentUser>('/auth/account/');
}

export function updateAccount(username: string): Promise<CurrentUser> {
  return apiJson<CurrentUser>('/auth/account/', {
    method: 'PATCH',
    body: JSON.stringify({ username }),
  });
}

export function deleteAccount(password: string): Promise<void> {
  return apiVoid('/auth/account/', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
}
