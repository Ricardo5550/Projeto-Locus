import DevolutivaQuestionario from "./DevolutivaQuestionario";
import { ORDEM_RESULTADOS, CLASSIFICACOES } from "./classificacoes";
import { useDialogos } from "../../components/contextoDialogos";
import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import Modal from "../../components/Modal";
import Paginacao from "../../components/Paginacao";
import { useListaPaginada } from "../../services/useListaPaginada";
import * as api from "./apiRevisoes";
import "./Questionarios.css";
const AVISO =
  "Salvar esta alteração reiniciará o agendamento das revisões. Seu histórico será preservado.";
const dataBr = (d: string | null) =>
  d
    ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")
    : "Ainda não estudado";
function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
type Formulario =
  | { modo: "questionario"; id: string; titulo: string; limite: string }
  | { modo: "perguntas"; id: string; destinos: api.QuestionarioSalvo[] };
export type NavegacaoQuestionario = { voltar: () => void };
type Props = {
  ref?: Ref<NavegacaoQuestionario>;
  initialId?: string | null;
  initialDevolutiva?: boolean;
  onOpenNote?: (id: string, title: string, questionario: string) => void;
  onSessionChange?: (active: boolean) => void;
  onDetalheChange?: (aberto: boolean) => void;
};
export default function Questionario({
  ref,
  initialId = null,
  initialDevolutiva = false,
  onOpenNote,
  onSessionChange,
  onDetalheChange,
}: Props) {
  const dialogos = useDialogos();
  const [atual, setAtual] = useState<api.QuestionarioSalvo | null>(null);
  const [perguntas, setPerguntas] = useState<api.PerguntaEstudo[]>([]);
  const [devolutiva, setDevolutiva] = useState<api.Devolutiva | null>(null);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState(false);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [form, setFormulario] = useState<Formulario | null>(null);
  const [ajuda, setAjuda] = useState(false);
  const [perguntaEmEdicao, setPerguntaEmEdicao] =
    useState<api.PerguntaEstudo | null>(null);
  const [manter, setManter] = useState(false);
  const [destino, setDestino] = useState<string | null>(null);
  const [mostrarDevolutiva, setMostrarDevolutiva] = useState(false);
  const [sessao, setSessao] = useState<{
    chave: string;
    versao: number;
    treino: boolean;
  } | null>(null);
  const [respostas, setRespostas] = useState<
    Record<
      string,
      { texto: string; resultado?: api.Classificacao; revelada: boolean }
    >
  >({});
  const [pagina, setPagina] = useState(1);
  const filtros = new URLSearchParams({ pagina: String(pagina) });
  if (busca.trim()) filtros.set("busca", busca.trim());
  if (situacao) filtros.set("situacao", situacao);
  const lista = useListaPaginada<api.QuestionarioSalvo>(
    atual ? null : `/questionarios/paginados/?${filtros}`,
  );

  async function abrir(id: string, verDevolutiva = false, sinal?: AbortSignal) {
    setErro("");
    setProcessando(true);
    try {
      const [q, p, d] = await Promise.all([
        api.obterQuestionario(id),
        api.perguntasQuestionario(id),
        api.obterDevolutiva(id),
      ]);
      if (sinal?.aborted) return;
      setAtual(q);
      setPerguntas(p);
      setDevolutiva(d);
      setMostrarDevolutiva(verDevolutiva && !!d);
      setSessao(null);
      setRespostas({});
    } catch (e) {
      if (!sinal?.aborted)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível abrir o questionário.",
        );
    } finally {
      if (!sinal?.aborted) setProcessando(false);
    }
  }
  useEffect(() => {
    if (!initialId) return;
    const controle = new AbortController();
    void abrir(initialId, initialDevolutiva, controle.signal);
    return () => controle.abort();
  }, [initialId, initialDevolutiva]);
  useEffect(() => {
    onSessionChange?.(!!sessao);
    return () => onSessionChange?.(false);
  }, [sessao, onSessionChange]);
  async function executar(action: () => Promise<void>) {
    if (processando) return;
    setProcessando(true);
    setErro("");
    try {
      await action();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setProcessando(false);
    }
  }
  function editarQuestionario(q: api.QuestionarioSalvo) {
    setErro("");
    setFormulario({
      modo: "questionario",
      id: q.id,
      titulo: q.titulo,
      limite: String(q.limite_dias ?? ""),
    });
  }

  function selecionarPergunta(
    pergunta: api.PerguntaEstudo,
    questionarioId: string,
  ) {
    setErro("");
    setPerguntaEmEdicao(pergunta);
    setDestino(questionarioId);
    setManter(false);
  }

  async function editarPerguntas(id: string) {
    await executar(async () => {
      const questionarios = await api.listarQuestionarios();
      setFormulario({
        modo: "perguntas",
        id,
        destinos: questionarios.filter((q) => q.id !== id),
      });
      if (perguntas[0]) selecionarPergunta(perguntas[0], id);
    });
  }

  function fecharEdicao() {
    setFormulario(null);
    setPerguntaEmEdicao(null);
    setErro("");
  }

  const emDetalhe = atual !== null;
  useEffect(() => {
    onDetalheChange?.(emDetalhe);
    return () => onDetalheChange?.(false);
  }, [emDetalhe, onDetalheChange]);

  useImperativeHandle(ref, () => ({
    async voltar() {
      if (processando || !atual) return;
      if (
        sessao &&
        !(await dialogos.confirmar(
          "Sair sem finalizar? Esta sessão não será contabilizada.",
        ))
      )
        return;
      setSessao(null);
      setMostrarDevolutiva(false);
      fecharEdicao();
      setAtual(null);
    },
  }));

  async function salvarPergunta() {
    if (form?.modo !== "perguntas" || !perguntaEmEdicao || destino === null)
      return;
    const transferir = destino !== form.id;
    if (
      transferir &&
      !(await dialogos.confirmar(
        "Mover esta pergunta reiniciará o agendamento dos dois questionários. O histórico será preservado. Continuar?",
      ))
    )
      return;
    await executar(async () => {
      await api.atualizarPergunta(perguntaEmEdicao.id, {
        enunciado: perguntaEmEdicao.enunciado,
        resposta: perguntaEmEdicao.resposta,
        questionario: destino,
        manter_agendamento: manter && !transferir,
        confirmar_reinicio: true,
      });
      setPerguntaEmEdicao(null);
      lista.atualizar();
      window.dispatchEvent(new Event("revisoes:atualizadas"));
      await abrir(form.id);
    });
  }

  async function removerPergunta(id: string) {
    if (
      form?.modo !== "perguntas" ||
      !(await dialogos.confirmar(
        "Remover a pergunta? O agendamento será reiniciado. O histórico será preservado.",
      ))
    )
      return;
    await executar(async () => {
      await api.excluirPergunta(id);
      lista.atualizar();
      window.dispatchEvent(new Event("revisoes:atualizadas"));
      await abrir(form.id);
    });
  }

  const treinoAutomatico =
    !!atual?.proxima_revisao && atual.proxima_revisao > hoje();
  function iniciar(treino: boolean) {
    if (!atual) return;
    setRespostas({});
    setSessao({ chave: crypto.randomUUID(), versao: atual.versao, treino });
  }
  function mudar(
    id: string,
    valor: Partial<{
      texto: string;
      resultado: api.Classificacao;
      revelada: boolean;
    }>,
  ) {
    if (!sessao) iniciar(treinoAutomatico);
    setRespostas((r) => ({
      ...r,
      [id]: { ...(r[id] ?? { texto: "", revelada: false }), ...valor },
    }));
  }
  async function finalizar() {
    if (!atual || !sessao || !completas) return;
    await executar(async () => {
      const d = await api.finalizarQuestionario(atual.id, {
        ...sessao,
        respostas: perguntas.map((p) => ({
          pergunta: p.id,
          resposta_digitada: respostas[p.id].texto,
          resultado: respostas[p.id].resultado!,
        })),
      });
      setSessao(null);
      setRespostas({});
      setDevolutiva(d);
      setMostrarDevolutiva(true);
      lista.atualizar();
      window.dispatchEvent(new Event("revisoes:atualizadas"));
      setAtual(await api.obterQuestionario(atual.id));
    });
  }
  const completas =
    perguntas.length > 0 && perguntas.every((p) => respostas[p.id]?.resultado);
  const visiveis = lista.dados?.itens ?? [];
  return (
    <section className="revisoes" aria-label="Questionários">
      <div className="revisoes-titulo">
        <h2>{atual ? atual.titulo : "Seus questionários"}</h2>
        <button onClick={() => setAjuda(true)}>
          Como marcamos a repetição do questionário?
        </button>
      </div>
      {erro && (
        <p role="alert" className="revisoes-aviso">
          {erro}
        </p>
      )}
      {processando && <p role="status">Processando...</p>}
      {!atual ? (
        <>
          <div className="revisoes-filtros">
            <input
              aria-label="Buscar questionário"
              placeholder="Buscar questionário"
              value={busca}
              maxLength={150}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
            />
            <select
              aria-label="Situação"
              value={situacao}
              onChange={(e) => {
                setSituacao(e.target.value);
                setPagina(1);
              }}
            >
              <option value="">Todos</option>
              <option value="hoje">Para hoje</option>
              <option value="atrasadas">Atrasados</option>
              <option value="novos">Ainda não estudados</option>
            </select>
          </div>
          {lista.erro && (
            <p role="alert" className="revisoes-aviso">
              {lista.erro}{" "}
              <button type="button" onClick={lista.atualizar}>
                Tentar novamente
              </button>
            </p>
          )}
          {lista.carregando && <p role="status">Carregando questionários...</p>}
          {!processando && lista.dados && !visiveis.length && (
            <p>
              Nenhum questionário encontrado. Crie uma pergunta em uma anotação
              para gerar um questionário automaticamente.
            </p>
          )}
          <div className="revisoes-lista">
            {visiveis.map((q) => (
              <article key={q.id}>
                <h3>{q.titulo}</h3>
                <p>
                  {q.total_perguntas}{" "}
                  {q.total_perguntas === 1 ? "pergunta" : "perguntas"}
                </p>
                <p>Próxima revisão: {dataBr(q.proxima_revisao)}</p>
                <div className="revisoes-acoes">
                  <button
                    disabled={processando}
                    onClick={() => void abrir(q.id)}
                  >
                    Abrir
                  </button>
                  <button
                    disabled={processando}
                    onClick={() => editarQuestionario(q)}
                  >
                    Editar
                  </button>
                  <button
                    className="is-danger"
                    disabled={processando}
                    onClick={async () => {
                      if (
                        await dialogos.confirmar(
                          "Excluir este questionário e seus resultados? As anotações serão preservadas.",
                        )
                      )
                        void executar(async () => {
                          await api.removerQuestionario(q.id);
                          lista.atualizar();
                          window.dispatchEvent(
                            new Event("revisoes:atualizadas"),
                          );
                        });
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
          {lista.dados && (
            <Paginacao
              pagina={lista.dados.pagina}
              total={lista.dados.total_paginas}
              disabled={processando}
              onChange={setPagina}
            />
          )}
        </>
      ) : mostrarDevolutiva && devolutiva ? (
        <DevolutivaQuestionario
          devolutiva={devolutiva}
          atual={atual}
          onOpenNote={onOpenNote}
        />
      ) : (
        <>
          <p>
            Próxima revisão: {dataBr(atual.proxima_revisao)} ·{" "}
            {atual.limite_dias
              ? `Limite: ${atual.limite_dias} dias`
              : "Sem limite máximo"}
          </p>
          {!sessao && (
            <div className="revisoes-acoes">
              {devolutiva && (
                <button
                  type="button"
                  disabled={processando || form?.modo === "perguntas"}
                  onClick={() => setMostrarDevolutiva(true)}
                >
                  Ver devolutiva
                </button>
              )}
              {form?.modo === "perguntas" ? (
                <button
                  type="button"
                  disabled={processando}
                  onClick={fecharEdicao}
                >
                  Sair da edição
                </button>
              ) : (
                <button
                  type="button"
                  disabled={processando}
                  onClick={() => void editarPerguntas(atual.id)}
                >
                  Editar perguntas
                </button>
              )}
            </div>
          )}
          {form?.modo === "perguntas" ? (
            <section aria-label="Edição das perguntas">
              {!perguntas.length && (
                <p>Este questionário está sem perguntas.</p>
              )}
              {perguntas.map((p, i) => (
                <article key={p.id}>
                  {perguntaEmEdicao?.id === p.id ? (
                    <form
                      className="revisoes-edicao-form"
                      aria-label={`Editar pergunta ${i + 1}`}
                      onSubmit={(e) => {
                        e.preventDefault();
                        void salvarPergunta();
                      }}
                    >
                      <div className="revisoes-acoes">
                        <button
                          className="is-primary"
                          disabled={processando}
                          type="submit"
                        >
                          Salvar alterações
                        </button>
                        <button
                          disabled={processando}
                          type="button"
                          onClick={() => {
                            setPerguntaEmEdicao(null);
                            setErro("");
                          }}
                        >
                          Cancelar
                        </button>
                      </div>

                      <label>
                        Pergunta
                        <textarea
                          aria-label="Pergunta"
                          required
                          maxLength={20000}
                          disabled={processando}
                          value={perguntaEmEdicao.enunciado}
                          onChange={(e) =>
                            setPerguntaEmEdicao({
                              ...perguntaEmEdicao,
                              enunciado: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Resposta esperada
                        <textarea
                          aria-label="Resposta esperada"
                          required
                          maxLength={20000}
                          disabled={processando}
                          value={perguntaEmEdicao.resposta}
                          onChange={(e) =>
                            setPerguntaEmEdicao({
                              ...perguntaEmEdicao,
                              resposta: e.target.value,
                            })
                          }
                        />
                      </label>

                      <div className="revisoes-edicao-opcoes">
                        <label>
                          Questionário de destino
                          <select
                            aria-label="Questionário de destino"
                            disabled={processando}
                            value={destino ?? form.id}
                            onChange={(e) => {
                              setDestino(e.target.value);
                              setManter(false);
                            }}
                          >
                            <option value={form.id}>
                              Manter neste questionário
                            </option>
                            {form.destinos.map((q) => (
                              <option key={q.id} value={q.id}>
                                {q.titulo}
                              </option>
                            ))}
                          </select>
                        </label>
                        {destino === form.id && (
                          <label className="revisoes-edicao-checkbox">
                            <span>
                              Apenas ajuste de texto: manter o agendamento
                            </span>
                            <input
                              type="checkbox"
                              disabled={processando}
                              checked={manter}
                              onChange={(e) => setManter(e.target.checked)}
                            />
                          </label>
                        )}
                      </div>

                      {destino !== form.id ? (
                        <p className="revisoes-aviso">
                          A transferência reiniciará o agendamento dos dois
                          questionários. O histórico será preservado.
                        </p>
                      ) : manter ? (
                        <p>
                          Use apenas para correções que preservem o significado.
                        </p>
                      ) : (
                        <p className="revisoes-aviso">{AVISO}</p>
                      )}
                    </form>
                  ) : (
                    <>
                      <h3>
                        {i + 1}. {p.enunciado}
                      </h3>
                      <div className="revisoes-acoes">
                        <button
                          type="button"
                          disabled={processando}
                          onClick={() => selecionarPergunta(p, form.id)}
                        >
                          Editar pergunta
                        </button>
                        <button
                          type="button"
                          disabled={processando}
                          onClick={() => void removerPergunta(p.id)}
                        >
                          Remover
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </section>
          ) : (
            <>
              <p className="revisoes-aviso">
                {(sessao?.treino ?? treinoAutomatico)
                  ? "Treino livre"
                  : "Revisão programada"}
                : só será registrada ao clicar em Finalizar.
              </p>
              {!sessao && !treinoAutomatico && (
                <button
                  type="button"
                  disabled={processando || !perguntas.length}
                  onClick={() => iniciar(true)}
                >
                  Treino livre
                </button>
              )}
              {!perguntas.length && (
                <p>Crie perguntas no editor das suas anotações.</p>
              )}
              {perguntas.map((p, i) => {
                const r = respostas[p.id];
                return (
                  <article key={p.id}>
                    <h3>
                      {i + 1}. {p.enunciado}
                    </h3>
                    <textarea
                      aria-label={`Sua resposta ${i + 1}`}
                      value={r?.texto ?? ""}
                      disabled={processando}
                      onChange={(e) => mudar(p.id, { texto: e.target.value })}
                    />
                    <button
                      disabled={processando}
                      onClick={() => mudar(p.id, { revelada: true })}
                    >
                      Ver resposta esperada
                    </button>
                    {r?.revelada && (
                      <>
                        <p className="revisoes-resposta">{p.resposta}</p>
                        <div
                          className="revisoes-acoes"
                          role="group"
                          aria-label={`Classificar pergunta ${i + 1}`}
                        >
                          {ORDEM_RESULTADOS.map((tipo) => (
                            <button
                              key={tipo}
                              disabled={processando}
                              aria-pressed={r.resultado === tipo}
                              className={`resultado-${tipo}`}
                              onClick={() => mudar(p.id, { resultado: tipo })}
                            >
                              {CLASSIFICACOES[tipo]}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
              {perguntas.length > 0 && (
                <button
                  className="is-primary"
                  disabled={processando || !completas}
                  onClick={() => void finalizar()}
                >
                  Finalizar
                </button>
              )}
            </>
          )}
        </>
      )}
      {form?.modo === "questionario" && (
        <Modal
          title="Editar questionário"
          onClose={() => setFormulario(null)}
          busy={processando}
          actions={
            <div className="revisoes-acoes">
              <button
                className="is-primary"
                type="submit"
                form="editar-questionario"
                disabled={processando}
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setFormulario(null)}
                disabled={processando}
              >
                Cancelar
              </button>
            </div>
          }
        >
          <form
            id="editar-questionario"
            onSubmit={(e) => {
              e.preventDefault();
              void executar(async () => {
                await api.salvarQuestionario(
                  {
                    titulo: form.titulo,
                    limite_dias: form.limite ? Number(form.limite) : null,
                  },
                  form.id,
                );
                setFormulario(null);
                lista.atualizar();
              });
            }}
          >
            <label>
              Título
              <input
                required
                maxLength={150}
                value={form.titulo}
                onChange={(e) =>
                  setFormulario({ ...form, titulo: e.target.value })
                }
              />
            </label>
            <label>
              Intervalo máximo
              <select
                aria-label="Intervalo máximo"
                value={form.limite === "" ? "sem" : "definir"}
                onChange={(e) =>
                  setFormulario({
                    ...form,
                    limite: e.target.value === "sem" ? "" : "20",
                  })
                }
              >
                <option value="sem">Sem limite</option>
                <option value="definir">Definir limite</option>
              </select>
            </label>
            {form.limite !== "" && (
              <label>
                Máximo de dias
                <input
                  type="number"
                  min={1}
                  max={36500}
                  required
                  value={form.limite}
                  onChange={(e) =>
                    setFormulario({ ...form, limite: e.target.value })
                  }
                />
              </label>
            )}
            <p>
              O limite passa a valer na próxima revisão concluída. Renomear o
              questionário preserva o agendamento e o histórico.
            </p>
          </form>
          {erro && <p role="alert">{erro}</p>}
        </Modal>
      )}
      {ajuda && (
        <Modal
          title="Sobre as revisões"
          onClose={() => setAjuda(false)}
          actions={
            <p>
              <button type="button" onClick={() => setAjuda(false)}>
                Fechar
              </button>
            </p>
          }
        >
          <p>
            Usamos uma adaptação do SuperMemo SM-2 para o questionário completo.
            Ao finalizar, acertos valem 1, parciais 0,5 e erros 0. Multiplicamos
            a proporção por 5 e usamos a parte inteira como avaliação de 0 a 5.
          </p>
          <p>
            A facilidade começa em 2,5. Avaliações de 3 a 5 avançam a sequência:
            primeiro 1 dia, depois 6 dias e, a partir daí, o intervalo anterior
            multiplicado pela facilidade. A facilidade é ajustada a cada
            revisão. Uma avaliação inferior a 3 reinicia a sequência em 1 dia.
          </p>
          <p>
            Você pode limitar o máximo de dias ou deixar sem limite. O prazo
            começa na conclusão. A adaptação e os pesos são escolhas do Locus,
            sem garantia de memorização. A porcentagem de acertos no painel
            considera apenas os acertos completos.
          </p>
          <a
            href="https://super-memory.org/archive/english/ol/sm2.htm"
            target="_blank"
            rel="noreferrer"
          >
            Referência do SM-2
          </a>
        </Modal>
      )}
    </section>
  );
}
