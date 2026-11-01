const configuredApi = new URL(import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:8000/api`);
const loopback = new Set(['localhost', '127.0.0.1']);
// Evita misturar localhost e 127.0.0.1 no desenvolvimento com cookies SameSite.
if (loopback.has(configuredApi.hostname) && loopback.has(window.location.hostname)) {
  configuredApi.hostname = window.location.hostname;
}
export const URL_BASE_API = configuredApi.href.replace(/\/$/, '');

export class ErroApi extends Error {
  status:number;
  constructor(message:string,status:number) {super(message);this.name='ErroApi';this.status=status;}
}

// Remove somente os tokens legados. JWTs novos ficam em cookies HttpOnly.
export function limparTokensAntigos():void {
  localStorage.removeItem('access_token');localStorage.removeItem('refresh_token');
}
limparTokensAntigos();
let csrfToken='';
let csrfPromise:Promise<string>|null=null;
let refreshPromise:Promise<boolean>|null=null;
let restorePromise:Promise<boolean>|null=null;
function url(path:string):string {return `${URL_BASE_API}${path.startsWith('/')?path:`/${path}`}`;}

async function csrf():Promise<string> {
  if(csrfToken)return csrfToken;
  if(csrfPromise)return csrfPromise;
  csrfPromise=(async()=>{
    const response=await fetch(url('/auth/csrf/'),{credentials:'include',cache:'no-store'});
    if(!response.ok)throw new ErroApi('Não foi possível iniciar a proteção da sessão.',response.status);
    const data=await response.json();
    if(typeof data.csrf_token!=='string')throw new Error('Resposta CSRF inválida.');
    csrfToken=data.csrf_token;return csrfToken;
  })().finally(()=>{csrfPromise=null;});
  return csrfPromise;
}

function notificarSessaoExpirada():void {limparTokensAntigos();window.dispatchEvent(new Event('auth:logout'));}

async function send(path:string,init:RequestInit):Promise<Response> {
  const method=(init.method??'GET').toUpperCase();
  const unsafe=!['GET','HEAD','OPTIONS','TRACE'].includes(method);
  const headers=new Headers(init.headers);
  if(init.body && !(init.body instanceof FormData) && !headers.has('Content-Type'))headers.set('Content-Type','application/json');
  if(unsafe)headers.set('X-CSRFToken',await csrf());
  let response=await fetch(url(path),{...init,headers,credentials:'include'});
  if(unsafe && response.status===403) {
    const body=await response.clone().json().catch(()=>({}));
    if(typeof body.detail==='string' && body.detail.includes('CSRF')) {
      csrfToken='';headers.set('X-CSRFToken',await csrf());
      response=await fetch(url(path),{...init,headers,credentials:'include'});
    }
  }
  return response;
}

async function renovarSessao():Promise<boolean> {
  if(refreshPromise)return refreshPromise;
  const renew=()=>send('/auth/token/refresh/',{method:'POST'}).then(r=>r.ok);
  refreshPromise=(navigator.locks ? navigator.locks.request('locus-refresh',renew) : renew()).finally(()=>{refreshPromise=null;});
  return refreshPromise;
}

type OpcoesRequisicaoApi={auth?:boolean;retryOnUnauthorized?:boolean};
export async function requisicaoApi(path:string,init:RequestInit={},options:OpcoesRequisicaoApi={}):Promise<Response> {
  let response=await send(path,init);
  if((options.auth??true) && response.status===401 && (options.retryOnUnauthorized??true)) {
    if(await renovarSessao())response=await send(path,init);
    else notificarSessaoExpirada();
  }
  if(path.startsWith('/auth/') && response.ok) {
    const data=await response.clone().json().catch(()=>({}));
    if(typeof data.csrf_token==='string')csrfToken=data.csrf_token;
  }
  return response;
}

export async function restaurarSessao():Promise<boolean> {
  if(restorePromise)return restorePromise;
  restorePromise=requisicaoApi('/auth/account/').then(r=>r.ok).catch(()=>false).finally(()=>{restorePromise=null;});
  return restorePromise;
}

async function mensagemErro(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as Record<string, unknown>;
    const value = data.detail ?? data.error ?? data.mensagem ?? data.non_field_errors;
    if (Array.isArray(value)) return String(value[0] ?? `Erro HTTP ${response.status}`);
    if (typeof value === 'string') return value;

    for (const fieldValue of Object.values(data)) {
      if (Array.isArray(fieldValue) && fieldValue.length > 0) return String(fieldValue[0]);
      if (typeof fieldValue === 'string') return fieldValue;
    }

    return JSON.stringify(data);
  } catch {
    const text = await response.text().catch(() => '');
    return text || `Erro HTTP ${response.status}`;
  }
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
  options: OpcoesRequisicaoApi = {}
): Promise<T> {
  const response = await requisicaoApi(path, init, options);
  if (!response.ok) {
    throw new ErroApi(await mensagemErro(response), response.status);
  }
  return response.json() as Promise<T>;
}

export async function apiSemRetorno(
  path: string,
  init: RequestInit = {},
  options: OpcoesRequisicaoApi = {}
): Promise<void> {
  const response = await requisicaoApi(path, init, options);
  if (!response.ok) {
    throw new ErroApi(await mensagemErro(response), response.status);
  }
}

export async function encerrarSessao():Promise<void> {
  await apiSemRetorno('/auth/logout/',{method:'POST'},{auth:false});
  notificarSessaoExpirada();
}
