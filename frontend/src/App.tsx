import { useState } from 'react';
import HomeMenu from './features/home/HomeMenu';
import MindMap from './features/mindmaps/MindMap';
import NoteEditor from './features/notes/NoteEditor';
import './App.css';

type Screen = 'home' | 'mindmap' | 'annotation';

type HistoryEntry = {
  screen: 'mindmap' | 'annotation';
  id: number | null;
  breadcrumb: string[];
  mapViewStack?: string[];
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [currentMapId, setCurrentMapId] = useState<number | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<number | null>(null);
  const [currentMapViewStack, setCurrentMapViewStack] = useState<string[]>();
  const [breadcrumb, setBreadcrumb] = useState<string[]>(['Início']);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  function openNewMindMap() {
    setHistory([]);
    setCurrentMapId(null);
    setCurrentNoteId(null);
    setCurrentMapViewStack(undefined);
    setBreadcrumb(['Início', 'Mapa mental']);
    setScreen('mindmap');
  }

  function openSavedMindMap(id: number, title: string) {
    setHistory([]);
    setCurrentMapId(id);
    setCurrentNoteId(null);
    setCurrentMapViewStack(undefined);
    setBreadcrumb(['Início', title]);
    setScreen('mindmap');
  }

  function openNewNote() {
    setHistory([]);
    setCurrentNoteId(null);
    setCurrentMapId(null);
    setCurrentMapViewStack(undefined);
    setBreadcrumb(['Início', 'Nova anotação']);
    setScreen('annotation');
  }

  function openSavedNote(id: number, title: string) {
    setHistory([]);
    setCurrentNoteId(id);
    setCurrentMapId(null);
    setCurrentMapViewStack(undefined);
    setBreadcrumb(['Início', title]);
    setScreen('annotation');
  }

  function openAnnotationFromMap(
    blockName: string,
    noteId: number,
    parentMapId: number,
    viewStack: string[]
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
    setBreadcrumb((current) => [...current, blockName]);
    setCurrentNoteId(noteId);
    setCurrentMapId(null);
    setScreen('annotation');
  }

  function goBack() {
    const previous = history[history.length - 1];

    if (!previous) {
      setScreen('home');
      setCurrentMapId(null);
      setCurrentNoteId(null);
      setCurrentMapViewStack(undefined);
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
    } else {
      setCurrentNoteId(previous.id);
      setCurrentMapId(null);
      setCurrentMapViewStack(undefined);
    }
  }

  function updateLastBreadcrumb(title: string) {
    setBreadcrumb((current) => {
      if (current.length === 0) return [title];
      return [...current.slice(0, -1), title];
    });
  }

  if (screen === 'home') {
    return (
      <HomeMenu
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
        onCreated={(id, title) => {
          setCurrentNoteId(id);
          updateLastBreadcrumb(title);
        }}
      />
    );
  }

  return (
    <MindMap
      mapId={currentMapId}
      breadcrumb={breadcrumb}
      initialViewStack={currentMapViewStack}
      onBack={goBack}
      onMapCreated={(id, title) => {
        setCurrentMapId(id);
        updateLastBreadcrumb(title);
      }}
      onOpenAnnotation={openAnnotationFromMap}
    />
  );
}