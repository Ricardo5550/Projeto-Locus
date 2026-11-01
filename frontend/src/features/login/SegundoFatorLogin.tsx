import { useEffect, useState } from 'react';
import { apiJson } from '../../services/apiClient';
import CodigosRecuperacao from '../../components/CodigosRecuperacao';

export default function SegundoFatorLogin({ challenge, setup, onSuccess, onCancel }: {
  challenge: string; setup: boolean; onSuccess: () => void; onCancel: () => void;
}) {
  const [config, setConfig] = useState<{ secret: string; qr_code: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<string[]>([]);
  useEffect(() => {
    if (!setup) return;
    let active = true;
    apiJson<{ secret: string; qr_code: string }>('/auth/mfa/enroll/', {
      method: 'POST', body: JSON.stringify({ challenge }),
    }, { auth: false }).then(data => { if (active) setConfig(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Não foi possível configurar o autenticador.'); });
    return () => { active = false; };
  }, [challenge, setup]);
  async function confirmar(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await apiJson<{ recovery_codes?: string[] }>(setup ? '/auth/mfa/enroll/' : '/auth/mfa/verify/', {
        method: 'POST', body: JSON.stringify({ challenge, code }),
      }, { auth: false });
      setCode(''); setConfig(null);
      if (data.recovery_codes?.length) setRecovery(data.recovery_codes);
      else onSuccess();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível confirmar o código.'); }
    finally { setBusy(false); }
  }
  return <div className="page-background"><div className="card-login" style={{ maxWidth: 560, width: 'min(560px, 100%)' }}>
    {recovery.length ? <CodigosRecuperacao codes={recovery} onClose={() => { setRecovery([]); onSuccess(); }} /> : <>
      <h1>{setup ? 'Configure seu autenticador' : 'Verificação em duas etapas'}</h1>
      {setup ? <>
        <p>Contas administrativas exigem 2FA. Adicione esta conta no Google Authenticator ou outro aplicativo TOTP. A configuração expira em cinco minutos.</p>
        {config && <><img src={config.qr_code} width="220" height="220" alt="QR Code do autenticador" />
          <p>Chave: <code style={{ overflowWrap: 'anywhere' }}>{config.secret}</code></p></>}
      </> : <p>Informe o código do aplicativo ou um dos seus códigos de recuperação. Um código já utilizado não pode ser repetido; aguarde o próximo código do aplicativo.</p>}
      <form onSubmit={confirmar}>
        <label htmlFor="mfa-login-code">Código {setup ? 'do aplicativo' : 'do aplicativo ou de recuperação'}</label>
        <input id="mfa-login-code" value={code} onChange={e => setCode(e.target.value)} maxLength={80} autoComplete="one-time-code" required autoFocus disabled={busy} />
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="btn-entrar" disabled={busy || setup && !config}>{busy ? 'Validando...' : 'Confirmar código'}</button>
        <button type="button" className="auth-link auth-link-button" onClick={onCancel} disabled={busy}>Cancelar e voltar ao login</button>
      </form>
    </>}
  </div></div>;
}
