import { createContext, useContext } from "react";

export type PedidoDialogo = {
  tipo: "aviso" | "confirmacao" | "texto";
  mensagem: string;
  inicial?: string;
  resolver: (valor: string | null) => void;
};

export const ContextoDialogos = createContext<{
  avisar: (mensagem: string) => Promise<void>;
  confirmar: (mensagem: string) => Promise<boolean>;
  perguntar: (mensagem: string, inicial?: string) => Promise<string | null>;
} | null>(null);

export function useDialogos() {
  const dialogos = useContext(ContextoDialogos);
  if (!dialogos)
    throw new Error("O componente precisa estar dentro de Dialogos.");
  return dialogos;
}
