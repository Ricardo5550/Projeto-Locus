import { useEffect, useRef, useState } from 'react';
import HomeMenu from './features/home/HomeMenu';
import HomeLayout, { type SecaoHome } from './features/home/HomeLayout';
import ConfiguracoesConta from './features/usuarios/ConfiguracoesConta';
import MapaMental from './features/mapas/MapaMental';
import AnotacaoEditor, {
  type ContextoRelacionamentoAnotacao,
  type DestinoRelacionamentoAnotacao,
} from './features/anotacoes/AnotacaoEditor';
import Cadastro from './features/cadastro/Cadastro';
import Login from './features/login/Login';
import RecuperarSenha from './features/login/RecuperarSenha';
import RedefinirSenha from './features/login/RedefinirSenha';
import VerificarEmail from './features/cadastro/VerificarEmail';
import TermosUso from './features/usuarios/TermosUso';
import PoliticaPrivacidade from './features/usuarios/PoliticaPrivacidade';
import ConfirmarAlteracaoEmail from './features/usuarios/ConfirmarAlteracaoEmail';
import Resultados from './features/revisoes/Resultados';
import Questionario, { type NavegacaoQuestionario } from './features/revisoes/Questionario';
import { restaurarSessao, encerrarSessao } from './services/apiClient';
import Acompanhamento, { type NavegacaoAcompanhamento } from './features/acompanhamento/Acompanhamento';
import './App.css';

type Tela =
  | 'checking'
  | 'change-email'
  | 'account'
  | 'home'
  | 'mindmap'
  | 'annotation'
  | 'register'
  | 'login'
  | 'forgot-password'
  | 'reset-password'
  | 'verify-email'
  | 'terms'
  | 'privacy'
  | 'results'
  | 'acompanhamento'
  | 'questionnaire';

type EntradaHistorico = {
  screen: 'mindmap' | 'annotation';
  id: number | null;
  breadcrumb: string[];
  mapViewStack?: string[];
};

function telaInicial(): Tela {
  const params = new URLSearchParams(window.location.search);
  if (params.has('change_email')) return 'change-email';
  if (params.has('verify_email')) return 'verify-email';
  if (params.has('reset_uid') && params.has('reset_token')) return 'reset-password';
  return 'checking';
}

function limparParametrosAutenticacao() {
  window.history.replaceState({}, '', '/');
}

