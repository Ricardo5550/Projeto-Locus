import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { useDialogos } from "../components/contextoDialogos";

/** Os botões existentes já confirmam/salvam. Protege também Voltar/Avançar e F5. */
export function useProtecaoHistorico(aviso: string | null) {
  const dialogos = useDialogos();
  const pergunta = useRef<string | null>(null);
  const bloqueio = useBlocker(
    ({ historyAction, currentLocation, nextLocation }) =>
      !!aviso &&
      historyAction === "POP" &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (
      bloqueio.state !== "blocked" ||
      pergunta.current === bloqueio.location.key
    )
      return;
    pergunta.current = bloqueio.location.key;
    void dialogos
      .confirmar(aviso ?? "Deseja sair desta tela?")
      .then((aceitou) => {
        if (aceitou) bloqueio.proceed();
        else bloqueio.reset();
        pergunta.current = null;
      });
  }, [bloqueio, aviso, dialogos]);

  useEffect(() => {
    if (!aviso) return;
    const confirmar = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmar);
    return () => window.removeEventListener("beforeunload", confirmar);
  }, [aviso]);
}
