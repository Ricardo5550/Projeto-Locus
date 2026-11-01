import { useState } from 'react';
import { apiJson, limparTokensAntigos } from '../../services/apiClient';
import '../login/RecuperacaoAcesso.css';
export default function ConfirmarAlteracaoEmail({onBackToLogin}:{onBackToLogin:()=>void}) {
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [message,setMessage]=useState('Confirme para passar a utilizar o novo e-mail no login. Suas sessões anteriores serão encerradas.');
  const token=new URLSearchParams(window.location.search).get('change_email')??'';
  async function confirm() {
    setBusy(true);
    try {
      const result=await apiJson<{detail:string}>('/auth/account/email/confirm/',{method:'POST',body:JSON.stringify({token})},{auth:false});
      limparTokensAntigos();setDone(true);setMessage(result.detail);window.history.replaceState({},'','/');
    } catch(e) {setMessage(e instanceof Error?e.message:'Não foi possível confirmar a alteração.');}
    finally {setBusy(false);}
  }
  return <div className="page-background"><main className="auth-recovery-card">
    <h1>Confirmar novo e-mail</h1><p role="status">{message}</p>
    {!done && <button type="button" disabled={busy || !token} onClick={()=>void confirm()}>{busy?'Confirmando...':'Confirmar alteração de e-mail'}</button>}
    <button type="button" disabled={busy} onClick={onBackToLogin}>Voltar ao login</button>
  </main></div>;
}
