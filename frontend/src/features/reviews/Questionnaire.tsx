import { useEffect, useState } from 'react';
import {
  deleteQuestion,
  listQuestions,
  registerAttempt,
  updateQuestion,
  type StudyQuestion,
} from './reviewApi';
import './Questionnaire.css';

type Props = { onBack: () => void };
type AnswerState = { typed: string; revealed: boolean; saved: boolean; error: string };
type EditState = {
  id: number;
  enunciado: string;
  resposta: string;
  saving: boolean;
  error: string;
};

export default function Questionnaire({ onBack }: Props) {
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [editing, setEditing] = useState<EditState | null>(null);
  const [status, setStatus] = useState('Carregando perguntas...');

  useEffect(() => {
    let active = true;
    listQuestions()
      .then((result) => {
        if (!active) return;
        setQuestions(result);
        setStatus(
          result.length
            ? ''
            : 'Nenhuma pergunta cadastrada. Crie uma pergunta em uma anotação.'
        );
      })
      .catch(() => {
        if (active) setStatus('Não foi possível carregar as perguntas.');
      });
    return () => {
      active = false;
    };
  }, []);

  function updateAnswer(id: number, changes: Partial<AnswerState>) {
    setAnswers((current) => ({
      ...current,
      [id]: {
        typed: '',
        revealed: false,
        saved: false,
        error: '',
        ...current[id],
        ...changes,
      },
    }));
  }

  async function evaluate(question: StudyQuestion, acertou: boolean) {
    const answer = answers[question.id];
    if (!answer?.revealed || answer.saved) return;

    try {
      await registerAttempt({
        pergunta: question.id,
        resposta_digitada: answer.typed,
        acertou,
      });
      updateAnswer(question.id, { saved: true, error: '' });
      setQuestions((current) =>
        current.map((item) =>
          item.id === question.id
            ? { ...item, total_tentativas: item.total_tentativas + 1 }
            : item
        )
      );
    } catch {
      updateAnswer(question.id, {
        error: 'Falha ao registrar a tentativa. Tente novamente.',
      });
    }
  }

  function startEditing(question: StudyQuestion) {
    setEditing({
      id: question.id,
      enunciado: question.enunciado,
      resposta: question.resposta,
      saving: false,
      error: '',
    });
  }

  async function saveEditing() {
    if (!editing || !editing.enunciado.trim() || !editing.resposta.trim()) return;

    setEditing({ ...editing, saving: true, error: '' });

    try {
      const saved = await updateQuestion(editing.id, {
        enunciado: editing.enunciado.trim(),
        resposta: editing.resposta.trim(),
      });

      setQuestions((current) =>
        current.map((question) =>
          question.id === saved.id ? saved : question
        )
      );
      setEditing(null);
    } catch {
      setEditing((current) =>
        current
          ? {
              ...current,
              saving: false,
              error: 'Não foi possível salvar as alterações.',
            }
          : current
      );
    }
  }

  async function removeQuestion(question: StudyQuestion) {
    const confirmed = window.confirm(
      'Excluir esta pergunta? As tentativas registradas para ela também serão excluídas.'
    );
    if (!confirmed) return;

    try {
      await deleteQuestion(question.id);
      setQuestions((current) => current.filter((item) => item.id !== question.id));
      setStatus(
        questions.length === 1
          ? 'Nenhuma pergunta cadastrada. Crie uma pergunta em uma anotação.'
          : ''
      );
      setAnswers((current) => {
        const next = { ...current };
        delete next[question.id];
        return next;
      });
      if (editing?.id === question.id) setEditing(null);
    } catch {
      setStatus('Não foi possível excluir a pergunta. Tente novamente.');
    }
  }

  return (
    <div className="quiz-page">
      <header className="quiz-header">
        <button type="button" onClick={onBack}>← Biblioteca</button>
        <h1>Questionário</h1>
      </header>

      <main className="quiz-main">
        <p>
          Responda sem consultar a anotação. Depois, confira a resposta e
          registre se acertou ou errou.
        </p>
        {status && <p role="status">{status}</p>}

        {questions.map((question, index) => {
          const answer = answers[question.id] ?? {
            typed: '',
            revealed: false,
            saved: false,
            error: '',
          };
          const isEditing = editing?.id === question.id;

          return (
            <article className="quiz-card" key={question.id}>
              <div className="quiz-card__top">
                <small>
                  {question.titulo_anotacao} · Pergunta {index + 1} ·{' '}
                  {question.total_tentativas} tentativa(s)
                </small>
                <div className="quiz-card__manage">
                  <button
                    type="button"
                    className="is-secondary"
                    onClick={() => startEditing(question)}
                    disabled={isEditing}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => void removeQuestion(question)}
                  >
                    Excluir
                  </button>
                </div>
              </div>

              {isEditing && editing ? (
                <section className="quiz-edit">
                  <label htmlFor={`quiz-edit-question-${question.id}`}>Pergunta</label>
                  <textarea
                    id={`quiz-edit-question-${question.id}`}
                    rows={3}
                    value={editing.enunciado}
                    onChange={(event) =>
                      setEditing({ ...editing, enunciado: event.target.value })
                    }
                  />

                  <label htmlFor={`quiz-edit-answer-${question.id}`}>Resposta de referência</label>
                  <textarea
                    id={`quiz-edit-answer-${question.id}`}
                    rows={4}
                    value={editing.resposta}
                    onChange={(event) =>
                      setEditing({ ...editing, resposta: event.target.value })
                    }
                  />

                  {editing.error && <p role="alert">{editing.error}</p>}

                  <div className="quiz-edit__actions">
                    <button
                      type="button"
                      onClick={() => void saveEditing()}
                      disabled={
                        editing.saving ||
                        !editing.enunciado.trim() ||
                        !editing.resposta.trim()
                      }
                    >
                      {editing.saving ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                    <button
                      type="button"
                      className="is-secondary"
                      onClick={() => setEditing(null)}
                      disabled={editing.saving}
                    >
                      Cancelar
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <h2>{question.enunciado}</h2>
                  <label htmlFor={`quiz-answer-${question.id}`}>Sua resposta</label>
                  <textarea
                    id={`quiz-answer-${question.id}`}
                    rows={4}
                    value={answer.typed}
                    disabled={answer.revealed}
                    onChange={(event) =>
                      updateAnswer(question.id, { typed: event.target.value })
                    }
                    placeholder="Escreva sua resposta antes de conferir..."
                  />

                  {!answer.revealed ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateAnswer(question.id, { revealed: true })
                      }
                      disabled={!answer.typed.trim()}
                    >
                      Conferir resposta
                    </button>
                  ) : (
                    <>
                      <div className="quiz-reference">
                        <strong>Resposta de referência</strong>
                        <p>{question.resposta}</p>
                      </div>

                      {answer.saved ? (
                        <p role="status">
                          Tentativa registrada. A próxima revisão poderá considerar esse resultado.
                        </p>
                      ) : (
                        <div className="quiz-evaluate">
                          <button
                            type="button"
                            onClick={() => void evaluate(question, true)}
                          >
                            Acertei
                          </button>
                          <button
                            type="button"
                            onClick={() => void evaluate(question, false)}
                          >
                            Errei
                          </button>
                        </div>
                      )}
                      {answer.error && <p role="alert">{answer.error}</p>}
                    </>
                  )}
                </>
              )}
            </article>
          );
        })}
      </main>
    </div>
  );
}
