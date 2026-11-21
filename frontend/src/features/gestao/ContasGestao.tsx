import { useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Paginacao from "../../components/Paginacao";
import { useDialogos } from "../../components/contextoDialogos";
import { useDadosGestao } from "./useDadosGestao";
import {
  atenderConta,
  dataGestao,
  ROTA_GESTAO,
  type ContaGestao,
  type DetalheConta,
  type PaginaGestao,
} from "./apiGestao";

export default function ContasGestao() {
  const [params] = useSearchParams();
  return <ListaContas key={params.toString()} />;
}

function ListaContas() {
  const [params, setParams] = useSearchParams();
  const consulta = useDadosGestao<PaginaGestao<ContaGestao>>(
    `/gestao/contas/?${params}`,
  );
  const dialogos = useDialogos();
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [consultando, setConsultando] = useState(false);
  const [erroEmail, setErroEmail] = useState("");
  async function revelar(conta: ContaGestao) {
    if (consultando) return;
    const motivo = await dialogos.perguntar(
      `Informe o motivo para consultar o e-mail de ${conta.nome}:`,
    );
    if (motivo === null) return;
    setConsultando(true);
    setErroEmail("");
    try {
      const resposta = await atenderConta(conta.id, "revelar_email", motivo);
      if (typeof resposta.email === "string")
        setEmails((v) => ({ ...v, [conta.id]: resposta.email! }));
    } catch (e) {
      setErroEmail(
        e instanceof Error ? e.message : "Não foi possível consultar o e-mail.",
      );
    } finally {
      setConsultando(false);
    }
  }
  function filtrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const proximo = new URLSearchParams();
    for (const [chave, valor] of dados)
      if (String(valor).trim()) proximo.set(chave, String(valor).trim());
    setParams(proximo);
  }
  return (
    <>
      <h2>Contas e suporte</h2>
      <p>
        Consulte as contas. O endereço completo de e-mail exige motivo e fica
        registrado na auditoria.
      </p>
      <form
        className="gestao-filtros"
        key={params.toString()}
        onSubmit={filtrar}
      >
        <label>
          Buscar usuário ou e-mail
          <input
            name="busca"
            maxLength={150}
            defaultValue={params.get("busca") ?? ""}
          />
        </label>
        <label>
          Situação
          <select
            aria-label="Situação"
            name="situacao"
            defaultValue={params.get("situacao") ?? ""}
          >
            <option value="">Todas</option>
            <option value="ativa">Ativas</option>
            <option value="inativa">Inativas</option>
          </select>
        </label>
        <button className="page-action is-primary">Buscar</button>
        <button
          className="page-action"
          type="button"
          onClick={() => setParams({})}
        >
          Limpar
        </button>
      </form>
      {erroEmail && (
        <p className="gestao-erro" role="alert">
          {erroEmail}
        </p>
      )}
      {consulta.carregando && <p role="status">Carregando contas…</p>}
      {consulta.erro && (
        <p role="alert">
          {consulta.erro}{" "}
          <button className="page-action" onClick={consulta.atualizar}>
            Tentar novamente
          </button>
        </p>
      )}
      {consulta.dados && (
        <>
          <p>{consulta.dados.total} conta(s)</p>
          <div className="gestao-tabela">
            <table>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Situação</th>
                  <th>Acesso</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {consulta.dados.itens.map((conta) => (
                  <tr key={conta.id}>
                    <td>{conta.nome}</td>
                    <td>
                      <div className="gestao-email">
                        <span className="gestao-email__endereco">
                          {emails[conta.id] ?? conta.email_oculto}
                        </span>
                        {emails[conta.id] !== undefined ? (
                          <button
                            type="button"
                            className="page-action"
                            onClick={() =>
                              setEmails((v) => {
                                const novo = { ...v };
                                delete novo[conta.id];
                                return novo;
                              })
                            }
                          >
                            Ocultar e-mail
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="page-action"
                            disabled={consultando}
                            onClick={() => void revelar(conta)}
                          >
                            Mostrar e-mail
                          </button>
                        )}
                      </div>
                    </td>
                    <td>{conta.ativa ? "Ativa" : "Inativa"}</td>
                    <td>
                      {conta.supremo
                        ? "Admin supremo"
                        : conta.administrador
                          ? "Admin comum"
                          : "Usuário"}
                    </td>
                    <td>
                      <Link to={`${ROTA_GESTAO}/contas/${conta.id}`}>
                        Atender
                      </Link>
                    </td>
                  </tr>
                ))}
                {!consulta.dados.itens.length && (
                  <tr>
                    <td colSpan={5}>Nenhuma conta encontrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Paginacao
            pagina={consulta.dados.pagina}
            total={consulta.dados.total_paginas}
            onChange={(pagina) => {
              const proximo = new URLSearchParams(params);
              proximo.set("pagina", String(pagina));
              setParams(proximo);
            }}
          />
        </>
      )}
    </>
  );
}

export function DetalheContaGestao() {
  const { usuarioId = "" } = useParams();
  return <AtendimentoConta key={usuarioId} id={usuarioId} />;
}

function AtendimentoConta({ id }: { id: string }) {
  const consulta = useDadosGestao<DetalheConta>(`/gestao/contas/${id}/`);
  const [acao, setAcao] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const acaoEquipe = [
    "promover_supremo",
    "rebaixar_admin",
    "concluir_encerramento",
  ].includes(acao);
  const [motivo, setMotivo] = useState("");
  const [processando, setProcessando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const dialogos = useDialogos();
  async function executar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (processando) return;
    const acaoAtual = acao || consulta.dados?.acoes[0]?.valor;
    if (!acaoAtual) return;
    setProcessando(true);
    setErro("");
    setAviso("");

    try {
      if (
        [
          "suspender",
          "encerrar_sessoes",
          "promover_supremo",
          "rebaixar_admin",
          "concluir_encerramento",
        ].includes(acaoAtual) &&
        !(await dialogos.confirmar(
          acaoAtual === "concluir_encerramento"
            ? "Concluir o encerramento solicitado? Confira a transferência de responsabilidade. O acesso será encerrado e os dados de cadastro serão removidos; a auditoria permanece."
            : "Confirma esta ação de atendimento? Ela será registrada na auditoria.",
        ))
      )
        return;
      const resultado = await atenderConta(id, acaoAtual, motivo, senhaAtual);
      setAviso(resultado.detail);
      setMotivo("");
      setAcao("");
      consulta.atualizar();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir o atendimento.",
      );
    } finally {
      setSenhaAtual("");
      setProcessando(false);
    }
  }
  return (
    <>
      {consulta.carregando && <p role="status">Carregando conta…</p>}
      {consulta.erro && (
        <p role="alert">
          {consulta.erro}{" "}
          <button className="page-action" onClick={consulta.atualizar}>
            Tentar novamente
          </button>
        </p>
      )}
      {consulta.dados && (
        <>
          <h2>{consulta.dados.nome}</h2>
          {consulta.dados.ultimo_supremo && (
            <p className="gestao-aviso" role="status">
              Este é o último supremo ativo. Não pode ser suspenso, encerrado ou
              rebaixado antes de configurar outro supremo ativo.
            </p>
          )}
          {consulta.dados.pedido_encerramento && (
            <section className="gestao-cartao">
              <h3>Pedido de encerramento pendente</h3>
              <p>{consulta.dados.pedido_encerramento.motivo}</p>
              <p>{dataGestao(consulta.dados.pedido_encerramento.criada_em)}</p>
              <p>
                Confira a transferência de responsabilidade e o tratamento dos
                dados antes de concluir. O encerramento deve ser realizado por
                outro supremo.
              </p>
            </section>
          )}
          <section className="gestao-cartao">
            <dl className="gestao-dados">
              <dt>Perfil</dt>
              <dd>
                {consulta.dados.supremo
                  ? "Administrador supremo"
                  : consulta.dados.administrador
                    ? "Administrador comum"
                    : "Usuário"}
              </dd>
              <dt>Identificador</dt>
              <dd>{consulta.dados.id}</dd>
              <dt>E-mail</dt>
              <dd>{consulta.dados.email_oculto}</dd>
              <dt>Situação</dt>
              <dd>{consulta.dados.ativa ? "Ativa" : "Inativa"}</dd>
              <dt>E-mail confirmado</dt>
              <dd>{consulta.dados.email_confirmado ? "Sim" : "Não"}</dd>
              <dt>2FA ativo</dt>
              <dd>{consulta.dados.mfa_ativo ? "Sim" : "Não"}</dd>
              <dt>Cadastro</dt>
              <dd>{dataGestao(consulta.dados.cadastro)}</dd>
              <dt>Último acesso</dt>
              <dd>{dataGestao(consulta.dados.ultimo_acesso)}</dd>
            </dl>
          </section>
          <section className="gestao-cartao">
            <h3>Atendimento</h3>
            <p>
              As ações de suporte exigem um motivo e são registradas com a sua
              identificação.
            </p>
            {!consulta.dados.pode_atender && (
              <p>
                Esta conta não permite ações de suporte neste atendimento. A
                consulta do e-mail está disponível na lista de contas.
              </p>
            )}
            {!!consulta.dados.acoes.length && (
              <form
                className="gestao-formulario"
                onSubmit={(e) => void executar(e)}
              >
                <label>
                  Ação
                  <select
                    aria-label="Ação"
                    value={acao || consulta.dados.acoes[0]?.valor || ""}
                    onChange={(e) => {
                      setAcao(e.target.value);
                      setSenhaAtual("");
                    }}
                    disabled={processando}
                  >
                    {consulta.dados.acoes.map((item) => (
                      <option value={item.valor} key={item.valor}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Motivo
                  <textarea
                    minLength={5}
                    maxLength={300}
                    required
                    rows={3}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    disabled={processando}
                  />
                </label>
                {acaoEquipe && (
                  <label>
                    Sua senha atual
                    <input
                      type="password"
                      autoComplete="current-password"
                      maxLength={1024}
                      required
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                      disabled={processando}
                    />
                  </label>
                )}
                <small>
                  Descreva o motivo sem incluir dados pessoais, senhas ou
                  códigos.
                </small>
                <button
                  className="page-action is-primary"
                  disabled={processando}
                >
                  {processando ? "Processando…" : "Executar ação"}
                </button>
              </form>
            )}
          </section>
        </>
      )}
      {aviso && (
        <p className="gestao-aviso" role="status">
          {aviso}
        </p>
      )}
      {erro && (
        <p className="gestao-erro" role="alert">
          {erro}
        </p>
      )}
    </>
  );
}
