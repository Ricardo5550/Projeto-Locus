import { useRef, useState, type ReactNode } from "react";
import Modal from "./Modal";
import { ContextoDialogos, type PedidoDialogo } from "./contextoDialogos";

export default function Dialogos({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<PedidoDialogo | null>(null);
  const [texto, setTexto] = useState("");
  const fila = useRef<PedidoDialogo[]>([]);

  function abrir(atual: PedidoDialogo) {
    fila.current.push(atual);
    if (fila.current.length === 1) {
      setTexto(atual.inicial ?? "");
      setPedido(atual);
    }
  }

  function fechar(valor: string | null) {
    const atual = fila.current.shift();
    const seguinte = fila.current[0];
    setTexto(seguinte?.inicial ?? "");
    setPedido(seguinte ?? null);
    atual?.resolver(valor);
  }

  return (
    <ContextoDialogos.Provider
      value={{
        avisar: (mensagem) =>
          new Promise<void>((resolve) =>
            abrir({
              tipo: "aviso",
              mensagem,
              resolver: () => resolve(),
            }),
          ),
        confirmar: (mensagem) =>
          new Promise<boolean>((resolve) =>
            abrir({
              tipo: "confirmacao",
              mensagem,
              resolver: (valor) => resolve(valor !== null),
            }),
          ),
        perguntar: (mensagem, inicial) =>
          new Promise<string | null>((resolve) =>
            abrir({
              tipo: "texto",
              mensagem,
              inicial,
              resolver: resolve,
            }),
          ),
      }}
    >
      {children}
      {pedido && (
        <Modal
          title={
            pedido.tipo === "aviso"
              ? "Aviso"
              : pedido.tipo === "texto"
                ? "Informe o nome"
                : "Confirmação"
          }
          onClose={() => fechar(null)}
          actions={null}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              fechar(texto);
            }}
          >
            {pedido.tipo === "texto" ? (
              <label>
                {pedido.mensagem}{" "}
                <input
                  autoFocus
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  required
                />
              </label>
            ) : (
              <p>{pedido.mensagem}</p>
            )}
            <div className="locus-modal__actions">
              {pedido.tipo !== "aviso" && (
                <button
                  autoFocus={pedido.tipo === "confirmacao"}
                  type="button"
                  className="page-action"
                  onClick={() => fechar(null)}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="page-action"
                autoFocus={pedido.tipo === "aviso"}
              >
                {pedido.tipo === "aviso" ? "OK" : "Confirmar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </ContextoDialogos.Provider>
  );
}
