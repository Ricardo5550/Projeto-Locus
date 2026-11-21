import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import Paginacao from "../../components/Paginacao";
import { useDadosGestao } from "./useDadosGestao";
import {
  dataGestao,
  type OpcoesAuditoria,
  type PaginaGestao,
  type RegistroGestao,
} from "./apiGestao";

export default function AuditoriaGestao() {
  const [params, setParams] = useSearchParams();
  const consulta = useDadosGestao<PaginaGestao<RegistroGestao>>(
    `/gestao/auditoria/?${params}`,
  );
  const opcoes = useDadosGestao<OpcoesAuditoria>("/gestao/auditoria/opcoes/");
  function filtrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget),
      proximo = new URLSearchParams();
    for (const [chave, valor] of dados)
      if (String(valor).trim()) proximo.set(chave, String(valor).trim());
    setParams(proximo);
  }
  return (
    <>
      <h2>Auditoria</h2>
      <p>
        Registros de operações, autenticação e atendimento. E-mails são
        mascarados. Para consultar um endereço, use Mostrar e-mail na lista de
        contas e informe o motivo.
      </p>
      <form
        className="gestao-filtros"
        key={params.toString()}
        onSubmit={filtrar}
      >
        <label>
          Responsável ou ação
          <input
            name="busca"
            maxLength={150}
            defaultValue={params.get("busca") ?? ""}
          />
        </label>
        <FiltroOpcoes
          nome="acao"
          titulo="Ação"
          todos="Todas"
          inicial={params.get("acao") ?? ""}
          opcoes={opcoes.dados?.acoes ?? []}
        />
        <FiltroOpcoes
          nome="recurso"
          titulo="Recurso"
          todos="Todos"
          inicial={params.get("recurso") ?? ""}
          opcoes={opcoes.dados?.recursos ?? []}
        />
        <label>
          Resultado
          <select
            aria-label="Resultado"
            name="resultado"
            defaultValue={params.get("resultado") ?? ""}
          >
            <option value="">Todos</option>
            <option value="sucesso">Sucesso</option>
            <option value="falha">Falha</option>
            <option value="bloqueado">Bloqueado</option>
          </select>
        </label>
        <label>
          Início
          <input
            name="inicio"
            type="date"
            defaultValue={params.get("inicio") ?? ""}
          />
        </label>
        <label>
          Fim
          <input
            name="fim"
            type="date"
            defaultValue={params.get("fim") ?? ""}
          />
        </label>
        <button className="page-action is-primary">Filtrar</button>
        <button
          className="page-action"
          type="button"
          onClick={() => setParams({})}
        >
          Limpar
        </button>
      </form>
      {opcoes.erro && (
        <p role="alert">
          Não foi possível carregar as opções dos filtros.{" "}
          <button className="page-action" onClick={opcoes.atualizar}>
            Tentar novamente
          </button>
        </p>
      )}
      {consulta.carregando && <p role="status">Carregando registros…</p>}
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
          <div className="gestao-resumo">
            <p>{consulta.dados.total} registro(s)</p>
            <button
              className="page-action"
              onClick={() => {
                consulta.atualizar();
                opcoes.atualizar();
              }}
            >
              Atualizar registros
            </button>
          </div>
          <div className="gestao-tabela">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Responsável</th>
                  <th>Ação</th>
                  <th>Resultado</th>
                  <th>Recurso</th>
                  <th>IP</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                {consulta.dados.itens.map((registro) => (
                  <tr key={registro.id}>
                    <td>{dataGestao(registro.data)}</td>
                    <td>{registro.responsavel}</td>
                    <td>{registro.acao}</td>
                    <td>{registro.resultado}</td>
                    <td>
                      {registro.recurso}
                      <small>{registro.recurso_id}</small>
                    </td>
                    <td>{registro.ip ?? "—"}</td>
                    <td>{registro.descricao || "—"}</td>
                  </tr>
                ))}
                {!consulta.dados.itens.length && (
                  <tr>
                    <td colSpan={7}>Nenhum registro encontrado.</td>
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

function FiltroOpcoes({
  nome,
  titulo,
  todos,
  inicial,
  opcoes,
}: {
  nome: string;
  titulo: string;
  todos: string;
  inicial: string;
  opcoes: string[];
}) {
  const [valor, setValor] = useState(inicial);
  return (
    <label>
      {titulo}
      <select
        aria-label={titulo}
        name={nome}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      >
        <option value="">{todos}</option>
        {opcoes.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}
