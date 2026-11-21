import DevolutivaQuestionario from "./DevolutivaQuestionario";
import { ORDEM_RESULTADOS, CLASSIFICACOES } from "./classificacoes";
import { useDialogos } from "../../components/contextoDialogos";
import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import Modal from "../../components/Modal";
import Paginacao from "../../components/Paginacao";
import { useListaPaginada } from "../../services/useListaPaginada";
import * as api from "./apiRevisoes";
import "./Questionario.css";
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
  onAbrirQuestionario?: (id: string) => void;
  onVoltarLista?: () => void;
  onOpenNote?: (id: string, title: string, questionario: string) => void;
  onSessionChange?: (active: boolean) => void;
  onDetalheChange?: (aberto: boolean) => void;
};
function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export default function Questionario({
  ref,
  initialId = null,
  initialDevolutiva = false,
  onAbrirQuestionario,
  onVoltarLista,
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
      {
        texto: string;
        resultado?: api.Classificacao;
        revelada: boolean;
        alternativa?: number;
      }
    >
  >({});
  const [ordemPerguntas, setOrdemPerguntas] = useState<string[]>([]);
  const [ordemAlternativas, setOrdemAlternativas] = useState<
    Record<string, number[]>
  >({});
  const [paginaPergunta, setPaginaPergunta] = useState(0);
  const [pagina, setPagina] = useState(1);
  const filtros = new URLSearchParams({ pagina: String(pagina) });
  if (busca.trim()) filtros.set("busca", busca.trim());
  if (situacao) filtros.set("situacao", situacao);
  const lista = useListaPaginada<api.QuestionarioSalvo>(
    atual ? null : `/questionarios/paginados/?${filtros}`,
  );

  async function abrir(id: string, verDevolutiva = false, sinal?: AbortSignal) {
    if (onAbrirQuestionario && id !== initialId) {
      onAbrirQuestionario(id);
      return;
    }
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
      setOrdemPerguntas(embaralhar(p.map((pergunta) => pergunta.id)));
      setOrdemAlternativas(
        Object.fromEntries(
          p.map((pergunta) => [
            pergunta.id,
            embaralhar(
              (pergunta.alternativas ?? []).map((_, indice) => indice),
            ),
          ]),
        ),
      );
      setPaginaPergunta(0);
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
      onVoltarLista?.();
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
        tipo: perguntaEmEdicao.tipo,
        alternativas: perguntaEmEdicao.alternativas,
        alternativa_correta: perguntaEmEdicao.alternativa_correta,
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
      alternativa: number;
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
          alternativa: respostas[p.id].alternativa,
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
  const perguntasDaRevisao = ordemPerguntas
    .map((id) => perguntas.find((p) => p.id === id))
    .filter((p): p is api.PerguntaEstudo => !!p);
  const visiveis = lista.dados?.itens ?? [];
  return (
    <section className="revisoes" aria-label="Questionários">
      <div className="revisoes-titulo">
        <h2>{atual ? atual.titulo : "Seus questionários"}</h2>
        <button onClick={() => setAjuda(true)}>
          Como funciona a próxima revisão?
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

                      <label className="revisoes-tipo">
                        Tipo da questão
                        <select
                          value={perguntaEmEdicao.tipo ?? "dissertativa"}
                          disabled={processando}
                          onChange={(event) => {
                            const tipo = event.target
                              .value as api.PerguntaEstudo["tipo"];
                            setPerguntaEmEdicao({
                              ...perguntaEmEdicao,
                              tipo,
                              alternativas:
                                tipo === "alternativa"
                                  ? [perguntaEmEdicao.resposta]
                                  : [],
                              alternativa_correta:
                                tipo === "alternativa" ? 0 : null,
                            });
                          }}
                        >
                          <option value="dissertativa">Dissertativa</option>
                          <option value="alternativa">Alternativa</option>
                        </select>
                      </label>
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
                      {perguntaEmEdicao.tipo === "alternativa" ? (
                        <fieldset
                          className="revisoes-alternativas"
                          disabled={processando}
                        >
                          <legend>Alternativas — marque a correta</legend>
                          {perguntaEmEdicao.alternativas.map(
                            (texto, indice) => (
                              <div
                                className="revisoes-alternativa"
                                key={indice}
                              >
                                <input
                                  type="radio"
                                  name="alternativa-correta"
                                  aria-label={`Marcar alternativa ${indice + 1} como correta`}
                                  checked={
                                    perguntaEmEdicao.alternativa_correta ===
                                    indice
                                  }
                                  onChange={() =>
                                    setPerguntaEmEdicao({
                                      ...perguntaEmEdicao,
                                      alternativa_correta: indice,
                                      resposta: texto,
                                    })
                                  }
                                />
                                <textarea
                                  aria-label={`Alternativa ${indice + 1}`}
                                  required
                                  maxLength={20000}
                                  value={texto}
                                  onChange={(e) =>
                                    setPerguntaEmEdicao({
                                      ...perguntaEmEdicao,
                                      alternativas:
                                        perguntaEmEdicao.alternativas.map(
                                          (opcao, i) =>
                                            i === indice
                                              ? e.target.value
                                              : opcao,
                                        ),
                                      resposta:
                                        perguntaEmEdicao.alternativa_correta ===
                                        indice
                                          ? e.target.value
                                          : perguntaEmEdicao.resposta,
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const correta =
                                      perguntaEmEdicao.alternativa_correta ?? 0;
                                    const alternativas =
                                      perguntaEmEdicao.alternativas.filter(
                                        (_, i) => i !== indice,
                                      );
                                    const novaCorreta =
                                      correta === indice
                                        ? 0
                                        : correta > indice
                                          ? correta - 1
                                          : correta;
                                    setPerguntaEmEdicao({
                                      ...perguntaEmEdicao,
                                      alternativas,
                                      alternativa_correta: novaCorreta,
                                      resposta: alternativas[novaCorreta] ?? "",
                                    });
                                  }}
                                  disabled={
                                    perguntaEmEdicao.alternativas.length <= 1
                                  }
                                >
                                  Remover
                                </button>
                              </div>
                            ),
                          )}
                          <button
                            type="button"
                            disabled={
                              perguntaEmEdicao.alternativas.length >= 10
                            }
                            onClick={() =>
                              setPerguntaEmEdicao({
                                ...perguntaEmEdicao,
                                alternativas: [
                                  ...perguntaEmEdicao.alternativas,
                                  "",
                                ],
                              })
                            }
                          >
                            Adicionar alternativa
                          </button>
                          <p>De 2 a 10 alternativas, com apenas uma correta.</p>
                        </fieldset>
                      ) : (
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
                      )}

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
              {perguntasDaRevisao
                .slice(paginaPergunta, paginaPergunta + 1)
                .map((p) => {
                  const i = paginaPergunta;
                  const r = respostas[p.id];
                  return (
                    <article key={p.id}>
                      <h3>
                        {i + 1}. {p.enunciado}
                      </h3>
                      {p.tipo === "alternativa" ? (
                        <fieldset
                          className="revisoes-alternativas"
                          disabled={processando}
                        >
                          <legend>Selecione uma alternativa</legend>
                          {(ordemAlternativas[p.id] ?? []).map((indice) => (
                            <label className="revisoes-opcao" key={indice}>
                              <input
                                type="radio"
                                name={`resposta-${p.id}`}
                                checked={r?.alternativa === indice}
                                onChange={() =>
                                  mudar(p.id, {
                                    alternativa: indice,
                                    texto: p.alternativas[indice],
                                    resultado: "errei",
                                  })
                                }
                              />
                              <span>{p.alternativas[indice]}</span>
                            </label>
                          ))}
                        </fieldset>
                      ) : (
                        <>
                          <textarea
                            aria-label={`Sua resposta ${i + 1}`}
                            value={r?.texto ?? ""}
                            disabled={processando}
                            onChange={(e) =>
                              mudar(p.id, { texto: e.target.value })
                            }
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
                                    onClick={() =>
                                      mudar(p.id, { resultado: tipo })
                                    }
                                  >
                                    {CLASSIFICACOES[tipo]}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}{" "}
                        </>
                      )}
                    </article>
                  );
                })}
              {perguntas.length > 0 && (
                <nav
                  className="revisoes-paginacao"
                  aria-label="Navegação entre perguntas"
                >
                  <button
                    type="button"
                    disabled={processando || paginaPergunta === 0}
                    onClick={() => setPaginaPergunta((p) => p - 1)}
                  >
                    Anterior
                  </button>
                  <span aria-live="polite">
                    Pergunta {paginaPergunta + 1} de {perguntas.length}
                  </span>
                  <button
                    type="button"
                    disabled={
                      processando || paginaPergunta >= perguntas.length - 1
                    }
                    onClick={() => setPaginaPergunta((p) => p + 1)}
                  >
                    Próxima
                  </button>
                  <span>
                    {perguntas.filter((p) => respostas[p.id]?.resultado).length}{" "}
                    respondida(s)
                  </span>
                </nav>
              )}
              {perguntas.length > 0 &&
                paginaPergunta === perguntas.length - 1 && (
                  <section
                    className="revisoes-finalizacao"
                    aria-label="Concluir revisão"
                  >
                    <p>
                      Confira suas respostas antes de finalizar. Ao concluir, o
                      Locus processará o resultado e atualizará a devolutiva.
                    </p>
                    {!completas && (
                      <p role="status">
                        Ainda há perguntas sem resposta ou classificação. Volte
                        às páginas anteriores para completar.
                      </p>
                    )}
                    <button
                      type="button"
                      className="is-primary"
                      disabled={processando || !completas}
                      onClick={() => void finalizar()}
                    >
                      Finalizar
                    </button>
                  </section>
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
            O Locus usa suas respostas para escolher a data da próxima revisão.
            A ideia é voltar ao conteúdo antes que você o esqueça.
          </p>
          <p>
            Nas questões de alternativa, a correção é automática. Nas
            dissertativas, você compara sua resposta com a esperada e escolhe
            Acertei, Parcial ou Errei.
          </p>
          <p>
            Cada acerto vale um ponto, cada parcial vale meio ponto e cada erro
            vale zero. Por exemplo: em quatro perguntas, dois acertos, uma
            parcial e um erro somam 2,5 pontos, ou 62,5%.
          </p>
          <p>
            Se você conseguir menos de 60% dos pontos, a próxima revisão será no
            dia seguinte. Com pelo menos 60%, as duas primeiras revisões
            bem-sucedidas são marcadas para um dia e seis dias depois. A partir
            daí, o intervalo se ajusta ao seu desempenho: ele pode aumentar
            quando você vai bem e diminuir quando sente mais dificuldade.
          </p>
          <p>
            Você pode definir um limite máximo de dias entre as revisões. O
            prazo começa quando você finaliza. O treino livre serve para
            praticar e não altera esse agendamento.
          </p>
          <p>
            A devolutiva considera os parciais como meio acerto. Já a
            porcentagem de acertos em Resultados conta apenas as respostas
            totalmente corretas.
          </p>
        </Modal>
      )}
    </section>
  );
}
