import { useContext, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ContextoGestao } from "./contextoGestao";
import { useDadosGestao } from "./useDadosGestao";
import { ROTA_GESTAO, dataGestao, type PaginaGestao } from "./apiGestao";
import { apiJson } from "../../services/apiClient";

type Pedido = {
  id: string;
  usuario_id: string;
  nome: string;
  motivo: string;
  criada_em: string;
};

export function EquipeAdmin() {
  const supremo = useContext(ContextoGestao);
  if (!supremo)
    return (
      <p role="alert">
        Somente um administrador supremo pode gerenciar a equipe administrativa.
      </p>
    );
  return <ConteudoEquipe />;
}

function ConteudoEquipe() {
  const consulta = useDadosGestao<PaginaGestao<Pedido>>(
    "/gestao/encerramentos/",
  );
  return (
    <section
      className="gestao-cartao"
      aria-label="Gestão da equipe administrativa"
    >
      <h2>Equipe administrativa</h2>
      <p>
        Novas contas são administradores comuns. Somente supremos podem
        cadastrar e gerenciar a equipe.
      </p>
      <Link
        className="page-action is-primary"
        to={`${ROTA_GESTAO}/equipe/nova`}
      >
        Cadastrar administrador
      </Link>
      <h3>Pedidos de encerramento pendentes</h3>
      {consulta.carregando && <p role="status">Carregando pedidos…</p>}
      {consulta.erro && <p role="alert">{consulta.erro}</p>}
      {consulta.dados && (
        <>
          <p>{consulta.dados.total} pedido(s)</p>
          {consulta.dados.itens.map((p) => (
            <article className="gestao-pedido" key={p.id}>
              <strong>{p.nome}</strong> · {dataGestao(p.criada_em)}
              <p>{p.motivo}</p>
              <Link
                to={`${ROTA_GESTAO}/contas/${p.usuario_id}`}
                state={{ origemEquipe: true }}
              >
                Analisar encerramento
              </Link>
            </article>
          ))}
          {consulta.dados.total > consulta.dados.itens.length && (
            <p>
              São mostrados os 25 pedidos mais antigos. Após concluir um pedido,
              os seguintes aparecem aqui.
            </p>
          )}
        </>
      )}
      <button
        type="button"
        className="page-action"
        onClick={consulta.atualizar}
      >
        Atualizar pedidos
      </button>
    </section>
  );
}

export function NovoAdministrador() {
  const supremo = useContext(ContextoGestao);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [criado, setCriado] = useState<string | null>(null);
  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (processando) return;
    const form = evento.currentTarget;
    const dados = Object.fromEntries(new FormData(form));
    setProcessando(true);
    setErro("");
    setCriado(null);
    try {
      const resposta = await apiJson<{ id: string }>(
        "/gestao/administradores/",
        { method: "POST", body: JSON.stringify(dados) },
      );
      setCriado(resposta.id);
      form.reset();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível cadastrar o administrador.",
      );
    } finally {
      for (const nome of ["password", "confirmacao", "senha_atual"]) {
        const campo = form.elements.namedItem(nome);
        if (campo instanceof HTMLInputElement) campo.value = "";
      }
      setProcessando(false);
    }
  }
  if (!supremo)
    return (
      <p role="alert">
        Somente um administrador supremo pode cadastrar administradores.
      </p>
    );
  return (
    <>
      <h2>Cadastrar administrador</h2>
      <p>
        A conta nasce como administrador comum, sem permissão para cadastrar
        outros administradores. Na primeira tentativa de login, será solicitada
        a confirmação do e-mail cadastrado. Depois, o acesso exige documentos
        legais e configuração do 2FA.
      </p>
      {erro && (
        <p className="gestao-erro" role="alert">
          {erro}
        </p>
      )}
      {criado && (
        <p className="gestao-aviso" role="status">
          Administrador cadastrado. A confirmação de e-mail será solicitada na tentativa de login.{" "}
          <Link
            to={`${ROTA_GESTAO}/contas/${criado}`}
            state={{ origemEquipe: true }}
          >
            Abrir conta
          </Link>
        </p>
      )}
      <form className="gestao-formulario" onSubmit={(e) => void salvar(e)}>
        <label>
          Nome
          <input
            name="username"
            maxLength={150}
            required
            disabled={processando}
            autoComplete="off"
            aria-describedby="admin-nome-ajuda"
          />
        </label>
        <small id="admin-nome-ajuda">
          Use um nome único, sem espaços. Ele será usado para entrar na administração.
        </small>
        <label>
          E-mail da nova conta
          <input
            name="email"
            type="email"
            maxLength={254}
            required
            disabled={processando}
            autoComplete="off"
          />
        </label>
        <label>
          Senha inicial
          <input
            name="password"
            type="password"
            maxLength={1024}
            required
            disabled={processando}
            autoComplete="new-password"
          />
        </label>
        <label>
          Confirmar senha inicial
          <input
            name="confirmacao"
            type="password"
            maxLength={1024}
            required
            disabled={processando}
            autoComplete="new-password"
          />
        </label>
        <label>
          Sua senha atual
          <input
            name="senha_atual"
            type="password"
            maxLength={1024}
            required
            disabled={processando}
            autoComplete="current-password"
          />
        </label>
        <button className="page-action is-primary" disabled={processando}>
          {processando ? "Cadastrando…" : "Cadastrar administrador"}
        </button>
      </form>
    </>
  );
}
