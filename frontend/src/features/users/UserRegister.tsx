import { useState } from "react";
import type { FormEvent } from "react";
import './UserRegister.css';

interface UserRegisterProps {
  onNavigateToLogin: () => void;
}

export default function UserRegister({ onNavigateToLogin }: UserRegisterProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch('http://localhost:8000/api/auth/registro/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, email, password1, password2 })
    });
    if (response.ok) {
      alert('Usuário registrado com sucesso!');
    } else {
      alert('Erro ao registrar usuário.');
    }
  };

  return (
    <div className="page-background">
      <div className="card-registro">
        <div className="logo-pill">Locus</div>
        <h1>Crie sua conta</h1>
        
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label htmlFor="username">Nome de usuário</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password1">Senha</label>
            <input
              type="password"
              id="password1"
              value={password1}
              onChange={(e) => setPassword1(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password2">Confirmar senha</label>
            <input
              type="password"
              id="password2"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-registrar">Registrar</button>
          <p className="auth-link" onClick={onNavigateToLogin}>Já tem conta? Entre aqui!</p>
        </form>
      </div>
    </div>
  );
}