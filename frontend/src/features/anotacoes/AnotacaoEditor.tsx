import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Typography from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';

import AnotacaoHeader from './AnotacaoHeader';
import AnotacaoToolbar from './AnotacaoToolbar';
import ReferenciasPanel from './ReferenciasPanel';
import type { ReferenciaAcademica } from './apiReferencias';
import { criarPergunta } from '../revisoes/apiRevisoes';
import { carregarMapaMental } from '../mapas/apiMapas';
import type { TipoConteudo } from '../mapas/tiposMapa';
import {
  criarAnotacao,
  CONTEUDO_ANOTACAO_VAZIA,
  carregarAnotacao,
  atualizarAnotacao,
  type ConteudoAnotacao,
} from './apiAnotacoes';
import './AnotacaoEditor.css';

type AnotacaoEditorProps = {
  noteId: number | null;
  initialFolderId?: number | null;
  initialTitle: string;
  breadcrumb: string[];
  onBack: () => void;
  onHome: () => void;
  onCreated: (id: number, title: string) => void;
  relationshipContext?: ContextoRelacionamentoAnotacao | null;
  onNavigateRelationship?: (target: DestinoRelacionamentoAnotacao) => void;
};

export type ContextoRelacionamentoAnotacao = {
  parentMapId: number;
  parentViewStack: string[];
  sourceNodeId: string;
};

export type DestinoRelacionamentoAnotacao = {
  nodeId: string;
  blockName: string;
  parentMapId: number;
  parentViewStack: string[];
  linkedContentType?: TipoConteudo;
  linkedAnnotationId?: number;
  linkedViewId?: string;
};

type BlocoRelacionado = Omit<
  DestinoRelacionamentoAnotacao,
  'parentMapId' | 'parentViewStack'
>;

