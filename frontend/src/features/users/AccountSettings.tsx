import { useEffect, useState } from 'react';
import { clearAuthTokens } from '../../services/apiClient';
import {
  deleteAccount,
  getCurrentUser,
  updateAccount,
  type CurrentUser,
} from './userApi';
import './AccountSettings.css';

type AccountSettingsProps = {
  onBack: () => void;
  onAccountDeleted: () => void;
};

export default function AccountSettings({ onBack, onAccountDeleted }: AccountSettingsProps) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Carregando conta...');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getCurrentUser()
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
      const updated = await updateAccount(nextUsername);
      setUser(updated);
      setUsername(updated.username);
      setMessage('Conta atualizada com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a conta.');
    } finally {
      setSaving(false);
    }
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
      await deleteAccount(password);
      clearAuthTokens();
      onAccountDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a conta.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="account-page">
      <header className="account-page__header">
        <button type="button" onClick={onBack}>← Voltar</button>
        <strong>Minha conta</strong>
      </header>

      <main className="account-card">
        <h1>Dados da conta</h1>

        {message && <p className="account-message">{message}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}

        {user && (
          <>
            <label htmlFor="account-username">Nome de usuário</label>
            <input
              id="account-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={150}
              disabled={saving || deleting}
            />

            <label htmlFor="account-email">E-mail</label>
            <input id="account-email" value={user.email} disabled />
            <small>
              O e-mail permanece bloqueado nesta versão porque alterações exigem nova confirmação.
            </small>

            <button
              type="button"
              className="account-primary"
              onClick={() => void handleSave()}
              disabled={saving || deleting}
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>

            <section className="account-danger">
              <h2>Excluir conta</h2>
              <p>
                A conta será desativada e anonimizada. Seus conteúdos deixam de ficar disponíveis,
                enquanto registros de auditoria permanecem para rastreabilidade.
              </p>
              <label htmlFor="account-password">Confirme sua senha atual</label>
              <input
                id="account-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={deleting}
              />
              <button
                type="button"
                className="account-delete"
                onClick={() => void handleDelete()}
                disabled={deleting || saving}
              >
                {deleting ? 'Excluindo...' : 'Excluir minha conta'}
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
