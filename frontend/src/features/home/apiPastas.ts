import { apiJson, apiSemRetorno } from '../../services/apiClient';
export type PastaSalva = { id: number; nome: string; pai: number | null; autor: number };
export const listarPastas = () => apiJson<PastaSalva[]>('/pastas/');
export const criarPasta = (nome: string, pai: number | null) => apiJson<PastaSalva>('/pastas/', { method:'POST', body:JSON.stringify({nome,pai}) });
export const renomearPasta = (id:number, nome:string) => apiJson<PastaSalva>(`/pastas/${id}/`, { method:'PATCH', body:JSON.stringify({nome}) });
export const excluirPasta = (id:number) => apiSemRetorno(`/pastas/${id}/`, {method:'DELETE'});
export const moverConteudo = (type:'Mapa mental'|'Anotação'|'Pasta', id:number, pasta:number|null) => apiJson(
  `/${type === 'Pasta' ? 'pastas' : type === 'Mapa mental' ? 'mapas-mentais' : 'anotacoes'}/${id}/`,
  {method:'PATCH',body:JSON.stringify(type === 'Pasta' ? {pai:pasta} : {pasta})});
