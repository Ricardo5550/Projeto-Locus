import { useState } from 'react';
import HomeMenu from './features/home/HomeMenu';
import MindMap from './features/mindmaps/MindMap';
import NoteEditor, {
  type NoteRelationshipContext,
  type NoteRelationshipTarget,
} from './features/notes/NoteEditor';
import UserRegister from './features/users/UserRegister';
import UserLogin from './features/users/UserLogin';
import Questionnaire from './features/reviews/Questionnaire';
import './App.css';

type Screen = 'home' | 'mindmap' | 'annotation' | 'register' | 'login' | 'questionnaire';

type HistoryEntry = {
  screen: 'mindmap' | 'annotation' | 'register' | 'login';
  id: number | null;
  breadcrumb: string[];
  mapViewStack?: string[];
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [currentMapId, setCurrentMapId] = useState<number | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<number | null>(null);
  const [currentMapViewStack, setCurrentMapViewStack] = useState<string[]>();
  const [currentMapSelectedNodeId, setCurrentMapSelectedNodeId] = useState<string>();
  const [breadcrumb, setBreadcrumb] = useState<string[]>(['Início']);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [noteRelationshipContext, setNoteRelationshipContext] =
    useState<NoteRelationshipContext | null>(null);

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
    return <UserRegister onNavigateToLogin={ () => setScreen('login') } />;
  }

  if (screen === 'login') {
    return <UserLogin onLoginSuccess={ () => setScreen('home') } onNavigateToRegister={ () => setScreen('register') } />;
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