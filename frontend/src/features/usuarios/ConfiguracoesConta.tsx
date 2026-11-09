import PageHeader from '../../components/PageHeader';
import { useEffect, useState } from 'react';
import { limparTokensAntigos, URL_BASE_API } from '../../services/apiClient';
import {
  excluirConta,
  obterUsuarioAtual,
  atualizarConta,
  solicitarAlteracaoEmail,
  type UsuarioAtual,
} from './apiUsuarios';
import './ConfiguracoesConta.css';
import SegundoFatorConta from './SegundoFatorConta';

type ConfiguracoesContaProps = {
  onBack: () => void;
  embedded?: boolean;
  onAccountUpdated?: () => void;
  onAccountDeleted: () => void;
};

export default function ConfiguracoesConta({ onBack, onAccountDeleted, embedded = false, onAccountUpdated }: ConfiguracoesContaProps) {
  const [user, setUser] = useState<UsuarioAtual | null>(null);
  const [showEmailForm,setShowEmailForm]=useState(false);
  const [newEmail,setNewEmail]=useState('');
  const [emailPassword,setEmailPassword]=useState('');
  const [emailBusy,setEmailBusy]=useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Carregando conta...');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);

  useEffect(() => {
    obterUsuarioAtual()
      .then((account) => {
        setUser(account);
        setUsername(account.username);
        setMessage('');
      })
      .catch(() => {
        setError('Não foi possível carregar os dados da conta.');
        setMessage('');
      });
  }, []);

  async function handleSave() {
    const nextUsername = username.trim();
    if (!nextUsername) {
      setError('Informe um nome de usuário.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const updated = await atualizarConta(nextUsername);
      setUser(updated);
      setUsername(updated.username);
      setMessage('Conta atualizada com sucesso.');
      onAccountUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a conta.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEmailChange() {
    setEmailBusy(true);setError('');setMessage('');
    try {
      const result=await solicitarAlteracaoEmail(newEmail.trim(),emailPassword);
      setUser(await obterUsuarioAtual());setEmailPassword('');setShowEmailForm(false);setMessage(result.detail);
    } catch(e) {setError(e instanceof Error?e.message:'Não foi possível solicitar a alteração.');}
    finally {setEmailBusy(false);}
  }

  async function handleDelete() {
    if (!password) {
      setError('Informe sua senha atual para excluir a conta.');
      return;
    }

    const confirmed = window.confirm(
      'Excluir sua conta? O acesso será encerrado e seus conteúdos serão removidos da aplicação.'
    );
    if (!confirmed) return;

    setDeleting(true);
    setError('');

    try {
      await excluirConta(password);
      limparTokensAntigos();
      onAccountDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a conta.');
    } finally {
      setDeleting(false);
    }
  }

  const Content = embedded ? 'div' : 'main';
  return (
    <div className={`account-page${embedded ? ' is-embedded' : ''}`}>
      {!embedded && <PageHeader title="Minha conta" onBack={onBack} />}

      <Content className="account-card">
        <h1>Dados da conta</h1>

        {message && <p className="account-message">{message}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}

        {user && (
          <>
            {user.is_staff && <p><a href={new URL('/admin/', URL_BASE_API).href} target="_blank" rel="noopener noreferrer">Abrir administração</a></p>}
            <label htmlFor="account-username">Nome de usuário</label>
            <input
              id="account-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={150}
              disabled={saving || deleting || emailBusy}
            />

            <label htmlFor="account-email">E-mail</label>
            <input id="account-email" value={user.email} disabled />
            {user.pending_email && <small>Confirmação pendente: {user.pending_email}</small>}
            {!showEmailForm ? <button type="button" className="account-primary" disabled={saving || deleting || emailBusy}
              onClick={()=>{setShowEmailForm(true);setError('');}}>Alterar e-mail</button> : <section>
              <p>O e-mail atual permanece válido até a confirmação do novo endereço.</p>
              <label htmlFor="account-new-email">Novo e-mail</label>
              <input id="account-new-email" type="email" value={newEmail} maxLength={254} autoComplete="email"
                onChange={e=>setNewEmail(e.target.value)} disabled={emailBusy}/>
              <label htmlFor="account-email-password">Senha atual para alterar e-mail</label>
              <input id="account-email-password" type="password" autoComplete="current-password" value={emailPassword}
                onChange={e=>setEmailPassword(e.target.value)} disabled={emailBusy}/>
              <div className="account-actions">
                <button type="button" className="account-primary" disabled={saving || deleting || emailBusy || !newEmail.trim() || !emailPassword}
                  onClick={()=>void handleEmailChange()}>{emailBusy?'Enviando...':'Enviar confirmação'}</button>
                <button type="button" className="account-primary" disabled={emailBusy} onClick={()=>{setShowEmailForm(false);setEmailPassword('');setNewEmail('');}}>Cancelar</button>
              </div>
            </section>}

            <button
              type="button"
              className="account-primary"
              onClick={() => void handleSave()}
              disabled={saving || deleting || emailBusy}
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>

            <SegundoFatorConta />

            <section className="account-danger">
              <h2>Excluir conta</h2>

              {!showDeleteForm ? (
                <button
                  type="button"
                  className="account-delete"
                  disabled={saving}
                  onClick={() => {
                    setError('');
                    setShowDeleteForm(true);
                  }}
                >
                  Excluir conta
                </button>
              ) : (
                <>
                  <p>
                    Sua conta será excluida junto com seus dados.
                    Para utilizar o Locus novamente após a exclusão, é necessário criar uma nova conta .
                  </p>

                  <label htmlFor="account-password">Senha atual</label>
                  <input
                    id="account-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    disabled={deleting || saving || emailBusy}
                  />

                  <div className="account-actions">
                    <button
                      type="button"
                      className="account-delete"
                      onClick={() => void handleDelete()}
                      disabled={deleting || saving || emailBusy || !password}
                    >
                      {deleting ? 'Excluindo...' : 'Confirmar exclusão'}
                    </button>

                    <button
                      type="button"
                      className="account-primary"
                      disabled={deleting}
                      onClick={() => {
                        setShowDeleteForm(false);
                        setPassword('');
                        setError('');
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </Content>
    </div>
  );
}
