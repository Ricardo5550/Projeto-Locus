import { useState } from 'react';
import HomeMenu from './features/home/HomeMenu';
import AnnotationPlaceholder from './features/annotations/AnnotationPlaceholder';
import MindMap from './features/mindmaps/MindMap';
import type { ContentType } from './features/mindmaps/mindMapTypes';
import './App.css';

type Screen = 'home' | 'mindmap' | 'annotation';

const ROOT_MINDMAP_BREADCRUMB = ['Início', 'Mapa mental'];
const ROOT_ANNOTATION_BREADCRUMB = ['Início', 'Anotação'];

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [currentBlockName, setCurrentBlockName] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<string[]>(ROOT_MINDMAP_BREADCRUMB);
  const [currentRelated, setCurrentRelated] = useState<string[]>([]);

  function resetContentContext(nextBreadcrumb: string[]) {
    setCurrentBlockName(null);
    setCurrentRelated([]);
    setBreadcrumb(nextBreadcrumb);
  }

  function openMindMap() {
    resetContentContext(ROOT_MINDMAP_BREADCRUMB);
    setScreen('mindmap');
  }

  function openAnnotation() {
    resetContentContext(ROOT_ANNOTATION_BREADCRUMB);
    setScreen('annotation');
  }

  function openBlock(
    blockName: string,
    relatedNames: string[],
    contentType: ContentType
  ) {
    setCurrentBlockName(blockName);
    setCurrentRelated(relatedNames);
    setBreadcrumb((current) => [...current, blockName]);
    setScreen(contentType);
  }

  function goHome() {
    resetContentContext(ROOT_MINDMAP_BREADCRUMB);
    setScreen('home');
  }

  function goBackFromAnnotation() {
    if (!currentBlockName) {
      goHome();
      return;
    }

    setBreadcrumb((current) => current.slice(0, -1));
    setScreen('mindmap');
  }

  function goBackFromMindMap() {
    if (breadcrumb.length <= 2) {
      goHome();
      return;
    }

    setBreadcrumb((current) => current.slice(0, -1));
    setCurrentBlockName(null);
    setCurrentRelated([]);
  }

  if (screen === 'home') {
    return (
      <HomeMenu
        onCreateMindMap={openMindMap}
        onOpenMindMap={openMindMap}
        onCreateNote={openAnnotation}
      />
    );
  }

  if (screen === 'annotation') {
    return (
      <AnnotationPlaceholder
        title={currentBlockName ?? 'Nova anotação'}
        breadcrumb={breadcrumb}
        relatedNames={currentRelated}
        showRelated={currentBlockName !== null}
        onBack={goBackFromAnnotation}
      />
    );
  }

  return (
    <MindMap
      breadcrumb={breadcrumb}
      relatedNames={currentRelated}
      onBack={goBackFromMindMap}
      onEnterBlock={openBlock}
    />
  );
}
