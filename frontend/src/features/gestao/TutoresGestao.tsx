import { useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Paginacao from "../../components/Paginacao";
import { useDadosGestao } from "./useDadosGestao";
import {
  dataGestao,
  decidirTutor,
  ROTA_GESTAO,
  type DetalheTutor,
  type PaginaGestao,
  type TutorGestao,
} from "./apiGestao";

export default function TutoresGestao() {
  const [params, setParams] = useSearchParams();
  const consulta = useDadosGestao<PaginaGestao<TutorGestao>>(
    `/gestao/tutores/?${params}`,
  );
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
      <h2>Aprovação de tutores</h2>
      <form
        className="gestao-filtros"
        key={params.toString()}
        onSubmit={filtrar}
      >
        <label>
          Buscar tutor ou usuário
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
            <option value="pendente">Aguardando análise</option>
            <option value="aprovado">Aprovados</option>
            <option value="rejeitado">Rejeitados</option>
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
      {consulta.carregando && <p role="status">Carregando tutores…</p>}
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
          <p>{consulta.dados.total} perfil(is)</p>
          <div className="gestao-tabela">
            <table>
              <thead>
                <tr>
                  <th>Tutor</th>
                  <th>Usuário</th>
                  <th>Área</th>
                  <th>Situação</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {consulta.dados.itens.map((perfil) => (
                  <tr key={perfil.id}>
                    <td>{perfil.nome}</td>
                    <td>{perfil.usuario}</td>
                    <td>{perfil.area}</td>
                    <td>
                      {perfil.situacao === "rejeitado"
                        ? "Rejeitado"
                        : perfil.aprovado
                          ? "Aprovado"
                          : "Aguardando análise"}
                      {(!perfil.ativo || !perfil.conta_ativa) && " · Inativo"}
                    </td>
                    <td>
                      <Link to={`${ROTA_GESTAO}/tutores/${perfil.id}`}>
                        Analisar
                      </Link>
                    </td>
                  </tr>
                ))}
                {!consulta.dados.itens.length && (
                  <tr>
                    <td colSpan={5}>Nenhum perfil encontrado.</td>
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

export function DetalheTutorGestao() {
  const { perfilId = "" } = useParams();
  return <AnaliseTutor key={perfilId} id={perfilId} />;
}

function AnaliseTutor({ id }: { id: string }) {
  const consulta = useDadosGestao<DetalheTutor>(`/gestao/tutores/${id}/`);
  const [motivo, setMotivo] = useState("");
  const [processando, setProcessando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (processando) return;
    const decisao = (
      (evento.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    )?.value;
    if (decisao !== "sim" && decisao !== "nao") return;
    setProcessando(true);
    setAviso("");
    setErro("");
    try {
      const resposta = await decidirTutor(id, decisao, motivo);
      setAviso(resposta.detail);
      setMotivo("");
      consulta.atualizar();
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível salvar a decisão.",
      );
    } finally {
      setProcessando(false);
    }
  }
  return (
    <>
      {consulta.carregando && <p role="status">Carregando perfil…</p>}
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
          <p className="gestao-descricao">{consulta.dados.descricao}</p>
          <p>
            Área: {consulta.dados.area} ·{" "}
            {consulta.dados.situacao === "rejeitado"
              ? "Rejeitado"
              : consulta.dados.aprovado
                ? "Aprovado"
                : "Aguardando análise"}
          </p>
          <p>
            Perfil {consulta.dados.ativo ? "ativo" : "inativo"} · Conta{" "}
            {consulta.dados.conta_ativa ? "ativa" : "inativa"} · Solicitação:{" "}
            {dataGestao(consulta.dados.criado_em)}
          </p>
          <section className="gestao-cartao">
            <h3>Formação e certificados</h3>
            {consulta.dados.formacoes.map((formacao, i) => (
              <article key={i}>
                <h4>{formacao.titulo}</h4>
                <p>{formacao.instituicao}</p>
                {formacao.link ? (
                  <a
                    href={formacao.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir comprovante
                  </a>
                ) : (
                  <p>Comprovante não informado ou inválido.</p>
                )}
              </article>
            ))}
            {!consulta.dados.formacoes.length && (
              <p>Este perfil ainda não apresentou certificado.</p>
            )}
          </section>
          {consulta.dados.motivo_rejeicao && (
            <p>Motivo da rejeição: {consulta.dados.motivo_rejeicao}</p>
          )}
          <section className="gestao-cartao">
            <h3>Decisão administrativa</h3>
            <p>
              O motivo da rejeição será enviado ao solicitante por notificação e
              ficará disponível no perfil para correção e reenvio.
            </p>
            <form
              className="gestao-formulario"
              onSubmit={(e) => void salvar(e)}
            >
              <label>
                Motivo
                <textarea
                  rows={3}
                  required
                  minLength={5}
                  maxLength={300}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  disabled={processando}
                />
              </label>
              <small>
                Descreva o motivo sem incluir dados pessoais, senhas ou códigos.
              </small>
              <div className="gestao-decisoes">
                <button
                  type="submit"
                  value="sim"
                  className="page-action is-primary"
                  disabled={processando || consulta.dados.aprovado}
                >
                  Aprovar
                </button>
                <button
                  type="submit"
                  value="nao"
                  className="page-action"
                  disabled={
                    processando || consulta.dados.situacao === "rejeitado"
                  }
                >
                  {consulta.dados.aprovado ? "Retirar aprovação" : "Rejeitar"}
                </button>
              </div>
            </form>
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
