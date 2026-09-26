import { useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import './UserLogin.css';

interface UserLoginProps {
  onLoginSuccess: () => void;
  onNavigateToRegister: () => void;
}

const UserLogin = ({ onLoginSuccess, onNavigateToRegister }: UserLoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha_token, setCaptcha_token] = useState<string | null>(null);
  console.log("A minha chave é: ", import.meta.env.VITE_RECAPTCHA_SITE_KEY);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const response = await fetch('http://localhost:8000/api/auth/login/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, captcha_token })
    });
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('access_token', data.access);
      onLoginSuccess();
    }
  };

  return (
    <div className="page-background">
      <div className="card-login">
        <div className="logo-pill">Locus</div>
        <h1>Bem-vindo!</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="captcha-container">
              <ReCAPTCHA sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY} onChange={setCaptcha_token} />
            </div>
          </div>
          <button type="submit" className="btn-entrar">
            Entrar
          </button>
          <p className="auth-link" onClick={onNavigateToRegister}>Não tem conta? Registre-se!</p>
        </form>
      </div>
    </div>
  );
};

export default UserLogin;