import { apiJson, apiVoid } from '../../services/apiClient';
export type StoredFolder = { id: number; nome: string; pai: number | null; autor: number };
export const listFolders = () => apiJson<StoredFolder[]>('/pastas/');
export const createFolder = (nome: string, pai: number | null) => apiJson<StoredFolder>('/pastas/', { method:'POST', body:JSON.stringify({nome,pai}) });
export const renameFolder = (id:number, nome:string) => apiJson<StoredFolder>(`/pastas/${id}/`, { method:'PATCH', body:JSON.stringify({nome}) });
export const deleteFolder = (id:number) => apiVoid(`/pastas/${id}/`, {method:'DELETE'});
export const moveContent = (type:'Mapa mental'|'Anotação'|'Pasta', id:number, pasta:number|null) => apiJson(
  `/${type === 'Pasta' ? 'pastas' : type === 'Mapa mental' ? 'mapas-mentais' : 'anotacoes'}/${id}/`,
  {method:'PATCH',body:JSON.stringify(type === 'Pasta' ? {pai:pasta} : {pasta})});