export default function App() {
  const [screen, setScreen] = useState<Tela>(telaInicial);
  const [libraryFolderId, setLibraryFolderId] = useState<number | null>(null);
  const [loginNotice, setLoginNotice] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [entradaQuestionario,setEntradaQuestionario]=useState(0);
  const navegacaoAcompanhamento = useRef<NavegacaoAcompanhamento>(null);
  const [entradaAcompanhamento, setEntradaAcompanhamento] = useState(0);
  const [avisoCanal, setAvisoCanal] = useState<{ id: number; aba: 'duvidas' | 'materiais' }>();
  const [emDetalheAcompanhamento, setEmDetalheAcompanhamento] = useState(false);
  const navegacaoQuestionario = useRef<NavegacaoQuestionario>(null);
  const [emDetalheQuestionario, setEmDetalheQuestionario] = useState(false);
  const [questionarioAberto,setQuestionarioAberto]=useState<number|null>(null);
  const [abrirDevolutiva,setAbrirDevolutiva]=useState(false);
  const [retornoQuestionario,setRetornoQuestionario]=useState<number|null>(null);
  const [revisaoEmAndamento,setRevisaoEmAndamento]=useState(false);
  const [accountVersion, setAccountVersion] = useState(0);
  const [currentMapId, setCurrentMapId] = useState<number | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<number | null>(null);
  const [currentMapViewStack, setCurrentMapViewStack] = useState<string[]>();
  const [currentMapSelectedNodeId, setCurrentMapSelectedNodeId] = useState<string>();
  const [breadcrumb, setBreadcrumb] = useState<string[]>(['Início']);
  const [history, setHistory] = useState<EntradaHistorico[]>([]);
  const [noteRelationshipContext, setNoteRelationshipContext] =
    useState<ContextoRelacionamentoAnotacao | null>(null);

  useEffect(() => {
    function handleSessionEnd() {
      setScreen('login');
      setLibraryFolderId(null);
      setLibrarySearch('');
      setHistory([]);
      setCurrentMapId(null);
      setCurrentNoteId(null);
      setCurrentMapViewStack(undefined);
      setCurrentMapSelectedNodeId(undefined);
      setNoteRelationshipContext(null);
      setBreadcrumb(['Início']);
    }

    window.addEventListener('auth:logout', handleSessionEnd);
    return () => window.removeEventListener('auth:logout', handleSessionEnd);
  }, []);

  useEffect(() => {
    if (screen !== 'checking') return;
    let active = true;
    restaurarSessao().then(ok => { if (active) setScreen(ok ? 'home' : 'login'); });
    return () => { active = false; };
  }, [screen]);

  async function handleLogout() {
    if(revisaoEmAndamento&&!window.confirm('Sair sem finalizar? Esta sessão não será contabilizada.'))return;
    try { await encerrarSessao(); }
    catch { window.alert('Não foi possível encerrar a sessão no servidor. Verifique a conexão e tente novamente.'); }
  }

  function openNewMindMap() {
    setHistory([]);
    setCurrentMapId(null);
    setCurrentNoteId(null);
    setCurrentMapViewStack(undefined);
    setCurrentMapSelectedNodeId(undefined);
    setNoteRelationshipContext(null);
    setBreadcrumb(['Início', 'Mapa mental']);
    setScreen('mindmap');
  }

  function openSavedMindMap(id: number, title: string) {
    setHistory([]);
    setCurrentMapId(id);
    setCurrentNoteId(null);
    setCurrentMapViewStack(undefined);
    setCurrentMapSelectedNodeId(undefined);
    setNoteRelationshipContext(null);
    setBreadcrumb(['Início', title]);
    setScreen('mindmap');
  }

  function openNewNote() {
    setHistory([]);
    setCurrentNoteId(null);
    setCurrentMapId(null);
    setCurrentMapViewStack(undefined);
    setCurrentMapSelectedNodeId(undefined);
    setNoteRelationshipContext(null);
    setBreadcrumb(['Início', 'Nova anotação']);
    setScreen('annotation');
  }

  function openSavedNote(id: number, title: string) {
    setRetornoQuestionario(null);
    setHistory([]);
    setCurrentNoteId(id);
    setCurrentMapId(null);
    setCurrentMapViewStack(undefined);
    setCurrentMapSelectedNodeId(undefined);
    setNoteRelationshipContext(null);
    setBreadcrumb(['Início', title]);
    setScreen('annotation');
  }

  function openAnnotationFromMap(
    blockName: string,
    noteId: number,
    parentMapId: number,
    viewStack: string[],
    sourceNodeId: string
  ) {
    setHistory((current) => [
      ...current,
      {
        screen: 'mindmap',
        id: parentMapId,
        breadcrumb: [...breadcrumb],
        mapViewStack: [...viewStack],
      },
    ]);

    setCurrentMapViewStack([...viewStack]);
    setCurrentMapSelectedNodeId(undefined);
    setBreadcrumb((current) => [...current, blockName]);
    setCurrentNoteId(noteId);
    setCurrentMapId(null);
    setNoteRelationshipContext({
      parentMapId,
      parentViewStack: [...viewStack],
      sourceNodeId,
    });
    setScreen('annotation');
  }

  function navigateFromAnnotation(target: DestinoRelacionamentoAnotacao) {
    const parentHistory = history[history.length - 1];
    const parentBreadcrumb =
      parentHistory?.screen === 'mindmap'
        ? parentHistory.breadcrumb
        : breadcrumb.slice(0, -1);

    if (
      target.linkedContentType === 'annotation' &&
      target.linkedAnnotationId
    ) {
      setCurrentNoteId(target.linkedAnnotationId);
      setCurrentMapId(null);
      setCurrentMapViewStack([...target.parentViewStack]);
      setCurrentMapSelectedNodeId(undefined);
      setBreadcrumb([...parentBreadcrumb, target.blockName]);
      setNoteRelationshipContext({
        parentMapId: target.parentMapId,
        parentViewStack: [...target.parentViewStack],
        sourceNodeId: target.nodeId,
      });
      setScreen('annotation');
      return;
    }

    // Ao sair da anotação para um mapa relacionado, o próprio MindMap passa
    // a controlar o retorno entre a visão interna e a visão externa.
    setHistory((current) => current.slice(0, -1));
    setCurrentMapId(target.parentMapId);
    setCurrentNoteId(null);
    setNoteRelationshipContext(null);
    setBreadcrumb(parentBreadcrumb);

    if (target.linkedContentType === 'mindmap' && target.linkedViewId) {
      setCurrentMapViewStack([
        ...target.parentViewStack,
        target.linkedViewId,
      ]);
      setCurrentMapSelectedNodeId(undefined);
    } else {
      // Se o bloco conectado ainda não possui conteúdo interno, volta para a
      // visão externa já com esse bloco selecionado.
      setCurrentMapViewStack([...target.parentViewStack]);
      setCurrentMapSelectedNodeId(target.nodeId);
    }

    setScreen('mindmap');
  }

  function goHome() {
    setHistory([]);
    setLibraryFolderId(null);
    setLibrarySearch('');
    setCurrentMapId(null);
    setCurrentNoteId(null);
    setCurrentMapViewStack(undefined);
    setCurrentMapSelectedNodeId(undefined);
    setNoteRelationshipContext(null);
    setBreadcrumb(['Início']);
    setScreen('home');
  }

  function openHomeSection(section: SecaoHome) {
    if(revisaoEmAndamento&&!window.confirm('Sair sem finalizar? Esta sessão não será contabilizada.'))return;
    setRevisaoEmAndamento(false);
    setEntradaQuestionario(n=>n+1);
    setQuestionarioAberto(null);
    setAbrirDevolutiva(false);
    if (section === 'home') { goHome(); return; }
    if (section === 'acompanhamento') {
      setAvisoCanal(undefined);
      setEntradaAcompanhamento(n => n + 1);
    }
    setHistory([]);
    setScreen(section);
  }

  function goBack() {
    const previous = history[history.length - 1];

    if (!previous) {
      setScreen('home');
      setCurrentMapId(null);
      setCurrentNoteId(null);
      setCurrentMapViewStack(undefined);
      setCurrentMapSelectedNodeId(undefined);
      setNoteRelationshipContext(null);
      setBreadcrumb(['Início']);
      return;
    }

    setHistory((current) => current.slice(0, -1));
    setBreadcrumb(previous.breadcrumb);
    setScreen(previous.screen);

    if (previous.screen === 'mindmap') {
      setCurrentMapId(previous.id);
      setCurrentNoteId(null);
      setCurrentMapViewStack(previous.mapViewStack);
      setCurrentMapSelectedNodeId(undefined);
      setNoteRelationshipContext(null);
    } else {
      setCurrentNoteId(previous.id);
      setCurrentMapId(null);
      setCurrentMapViewStack(undefined);
      setCurrentMapSelectedNodeId(undefined);
      setNoteRelationshipContext(null);
    }
  }

  function updateLastBreadcrumb(title: string) {
    setBreadcrumb((current) => {
      if (current.length === 0) return [title];
      return [...current.slice(0, -1), title];
    });
  }

  if (screen === 'checking') return <p role="status">Verificando sessão...</p>;

  if (screen === 'change-email') return <ConfirmarAlteracaoEmail onBackToLogin={() => {
    limparParametrosAutenticacao();
    setLoginNotice('Entre com o endereço de e-mail atual da sua conta.');
    setScreen('login');
  }} />;

  if (screen === 'verify-email') {
    return (
      <VerificarEmail
        onBackToLogin={() => {
          limparParametrosAutenticacao();
          setLoginNotice('E-mail confirmado. Entre com sua conta.');
          setScreen('login');
        }}
      />
    );
  }

  if (screen === 'reset-password') {
    return (
      <RedefinirSenha
        onBackToLogin={() => {
          limparParametrosAutenticacao();
          setLoginNotice('Use sua nova senha para entrar.');
          setScreen('login');
        }}
      />
    );
  }

  if (screen === 'forgot-password') {
    return <RecuperarSenha onBackToLogin={() => setScreen('login')} />;
  }

  if (screen === 'home' || screen === 'questionnaire' || screen === 'results' ||
      screen === 'acompanhamento' || screen === 'account' || screen === 'terms' || screen === 'privacy') {
    return <HomeLayout active={screen} onNavigate={openHomeSection} onLogout={() => void handleLogout()}
      onBack={screen === 'questionnaire' && emDetalheQuestionario
        ? () => navegacaoQuestionario.current?.voltar()
        : screen === 'acompanhamento' && emDetalheAcompanhamento
          ? () => navegacaoAcompanhamento.current?.voltar()
          : undefined}
      search={librarySearch} onSearchChange={setLibrarySearch} accountVersion={accountVersion} onNotification={(destino,id)=>{
        if (destino !== 'questionnaire' && destino !== 'acompanhamento' && destino !== 'acompanhamento-duvidas') return;
        if(revisaoEmAndamento&&!window.confirm('Sair sem finalizar? Esta sessão não será contabilizada.'))return;
        if (destino !== 'questionnaire') {
          setRevisaoEmAndamento(false);
          setAvisoCanal({ id, aba: destino === 'acompanhamento-duvidas' ? 'duvidas' : 'materiais' });
          setEntradaAcompanhamento(n => n + 1);
          setHistory([]);
          setScreen('acompanhamento');
          return;
        }
        setRevisaoEmAndamento(false);setEntradaQuestionario(n=>n+1);setQuestionarioAberto(id);setAbrirDevolutiva(false);setScreen('questionnaire');
      }}>
      {screen === 'home' && <HomeMenu
        folderId={libraryFolderId}
        search={librarySearch}
        onFolderChange={id => { setLibraryFolderId(id); setLibrarySearch(''); }}
        onCreateMindMap={openNewMindMap}
        onCreateNote={openNewNote}
        onOpenMindMap={openSavedMindMap}
        onOpenNote={openSavedNote}
      />}
      {screen === 'results' && <Resultados />}
      {screen === 'questionnaire' && <Questionario key={`${questionarioAberto??'lista'}-${entradaQuestionario}`} ref={navegacaoQuestionario} initialId={questionarioAberto} initialDevolutiva={abrirDevolutiva} onSessionChange={setRevisaoEmAndamento} onDetalheChange={setEmDetalheQuestionario} onOpenNote={(id,title,qid)=>{
        setRetornoQuestionario(qid);setCurrentNoteId(id);setNoteRelationshipContext(null);setBreadcrumb(['Início','Questionários',title]);setScreen('annotation');
      }} />}
      {screen === 'acompanhamento' && <Acompanhamento
        key={entradaAcompanhamento} avisoCanal={avisoCanal} ref={navegacaoAcompanhamento} onDetalheChange={setEmDetalheAcompanhamento} />}
      {screen === 'account' && <ConfiguracoesConta embedded onBack={goHome}
        onAccountUpdated={() => setAccountVersion(current => current + 1)}
        onAccountDeleted={() => {
          window.dispatchEvent(new Event('auth:logout'));
          setLoginNotice('Conta excluída com sucesso.');
        }}
      />}
      {screen === 'terms' && <TermosUso embedded onBack={goHome} />}
      {screen === 'privacy' && <PoliticaPrivacidade embedded onBack={goHome} />}
    </HomeLayout>;
  }

  if (screen === 'annotation') {
    return (
      <AnotacaoEditor
        noteId={currentNoteId}
        initialFolderId={libraryFolderId}
        initialTitle={breadcrumb[breadcrumb.length - 1] || 'Nova anotação'}
        breadcrumb={breadcrumb}
        onBack={()=>{if(retornoQuestionario){setQuestionarioAberto(retornoQuestionario);setAbrirDevolutiva(true);setRetornoQuestionario(null);setScreen('questionnaire');}else goBack();}}
        onHome={()=>{setRetornoQuestionario(null);goHome();}}
        relationshipContext={noteRelationshipContext}
        onNavigateRelationship={navigateFromAnnotation}
        onCreated={(id, title) => {
          setCurrentNoteId(id);
          updateLastBreadcrumb(title);
        }}
      />
    );
  }

  if (screen === 'register') {
    return (
      <Cadastro
        onNavigateToLogin={() => setScreen('login')}
        onRegistrationSuccess={() => {
          setLoginNotice('Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.');
          setScreen('login');
        }}
      />
    );
  }

  if (screen === 'login') {
    return (
      <Login
        notice={loginNotice}
        onLoginSuccess={() => {
          setLoginNotice('');
          setScreen('home');
        }}
        onNavigateToRegister={() => {
          setLoginNotice('');
          setScreen('register');
        }}
        onNavigateToForgotPassword={() => {
          setLoginNotice('');
          setScreen('forgot-password');
        }}
      />
    );
  }

  return (
    <MapaMental
      mapId={currentMapId}
      initialFolderId={libraryFolderId}
      breadcrumb={breadcrumb}
      initialViewStack={currentMapViewStack}
      initialSelectedNodeId={currentMapSelectedNodeId}
      onBack={goBack}
      onHome={goHome}
      onMapCreated={(id, title) => {
        setCurrentMapId(id);
        updateLastBreadcrumb(title);
      }}
      onOpenAnnotation={openAnnotationFromMap}
    />
  );
}