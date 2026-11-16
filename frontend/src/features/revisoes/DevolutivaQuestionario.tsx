import { useEffect, useRef } from "react";
import type { Devolutiva, QuestionarioSalvo } from "./apiRevisoes";
import { ORDEM_RESULTADOS, CLASSIFICACOES } from "./classificacoes";
type Props = {
  devolutiva: Devolutiva;
  atual: QuestionarioSalvo;
  onOpenNote?: (id: string, titulo: string, questionario: string) => void;
};
export default function DevolutivaQuestionario({
  devolutiva,
  atual,
  onOpenNote,
}: Props) {
  const tituloDevolutiva = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    tituloDevolutiva.current?.focus();
  }, []);
  return (
    <section aria-label="Devolutiva">
      <h2 ref={tituloDevolutiva} tabIndex={-1}>
        {devolutiva.treino ? "Resultado do treino" : "Última devolutiva"}
      </h2>
      <p>
        {new Date(devolutiva.data_criacao).toLocaleString("pt-BR")} ·{" "}
        {devolutiva.acertos} acertos · {devolutiva.parciais} parciais ·{" "}
        {devolutiva.total - devolutiva.acertos - devolutiva.parciais} erros
      </p>
      <p>
        Pontuação: {devolutiva.pontuacao.toFixed(1)}% · Avaliação do
        agendamento: {devolutiva.qualidade}/5
      </p>
      {devolutiva.versao !== atual.versao && (
        <p>O conteúdo foi alterado depois desta sessão.</p>
      )}
      {ORDEM_RESULTADOS.map((tipo) =>
        devolutiva.respostas
          .filter((r) => r.resultado === tipo)
          .map((r) => (
            <article key={r.pergunta} className={`devolutiva-${tipo}`}>
              <h3>
                {CLASSIFICACOES[tipo]} — {r.enunciado}
              </h3>
              <p>Sua resposta: {r.resposta_digitada || "Não informada"}</p>
              <p>Resposta esperada: {r.resposta}</p>
              {tipo !== "acertei" &&
                r.anotacao !== null &&
                (r.anotacao_disponivel ? (
                  <button
                    onClick={() =>
                      onOpenNote?.(r.anotacao!, r.titulo_anotacao, atual.id)
                    }
                  >
                    Ver anotação
                  </button>
                ) : (
                  <p>Anotação indisponível</p>
                ))}
            </article>
          )),
      )}
    </section>
  );
}
