import { useDialogos } from "../../components/contextoDialogos";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { extensoesAnotacao } from "./extensoesAnotacao";

import AnotacaoHeader from "./AnotacaoHeader";
import AnotacaoToolbar from "./AnotacaoToolbar";
import ReferenciasPanel from "./ReferenciasPanel";
import type { ReferenciaAcademica } from "./apiReferencias";
import { criarPergunta } from "../revisoes/apiRevisoes";
import { ErroApi } from "../../services/apiClient";
import { carregarMapaMental } from "../mapas/apiMapas";
import type { TipoConteudo } from "../mapas/tiposMapa";
import {
  criarAnotacao,
  CONTEUDO_ANOTACAO_VAZIA,
  carregarAnotacao,
  atualizarAnotacao,
  type ConteudoAnotacao,
} from "./apiAnotacoes";
import "./AnotacaoEditor.css";

type AnotacaoEditorProps = {
  noteId: string | null;
  initialFolderId?: string | null;
  initialTitle: string;
  breadcrumb: string[];
  onBack: () => void;
  onHome: () => void;
  onSaidaPendenteChange?: (pendente: boolean) => void;
  onCreated: (id: string, title: string) => void;
  relationshipContext?: ContextoRelacionamentoAnotacao | null;
  onNavigateRelationship?: (target: DestinoRelacionamentoAnotacao) => void;
};

export type ContextoRelacionamentoAnotacao = {
  parentMapId: string;
  parentViewStack: string[];
  sourceNodeId: string;
};

export type DestinoRelacionamentoAnotacao = {
  nodeId: string;
  blockName: string;
  parentMapId: string;
  parentViewStack: string[];
  linkedContentType?: TipoConteudo;
  linkedAnnotationId?: string;
  linkedViewId?: string;
};

type BlocoRelacionado = Omit<
  DestinoRelacionamentoAnotacao,
  "parentMapId" | "parentViewStack"
>;

