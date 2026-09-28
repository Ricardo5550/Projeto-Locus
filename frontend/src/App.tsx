import { useEffect, useState } from 'react';
import HomeMenu from './features/home/HomeMenu';
import MindMap from './features/mindmaps/MindMap';
import NoteEditor, {
  type NoteRelationshipContext,
  type NoteRelationshipTarget,
} from './features/notes/NoteEditor';
import UserRegister from './features/users/UserRegister';
import UserLogin from './features/users/UserLogin';
import ForgotPassword from './features/users/ForgotPassword';
import ResetPassword from './features/users/ResetPassword';
import VerifyEmail from './features/users/VerifyEmail';
import UserTerms from './features/users/UserTerms';
import UserPrivacyPolicy from './features/users/UserPrivacyPolicy';
import Questionnaire from './features/reviews/Questionnaire';
import { hasStoredSession, logout } from './services/apiClient';
import './App.css';

type Screen =
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
  | 'questionnaire';

type HistoryEntry = {
  screen: 'mindmap' | 'annotation';
  id: number | null;
  breadcrumb: string[];
  mapViewStack?: string[];
};

function initialScreen(): Screen {
  const params = new URLSearchParams(window.location.search);
  if (params.has('verify_email')) return 'verify-email';
  if (params.has('reset_uid') && params.has('reset_token')) return 'reset-password';
  return hasStoredSession() ? 'home' : 'login';
}

function clearAuthLinkParams() {
  window.history.replaceState({}, '', '/');
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [loginNotice, setLoginNotice] = useState('');
  const [currentMapId, setCurrentMapId] = useState<number | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<number | null>(null);
  const [currentMapViewStack, setCurrentMapViewStack] = useState<string[]>();
  const [currentMapSelectedNodeId, setCurrentMapSelectedNodeId] = useState<string>();
  const [breadcrumb, setBreadcrumb] = useState<string[]>(['Início']);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [noteRelationshipContext, setNoteRelationshipContext] =
    useState<NoteRelationshipContext | null>(null);

  useEffect(() => {
    function handleSessionEnd() {
      setScreen('login');
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

  async function handleLogout() {
    await logout();
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

  function navigateFromAnnotation(target: NoteRelationshipTarget) {
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

  if (screen === 'verify-email') {
    return (
      <VerifyEmail
        onBackToLogin={() => {
          clearAuthLinkParams();
          setLoginNotice('E-mail confirmado. Entre com sua conta.');
          setScreen('login');
        }}
      />
    );
  }

  if (screen === 'reset-password') {
    return (
      <ResetPassword
        onBackToLogin={() => {
          clearAuthLinkParams();
          setLoginNotice('Use sua nova senha para entrar.');
          setScreen('login');
        }}
      />
    );
  }

  if (screen === 'forgot-password') {
    return <ForgotPassword onBackToLogin={() => setScreen('login')} />;
  }

  if (screen === 'terms') {
    return <UserTerms onBack={() => setScreen('home')} />;
  }

  if (screen === 'privacy') {
    return <UserPrivacyPolicy onBack={() => setScreen('home')} />;
  }

  if (screen === 'questionnaire') {
    return <Questionnaire onBack={goBack} />;
  }

  if (screen === 'home') {
    return (
      <HomeMenu
        onOpenQuestionnaire={() => { setHistory([]); setBreadcrumb(['Início', 'Questionário']); setScreen('questionnaire'); }}
        onCreateMindMap={openNewMindMap}
        onCreateNote={openNewNote}
        onOpenMindMap={openSavedMindMap}
        onOpenNote={openSavedNote}
        onOpenTerms={() => setScreen('terms')}
        onOpenPrivacy={() => setScreen('privacy')}
        onLogout={() => void handleLogout()}
      />
    );
  }

  if (screen === 'annotation') {
    return (
      <NoteEditor
        noteId={currentNoteId}
        initialTitle={breadcrumb[breadcrumb.length - 1] || 'Nova anotação'}
        breadcrumb={breadcrumb}
        onBack={goBack}
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
      <UserRegister
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
      <UserLogin
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
    <MindMap
      mapId={currentMapId}
      breadcrumb={breadcrumb}
      initialViewStack={currentMapViewStack}
      initialSelectedNodeId={currentMapSelectedNodeId}
      onBack={goBack}
      onMapCreated={(id, title) => {
        setCurrentMapId(id);
        updateLastBreadcrumb(title);
      }}
      onOpenAnnotation={openAnnotationFromMap}
    />
  );
}