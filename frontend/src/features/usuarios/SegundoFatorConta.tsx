import { useEffect, useState } from 'react';
import { apiJson } from '../../services/apiClient';
import CodigosRecuperacao from '../../components/CodigosRecuperacao';

type Estado = { enabled: boolean; required: boolean; recovery_remaining: number };
type Configuracao = { secret: string; qr_code: string };
type Acao = 'setup' | 'regenerate' | 'disable';

export default function SegundoFatorConta() {
  const [state, setState] = useState<Estado | null>(null);
  const [action, setAction] = useState<Acao | null>(null);
  const [config, setConfig] = useState<Configuracao | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { apiJson<Estado>('/auth/mfa/').then(setState).catch(() => setError('Não foi possível carregar a configuração de segurança.')); }, []);

  function selecionar(next: Acao | null) {
    setAction(next); setConfig(null); setPassword(''); setCode(''); setError(''); setMessage('');
  }

  async function executar() {
    if (!action) return;
    const operation = config ? 'activate' : action;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await apiJson<Configuracao & { recovery_codes?: string[] }>('/auth/mfa/', {
        method: 'POST', body: JSON.stringify({ action: operation, password, code }),
      });
      if (operation === 'setup') { setConfig(result); setCode(''); }
      else {
        selecionar(null);
        setCodes(result.recovery_codes ?? []);
        setState(await apiJson<Estado>('/auth/mfa/'));
        setMessage(operation === 'disable' ? 'Verificação em duas etapas desativada.' : 'Segurança atualizada. As outras sessões foram encerradas.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível atualizar a segurança.'); }
    finally { setBusy(false); }
  }

  return <section className="account-danger" aria-label="Segurança da conta">
    <h2>Verificação em duas etapas</h2>
    {message && <p role="status">{message}</p>}{error && <p className="account-error" role="alert">{error}</p>}
    {codes.length ? <CodigosRecuperacao codes={codes} onClose={() => setCodes([])} /> : state && <>
      <p>{state.enabled ? `Ativa. Códigos de recuperação disponíveis: ${state.recovery_remaining}.` : 'Adicione uma camada de proteção com Google Authenticator ou outro aplicativo TOTP.'}</p>
      {state.required && <p>Esta proteção é obrigatória para sua conta administrativa.</p>}
      {!action ? <div className="account-actions">
        {!state.enabled ? <button type="button" className="account-primary" onClick={() => selecionar('setup')}>Ativar verificação</button> : <>
          <button type="button" className="account-primary" onClick={() => selecionar('regenerate')}>Gerar novos códigos de recuperação</button>
          {!state.required && <button type="button" className="account-delete" onClick={() => selecionar('disable')}>Desativar verificação</button>}
        </>}
      </div> : <>
        <label htmlFor="mfa-account-password">Senha atual</label>
        <input id="mfa-account-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
        {config && <>
          <p>Escaneie o QR Code no aplicativo ou digite a chave. Confirme um código em até cinco minutos.</p>
          <img src={config.qr_code} width="220" height="220" alt="QR Code do autenticador" />
          <p>Chave: <code className="account-secret">{config.secret}</code></p>
        </>}
        {(config || state.enabled) && <>
          <label htmlFor="mfa-account-code">Código do aplicativo{state.enabled ? ' ou de recuperação' : ''}</label>
          <input id="mfa-account-code" autoComplete="one-time-code" maxLength={80} value={code} onChange={e => setCode(e.target.value)} disabled={busy} />
          <small>Se acabou de usar um código do aplicativo, aguarde o próximo.</small>
        </>}
        <div className="account-actions">
          <button type="button" className={action === 'disable' ? 'account-delete' : 'account-primary'} disabled={busy || !password || ((!!config || state.enabled) && !code)} onClick={() => void executar()}>
            {busy ? 'Processando...' : action === 'disable' ? 'Confirmar desativação' : action === 'regenerate' ? 'Confirmar novos códigos' : config ? 'Confirmar ativação' : 'Configurar autenticador'}
          </button>
          <button type="button" className="account-primary" disabled={busy} onClick={() => selecionar(null)}>Cancelar</button>
        </div>
      </>}
    </>}
  </section>;
}