export default function AnotacaoEditor({
  noteId,
  initialFolderId = null,
  initialTitle,
  breadcrumb,
  onBack,
  onHome,
  onCreated,
  onSaidaPendenteChange,
  relationshipContext = null,
  onNavigateRelationship,
}: AnotacaoEditorProps) {
  const dialogos = useDialogos();
  const [title, setTitle] = useState(noteId === null ? "" : initialTitle);
  const [dirty, setDirty] = useState(false);
  const loadedNote = useRef<string | null | undefined>(undefined);
  const [status, setStatus] = useState("");
  const [salvandoPergunta, setSalvandoPergunta] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showReferences, setShowReferences] = useState(false);
  const [questionDraft, setQuestionDraft] = useState<{
    source: string;
    question: string;
    answer: string;
    step: "question" | "answer" | "confirm";
  } | null>(null);
  const [ferramentasAbertas, setFerramentasAbertas] = useState(false);
  const [conexoesAbertas, setConexoesAbertas] = useState(false);
  const [relatedBlocks, setRelatedBlocks] = useState<BlocoRelacionado[]>([]);
  const [relationshipTitle, setRelationshipTitle] = useState("");

  useEffect(() => {
    onSaidaPendenteChange?.(dirty || !title.trim());
  }, [dirty, title, onSaidaPendenteChange]);

  useEffect(
    () => () => onSaidaPendenteChange?.(false),
    [onSaidaPendenteChange],
  );

  const editor = useEditor({
    extensions: extensoesAnotacao(),
    content: CONTEUDO_ANOTACAO_VAZIA,
    onUpdate: () => setDirty(true),
    onSelectionUpdate: ({ editor: activeEditor }) => {
      const { from, to, empty } = activeEditor.state.selection;
      setSelectedText(
        empty
          ? ""
          : activeEditor.state.doc
              .textBetween(from, to, " ")
              .replace(/\s+/g, " ")
              .trim(),
      );
    },
  });

  useEffect(() => {
    if (!editor || loadedNote.current === noteId) return;
    let ativo = true;

    setSelectedText("");
    setShowReferences(false);
    setQuestionDraft(null);
    if (noteId === null) {
      loadedNote.current = null;
      setTitle("");
      editor.commands.setContent(CONTEUDO_ANOTACAO_VAZIA);
      setDirty(false);
      setStatus("Nova anotação.");
      return;
    }

    setStatus("Carregando...");

    carregarAnotacao(noteId)
      .then((note) => {
        if (!ativo) return;
        loadedNote.current = noteId;
        setTitle(note.titulo);
        editor.commands.setContent(note.conteudo);
        setDirty(false);
        setStatus("Anotação carregada.");
      })
      .catch((error) => {
        if (!ativo) return;
        console.error(error);
        setStatus("Erro ao carregar a anotação.");
      });
    return () => {
      ativo = false;
    };
  }, [editor, noteId]);

  useEffect(() => {
    let active = true;

    setRelatedBlocks([]);
    setRelationshipTitle("");

    if (!relationshipContext)
      return () => {
        active = false;
      };

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
          (node) => node.id === relationshipContext.sourceNodeId,
        );
        if (!sourceNode) return;

        const connectedIds = new Set(
          parentView.edges
            .filter(
              (edge) =>
                edge.source === sourceNode.id || edge.target === sourceNode.id,
            )
            .map((edge) =>
              edge.source === sourceNode.id ? edge.target : edge.source,
            ),
        );

        const connected = parentView.nodes
          .filter((node) => connectedIds.has(node.id))
          .map((node) => ({
            nodeId: node.id,
            blockName: node.data.label || "Bloco sem título",
            linkedContentType: node.data.linkedContentType,
            linkedAnnotationId: node.data.linkedAnnotationId,
            linkedViewId: node.data.linkedViewId,
          }));

        setRelationshipTitle(sourceNode.data.label || "bloco");
        setRelatedBlocks(connected);
      })
      .catch((error) => {
        console.error(error);
        if (active) setRelatedBlocks([]);
      });

    return () => {
      active = false;
    };
  }, [relationshipContext]);

  function requireTitle() {
    setStatus("Informe um título para a anotação.");
    document
      .querySelector<HTMLInputElement>('[aria-label="Nome da anotação"]')
      ?.focus();
  }

  async function leave(action: () => void) {
    if (!title.trim()) {
      if (
        !(await dialogos.confirmar(
          "A anotação está sem título. Deseja sair e descartar as alterações?",
        ))
      ) {
        document
          .querySelector<HTMLInputElement>('[aria-label="Nome da anotação"]')
          ?.focus();
        return;
      }
    } else if (
      dirty &&
      !(await dialogos.confirmar(
        "Há alterações não salvas. Deseja sair e descartá-las?",
      ))
    )
      return;
    action();
  }

  async function handleSave() {
    if (!editor) return;

    const finalTitle = title.trim();
    if (!finalTitle) {
      requireTitle();
      return;
    }
    const content = editor.getJSON() as ConteudoAnotacao;

    try {
      setStatus("Salvando...");

      const saved =
        noteId === null
          ? await criarAnotacao(finalTitle, content, initialFolderId)
          : await atualizarAnotacao(noteId, finalTitle, content);

      setTitle(saved.titulo);
      setDirty(false);
      loadedNote.current = saved.id;
      onCreated(saved.id, saved.titulo);
      setStatus("Salvo no banco.");
    } catch (error) {
      console.error(error);
      setStatus(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a anotação.",
      );
    }
  }

  function startQuestion() {
    if (!selectedText.trim()) return;
    setShowReferences(false);
    const selection = selectedText.trim();
    setQuestionDraft({
      source: selection,
      question: selection,
      answer: "",
      step: "question",
    });
  }

  function startAnswerSelection() {
    if (!questionDraft?.question.trim()) return;
    setQuestionDraft({ ...questionDraft, step: "answer" });
    setSelectedText("");
    // Limpa a seleção da pergunta para que a resposta precise ser marcada novamente.
    if (editor) editor.commands.setTextSelection(editor.state.selection.to);
  }

  async function saveQuestion() {
    if (
      salvandoPergunta ||
      !editor ||
      !questionDraft?.question.trim() ||
      !questionDraft.answer.trim()
    )
      return;
    const finalTitle = title.trim();
    if (!finalTitle) {
      requireTitle();
      return;
    }
    setSalvandoPergunta(true);
    try {
      setStatus("Salvando anotação e pergunta...");
      // Uma pergunta deve apontar para um registro persistido, inclusive em notas novas.
      const note =
        noteId === null
          ? await criarAnotacao(
              finalTitle,
              editor.getJSON() as ConteudoAnotacao,
              initialFolderId,
            )
          : await atualizarAnotacao(
              noteId,
              finalTitle,
              editor.getJSON() as ConteudoAnotacao,
            );
      setTitle(note.titulo);
      setDirty(false);
      loadedNote.current = note.id;
      onCreated(note.id, note.titulo);
      const dados = {
        anotacao: note.id,
        enunciado: questionDraft.question.trim(),
        resposta: questionDraft.answer.trim(),
        trecho_origem: questionDraft.source,
        mapa_origem: relationshipContext?.parentMapId,
        visao_origem: relationshipContext?.parentViewStack.at(-1),
      };
      try {
        await criarPergunta(dados);
      } catch (error) {
        if (!(error instanceof ErroApi) || error.status !== 409) throw error;
        if (!(await dialogos.confirmar(error.message))) {
          setStatus("Anotação salva. A criação da pergunta foi cancelada.");
          return;
        }
        await criarPergunta({ ...dados, confirmar_reinicio: true });
      }
      setQuestionDraft(null);
      setSelectedText("");
      setStatus("Pergunta salva. Ela já está disponível no questionário.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a pergunta.",
      );
    } finally {
      setSalvandoPergunta(false);
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
      reference.autores.length ? `${reference.autores.join(", ")}.` : "",
      reference.titulo ? `${reference.titulo}.` : "",
      reference.publicacao ? `${reference.publicacao}.` : "",
      reference.ano ? String(reference.ano) + "." : "",
      reference.doi ? `DOI: ${reference.doi}.` : "",
      reference.url || "",
    ].filter(Boolean);
    editor
      .chain()
      .focus("end")
      .insertContent({
        type: "paragraph",
        content: [{ type: "text", text: parts.join(" ") }],
      })
      .run();
    setStatus(
      "Dados bibliográficos inseridos. Clique em Salvar para armazenar a anotação.",
    );
  }

  return (
    <div className="note-editor">
      <AnotacaoHeader
        title={title}
        setTitle={(value) => {
          setTitle(value);
          setDirty(true);
        }}
        editor={editor}
        status={status}
        onBack={() => leave(onBack)}
        onHome={() => leave(onHome)}
        onSave={handleSave}
      />

      <div className="note-editor__breadcrumb">
        {[...breadcrumb.slice(0, -1), title || breadcrumb.at(-1)].join(" / ")}
      </div>

      <AnotacaoToolbar editor={editor} />

      <div className="note-editor__workspace">
        <aside
          className="note-editor__sidebar"
          aria-label="Ferramentas de anotação"
        >
          <button
            type="button" className="note-editor__panel-toggle"
            aria-expanded={ferramentasAbertas} aria-controls="note-tools-content"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setFerramentasAbertas((abertas) => !abertas)}
          >
            Ferramentas <span aria-hidden="true">{ferramentasAbertas ? "−" : "+"}</span>
          </button>
          <div id="note-tools-content" className={`note-editor__panel-content${ferramentasAbertas ? " is-open" : ""}`}>
          <h3>Ferramentas</h3>
          <p className="note-editor__help">
            Selecione um trecho no texto para pesquisar fontes ou criar uma
            pergunta de revisão.
          </p>
          {selectedText && (
            <div className="note-editor__excerpt" title={selectedText}>
              “
              {selectedText.length > 130
                ? `${selectedText.slice(0, 130)}…`
                : selectedText}
              ”
            </div>
          )}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            disabled={
              selectedText.length < 2 ||
              selectedText.length > 200 ||
              questionDraft !== null
            }
            onClick={openReferenceSearch}
          >
            Pesquisar no Crossref
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            disabled={!selectedText.trim() || questionDraft !== null}
            onClick={startQuestion}
          >
            Criar pergunta
          </button>
          {questionDraft && (
            <section className="note-editor__question">
              <h3>Nova pergunta</h3>
              <p className="note-editor__help">
                O questionário é escolhido automaticamente pela origem desta
                anotação.
              </p>
              <small>Trecho de origem: “{questionDraft.source}”</small>
              <label htmlFor="note-question-text">Pergunta</label>
              <textarea
                id="note-question-text"
                value={questionDraft.question}
                rows={3}
                onChange={(event) =>
                  setQuestionDraft({
                    ...questionDraft,
                    question: event.target.value,
                  })
                }
                placeholder="Edite a pergunta antes de salvar"
              />
              {questionDraft.step === "question" && (
                <button
                  type="button"
                  disabled={!questionDraft.question.trim()}
                  onClick={startAnswerSelection}
                >
                  Marcar pergunta
                </button>
              )}
              {questionDraft.step === "answer" && (
                <>
                  <p className="note-editor__help">
                    Selecione agora, na anotação, o trecho da resposta. Em
                    seguida, clique em Marcar resposta.
                  </p>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    disabled={!selectedText.trim()}
                    onClick={() => {
                      if (selectedText.trim())
                        setQuestionDraft({
                          ...questionDraft,
                          answer: selectedText.trim(),
                          step: "confirm",
                        });
                    }}
                  >
                    Marcar resposta
                  </button>
                </>
              )}
              {questionDraft.step === "confirm" && (
                <>
                  <label htmlFor="note-answer-text">Resposta</label>
                  <textarea
                    id="note-answer-text"
                    value={questionDraft.answer}
                    rows={4}
                    onChange={(event) =>
                      setQuestionDraft({
                        ...questionDraft,
                        answer: event.target.value,
                      })
                    }
                    placeholder="Edite a resposta antes de salvar"
                  />
                  <button
                    type="button"
                    disabled={salvandoPergunta}
                    onClick={() => void saveQuestion()}
                  >
                    Salvar pergunta
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestionDraft({
                        ...questionDraft,
                        answer: "",
                        step: "answer",
                      })
                    }
                  >
                    Selecionar outra resposta
                  </button>
                </>
              )}
              <button
                type="button"
                className="is-secondary"
                onClick={() => setQuestionDraft(null)}
              >
                Cancelar
              </button>
            </section>
          )}
          </div>
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
          <aside
            className="note-editor__relations"
            aria-label="Conteúdos relacionados"
          >
            <button
              type="button" className="note-editor__panel-toggle"
              aria-expanded={conexoesAbertas} aria-controls="note-relations-content"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setConexoesAbertas((abertas) => !abertas)}
            >
              Blocos conectados ({relatedBlocks.length}) <span aria-hidden="true">{conexoesAbertas ? "−" : "+"}</span>
            </button>
            <div id="note-relations-content" className={`note-editor__panel-content${conexoesAbertas ? " is-open" : ""}`}>
            <h3>Blocos conectados</h3>
            <small>Conexões de {relationshipTitle}</small>
            <div className="note-editor__relations-list">
              {relatedBlocks.map((block) => (
                <button
                  key={block.nodeId}
                  type="button"
                  onClick={() =>
                    leave(() =>
                      onNavigateRelationship?.({
                        ...block,
                        parentMapId: relationshipContext.parentMapId,
                        parentViewStack: [
                          ...relationshipContext.parentViewStack,
                        ],
                      }),
                    )
                  }
                >
                  <span>{block.blockName}</span>
                  <small>
                    {block.linkedContentType === "annotation"
                      ? "Anotação"
                      : block.linkedContentType === "mindmap"
                        ? "Mapa mental"
                        : "Abrir no mapa"}
                  </small>
                </button>
              ))}
            </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
