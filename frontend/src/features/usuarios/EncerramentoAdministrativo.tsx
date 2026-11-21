import { useState, type FormEvent } from "react";
import { useDadosGestao } from "../gestao/useDadosGestao";
import { apiJson } from "../../services/apiClient";
import { useDialogos } from "../../components/contextoDialogos";

export default function EncerramentoAdministrativo({
  onSolicitado,
}: {
  onSolicitado: (mensagem: string) => void;
}) {
  const consulta = useDadosGestao<{
    pedido: { criada_em: string; motivo: string } | null;
  }>("/auth/account/encerramento/");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const dialogos = useDialogos();
  async function solicitar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (processando) return;
    const form = evento.currentTarget;
    const dados = Object.fromEntries(new FormData(form));
    setProcessando(true);
    setErro("");
    try {
      if (
        !(await dialogos.confirmar(
          "Registrar o pedido de encerramento? Suas sessões serão encerradas. A conta permanece ativa até outro supremo concluir o procedimento.",
        ))
      )
        return;
      const resposta = await apiJson<{ detail: string }>(
        "/auth/account/encerramento/",
        { method: "POST", body: JSON.stringify(dados) },
      );
      onSolicitado(resposta.detail);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível registrar o pedido.",
      );
    } finally {
      const senha = form.elements.namedItem("password");
      if (senha instanceof HTMLInputElement) senha.value = "";
      setProcessando(false);
    }
  }
  return (
    <section
      className="account-danger"
      aria-label="Encerramento administrativo"
    >
      <h2>Encerramento da conta administrativa</h2>
      <p>
        Contas administrativas possuem encerramento controlado. O pedido é
        encaminhado aos supremos para conferir a transferência de
        responsabilidade e o tratamento dos dados.
      </p>
      <p>
        O último supremo ativo precisa de um substituto antes da conclusão. O
        responsável pelo servidor pode configurar esse substituto.
      </p>
      <small>
        O encerramento não apaga automaticamente os registros de auditoria.
        Pedidos sobre dados pessoais devem ser avaliados pelo responsável pelo
        Locus.
      </small>
      {consulta.carregando && <p role="status">Consultando pedido…</p>}
      {consulta.erro && (
        <p className="account-error" role="alert">
          {consulta.erro}{" "}
          <button className="account-primary" onClick={consulta.atualizar}>
            Tentar novamente
          </button>
        </p>
      )}
      {erro && (
        <p className="account-error" role="alert">
          {erro}
        </p>
      )}
      {consulta.dados?.pedido ? (
        <p role="status">
          Pedido pendente desde{" "}
          {new Date(consulta.dados.pedido.criada_em).toLocaleString("pt-BR")}.
          Você pode sair normalmente. Outro supremo deverá concluir o
          procedimento.
        </p>
      ) : (
        consulta.dados && (
          <form onSubmit={(e) => void solicitar(e)}>
            <label htmlFor="encerramento-motivo">Motivo do encerramento</label>
            <textarea
              id="encerramento-motivo"
              name="motivo"
              minLength={5}
              maxLength={300}
              required
              disabled={processando}
            />
            <label htmlFor="encerramento-senha">
              Senha atual para solicitar encerramento
            </label>
            <input
              id="encerramento-senha"
              name="password"
              type="password"
              maxLength={1024}
              autoComplete="current-password"
              required
              disabled={processando}
            />
            <button className="account-delete" disabled={processando}>
              {processando ? "Registrando…" : "Solicitar encerramento"}
            </button>
          </form>
        )
      )}
    </section>
  );
}
