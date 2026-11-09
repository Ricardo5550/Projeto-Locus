import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleUserRound } from 'lucide-react';
import SinoNotificacoes from '../notificacoes/SinoNotificacoes';
import PageHeader from '../../components/PageHeader';
import { obterUsuarioAtual } from '../usuarios/apiUsuarios';
import './HomeMenu.css';
import './HomeLayout.css';

export type SecaoHome = 'home' | 'results' | 'questionnaire' | 'acompanhamento' | 'account' | 'terms' | 'privacy';

const titulos: Record<SecaoHome, string> = {
  home: 'Biblioteca',
  results: 'Resultados',
  questionnaire: 'Questionários',
  acompanhamento: 'Acompanhamento',
  account: 'Minha conta',
  terms: 'Termos de Uso',
  privacy: 'Política de Privacidade',
};

export default function HomeLayout({ active, children, onNavigate, onLogout, search, onSearchChange, accountVersion, onNotification, onBack }: {
  active: SecaoHome; children: ReactNode; onNavigate: (section: SecaoHome) => void; onLogout: () => void;
  onBack?: () => void;
  search: string; onSearchChange: (value: string) => void; accountVersion: number; onNotification:(destino:string,id:number)=>void;
}) {
  const [accountName, setAccountName] = useState('Conta');
  const mainRef = useRef<HTMLDivElement>(null);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [active]);
  useEffect(() => {
    let activeRequest = true;
    obterUsuarioAtual().then(user => { if (activeRequest) setAccountName(user.username || user.email); }).catch(() => {});
    return () => { activeRequest = false; };
  }, [accountVersion]);
  function nav(section: SecaoHome) {
    return <button className="home-nav-button" type="button" aria-current={active === section ? 'page' : undefined}
      onClick={() => onNavigate(section)}>{titulos[section]}</button>;
  }
  return <div className="home-layout home-layout--shared">
    <aside className="home-sidebar" aria-label="Menu principal">
      <div className="home-brand"><div className="home-brand__logo">L</div><strong>Locus</strong></div>
      <nav aria-label="Conteúdos">
        {nav('home')}
        {nav('questionnaire')}
        {nav('results')}
        {nav('acompanhamento')}
      </nav>
      <nav className="home-sidebar__bottom" aria-label="Informações e sessão">
        {nav('terms')}{nav('privacy')}
        <button className="home-nav-button home-nav-button--logout" type="button" onClick={onLogout}>Sair</button>
      </nav>
    </aside>
    <div className="home-main" ref={mainRef}>
      <PageHeader title={titulos[active]} onBack={onBack} actions={<>
        {active === 'home' && <input className="home-search" type="search" placeholder="Buscar nesta pasta" aria-label="Buscar nesta pasta"
          value={search} maxLength={150} onChange={event => onSearchChange(event.target.value)} />}
        <SinoNotificacoes onOpen={onNotification} />
        <button type="button" className="home-account" title="Minha conta" aria-label={`Minha conta: ${accountName}`}
          aria-current={active === 'account' ? 'page' : undefined} onClick={() => onNavigate('account')}>
          <CircleUserRound size={19} aria-hidden="true" /><span>{accountName}</span>
        </button>
      </>} />
      <main className="home-view" key={active}>{children}</main>
    </div>
  </div>;
}