export default function AnotacaoEditor({
  noteId,
  initialFolderId = null,
  initialTitle,
  breadcrumb,
  onBack,
  onHome,
  onCreated,
  relationshipContext = null,
  onNavigateRelationship,
}: AnotacaoEditorProps) {
  const [title, setTitle] = useState(noteId === null ? '' : initialTitle);
  const [dirty,setDirty]=useState(false);
  const loadedNote=useRef<number|null|undefined>(undefined);
  const [status, setStatus] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showReferences, setShowReferences] = useState(false);
  const [questionDraft, setQuestionDraft] = useState<{ source: string; question: string; answer: string; step: 'question' | 'answer' | 'confirm' } | null>(null);
  const [relatedBlocks, setRelatedBlocks] = useState<BlocoRelacionado[]>([]);
  const [relationshipTitle, setRelationshipTitle] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ allowBase64: true }),
      Typography,
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: CONTEUDO_ANOTACAO_VAZIA,
    onUpdate: () => setDirty(true),
    onSelectionUpdate: ({ editor: activeEditor }) => {
      const { from, to, empty } = activeEditor.state.selection;
      setSelectedText(
        empty ? '' : activeEditor.state.doc.textBetween(from, to, ' ').replace(/\s+/g, ' ').trim()
      );
    },
  });

  useEffect(() => {
    if (!editor || loadedNote.current===noteId) return;
    loadedNote.current=noteId;

    setSelectedText('');
    setShowReferences(false);
    setQuestionDraft(null);
    if (noteId === null) {
      setTitle('');
      editor.commands.setContent(CONTEUDO_ANOTACAO_VAZIA);
      setDirty(false);
      setStatus('Nova anotação.');
      return;
    }

    setStatus('Carregando...');

    carregarAnotacao(noteId)
      .then((note) => {
        setTitle(note.titulo);
        editor.commands.setContent(note.conteudo);
        setDirty(false);
        setStatus('Anotação carregada.');
      })
      .catch((error) => {
        console.error(error);
        setStatus('Erro ao carregar a anotação.');
      });
  }, [editor, noteId, initialTitle]);

  useEffect(() => {
    let active = true;

    setRelatedBlocks([]);
    setRelationshipTitle('');

    if (!relationshipContext) return () => { active = false; };

    carregarMapaMental(relationshipContext.parentMapId)
      .then((map) => {
        if (!active) return;

        const parentViewId =
          relationshipContext.parentViewStack[
            relationshipContext.parentViewStack.length - 1
          ] ?? map.dados.rootViewId;
        const parentView = map.dados.views[parentViewId];
        if (!parentView) return;

        const sourceNode = parentView.nodes.find(
          (node) => node.id === relationshipContext.sourceNodeId
        );
        if (!sourceNode) return;

        const connectedIds = new Set(
          parentView.edges
            .filter(
              (edge) =>
                edge.source === sourceNode.id || edge.target === sourceNode.id
            )
            .map((edge) =>
              edge.source === sourceNode.id ? edge.target : edge.source
            )
        );

        const connected = parentView.nodes
          .filter((node) => connectedIds.has(node.id))
          .map((node) => ({
            nodeId: node.id,
            blockName: node.data.label || 'Bloco sem título',
            linkedContentType: node.data.linkedContentType,
            linkedAnnotationId: node.data.linkedAnnotationId,
            linkedViewId: node.data.linkedViewId,
          }));

        setRelationshipTitle(sourceNode.data.label || 'bloco');
        setRelatedBlocks(connected);
      })
      .catch((error) => {
        console.error(error);
        if (active) setRelatedBlocks([]);
      });

    return () => { active = false; };
  }, [relationshipContext]);

  function requireTitle() {
    setStatus('Informe um título para a anotação.');
    window.alert('Informe um título para salvar a anotação.');
    document.querySelector<HTMLInputElement>('[aria-label="Nome da anotação"]')?.focus();
  }

  function leave(action:()=>void) {
    if(!title.trim()) {
      if(!window.confirm('A anotação está sem título. Deseja sair e descartar as alterações?')) {
        document.querySelector<HTMLInputElement>('[aria-label="Nome da anotação"]')?.focus();
        return;
      }
    } else if(dirty && !window.confirm('Há alterações não salvas. Deseja sair e descartá-las?')) return;
    action();
  }

  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);

  async function handleSave() {
    if (!editor) return;

    const finalTitle = title.trim();
    if(!finalTitle) {requireTitle();return;}
    const content = editor.getJSON() as ConteudoAnotacao;

    try {
      setStatus('Salvando...');

      const saved =
        noteId === null
          ? await criarAnotacao(finalTitle, content, initialFolderId)
          : await atualizarAnotacao(noteId, finalTitle, content);

      setTitle(saved.titulo);
      setDirty(false);
      loadedNote.current=saved.id;
      onCreated(saved.id, saved.titulo);
      setStatus('Salvo no banco.');
    } catch (error) {
      console.error(error);
      setStatus('Erro ao salvar. Verifique se o backend está rodando.');
    }
  }

  function startQuestion() {
    if (!selectedText.trim()) return;
    setShowReferences(false);
    const selection = selectedText.trim();
    setQuestionDraft({ source: selection, question: selection, answer: '', step: 'question' });
  }

  function startAnswerSelection() {
    if (!questionDraft?.question.trim()) return;
    setQuestionDraft({ ...questionDraft, step: 'answer' });
    setSelectedText('');
    // Limpa a seleção da pergunta para que a resposta precise ser marcada novamente.
    if (editor) editor.commands.setTextSelection(editor.state.selection.to);
  }

  async function saveQuestion() {
    if (!editor || !questionDraft?.question.trim() || !questionDraft.answer.trim()) return;
    try {
      setStatus('Salvando anotação e pergunta...');
      const finalTitle = title.trim();
      if(!finalTitle) {requireTitle();return;}
      // Uma pergunta deve apontar para um registro persistido, inclusive em notas novas.
      const note = noteId === null
        ? await criarAnotacao(finalTitle, editor.getJSON() as ConteudoAnotacao, initialFolderId)
        : await atualizarAnotacao(noteId, finalTitle, editor.getJSON() as ConteudoAnotacao);
      setTitle(note.titulo);
      setDirty(false);
      loadedNote.current=note.id;
      onCreated(note.id, note.titulo);
      await criarPergunta({
        anotacao: note.id,
        enunciado: questionDraft.question.trim(),
        resposta: questionDraft.answer.trim(),
        trecho_origem: questionDraft.source,
      });
      setQuestionDraft(null);
      setSelectedText('');
      setStatus('Pergunta salva. Ela já está disponível no questionário.');
    } catch (error) {
      console.error(error);
      setStatus('Não foi possível salvar a pergunta. Tente novamente.');
    }
  }

  function openReferenceSearch() {
    if (selectedText.length < 2 || selectedText.length > 200) return;
    setSearchTerm(selectedText);
    setShowReferences(true);
  }

  function insertReference(reference: ReferenciaAcademica) {
    if (!editor) return;
    // Insere os metadados no fim da anotação; não altera o trecho usado na pesquisa.
    const parts = [
      reference.autores.length ? `${reference.autores.join(', ')}.` : '',
      reference.titulo ? `${reference.titulo}.` : '',
      reference.publicacao ? `${reference.publicacao}.` : '',
      reference.ano ? String(reference.ano) + '.' : '',
      reference.doi ? `DOI: ${reference.doi}.` : '',
      reference.url || '',
    ].filter(Boolean);
    editor.chain().focus('end').insertContent({
      type: 'paragraph',
      content: [{ type: 'text', text: parts.join(' ') }],
    }).run();
    setStatus('Dados bibliográficos inseridos. Clique em Salvar para armazenar a anotação.');
  }

  return (
    <div className="note-editor">
      <AnotacaoHeader
        title={title}
        setTitle={value=>{setTitle(value);setDirty(true);}}
        editor={editor}
        status={status}
        onBack={()=>leave(onBack)}
        onHome={()=>leave(onHome)}
        onSave={handleSave}
      />

      <div className="note-editor__breadcrumb">{breadcrumb.join(' / ')}</div>

      <AnotacaoToolbar editor={editor} />

      <div className="note-editor__workspace">
        <aside className="note-editor__sidebar" aria-label="Ferramentas de anotação">
          <h3>Ferramentas</h3>
          <p className="note-editor__help">Selecione um trecho no texto para pesquisar fontes ou criar uma pergunta de revisão.</p>
          {selectedText && <div className="note-editor__excerpt" title={selectedText}>“{selectedText.length > 130 ? `${selectedText.slice(0, 130)}…` : selectedText}”</div>}
          <button type="button" onMouseDown={(event) => event.preventDefault()}
            disabled={selectedText.length < 2 || selectedText.length > 200 || questionDraft !== null}
            onClick={openReferenceSearch}>Pesquisar no Crossref</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()}
            disabled={!selectedText.trim() || questionDraft !== null}
            onClick={startQuestion}>Criar pergunta</button>
          {questionDraft && <section className="note-editor__question">
            <h3>Nova pergunta</h3>
            <small>Trecho de origem: “{questionDraft.source}”</small>
            <label htmlFor="note-question-text">Pergunta</label>
            <textarea id="note-question-text" value={questionDraft.question} rows={3}
              onChange={(event) => setQuestionDraft({ ...questionDraft, question: event.target.value })}
              placeholder="Edite a pergunta antes de salvar" />
            {questionDraft.step === 'question' && <button type="button" disabled={!questionDraft.question.trim()}
              onClick={startAnswerSelection}>Marcar pergunta</button>}
            {questionDraft.step === 'answer' && <>
              <p className="note-editor__help">Selecione agora, na anotação, o trecho da resposta. Em seguida, clique em Marcar resposta.</p>
              <button type="button" onMouseDown={(event) => event.preventDefault()}
                disabled={!selectedText.trim()} onClick={() => {
                  if (selectedText.trim()) setQuestionDraft({ ...questionDraft, answer: selectedText.trim(), step: 'confirm' });
                }}>Marcar resposta</button>
            </>}
            {questionDraft.step === 'confirm' && <>
              <label htmlFor="note-answer-text">Resposta</label>
              <textarea id="note-answer-text" value={questionDraft.answer} rows={4}
                onChange={(event) => setQuestionDraft({ ...questionDraft, answer: event.target.value })}
                placeholder="Edite a resposta antes de salvar" />
              <button type="button" onClick={() => void saveQuestion()}>Salvar pergunta</button>
              <button type="button" onClick={() => setQuestionDraft({ ...questionDraft, answer: '', step: 'answer' })}>Selecionar outra resposta</button>
            </>}
            <button type="button" className="is-secondary" onClick={() => setQuestionDraft(null)}>Cancelar</button>
          </section>}
        </aside>
        <main className="note-editor__scroll">
          <EditorContent editor={editor} className="note-editor__paper" />
          {showReferences && (
            <ReferenciasPanel
              initialTerm={searchTerm}
              onClose={() => setShowReferences(false)}
              onInsert={insertReference}
            />
          )}
        </main>

        {relationshipContext && relatedBlocks.length > 0 && (
          <aside className="note-editor__relations" aria-label="Conteúdos relacionados">
            <h3>Blocos conectados</h3>
            <small>Conexões de {relationshipTitle}</small>
            <div className="note-editor__relations-list">
              {relatedBlocks.map((block) => (
                <button
                  key={block.nodeId}
                  type="button"
                  onClick={() => leave(()=>onNavigateRelationship?.({
                    ...block,
                    parentMapId: relationshipContext.parentMapId,
                    parentViewStack: [...relationshipContext.parentViewStack],
                  }))}
                >
                  <span>{block.blockName}</span>
                  <small>
                    {block.linkedContentType === 'annotation'
                      ? 'Anotação'
                      : block.linkedContentType === 'mindmap'
                        ? 'Mapa mental'
                        : 'Abrir no mapa'}
                  </small>
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
