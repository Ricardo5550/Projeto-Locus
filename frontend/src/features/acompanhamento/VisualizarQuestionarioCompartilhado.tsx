import { useEffect, useState } from "react";
import Paginacao from "../../components/Paginacao";
import {
  obterQuestionarioCompartilhado,
  type QuestionarioCompartilhadoDetalhe,
} from "./apiAcompanhamento";

const POR_PAGINA = 5;

export default function VisualizarQuestionarioCompartilhado({
  id,
  espacoId,
}: {
  id: string;
  espacoId: string;
}) {
  const [questionario, setQuestionario] = useState<QuestionarioCompartilhadoDetalhe | null>(null);
  const [erro, setErro] = useState("");
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    let ativo = true;
    obterQuestionarioCompartilhado(espacoId, id)
      .then((dados) => {
        if (ativo) setQuestionario(dados);
      })
      .catch((e: Error) => {
        if (ativo) setErro(e.message);
      });
    return () => {
      ativo = false;
    };
  }, [espacoId, id]);

  if (erro) return <p role="alert">{erro}</p>;
  if (!questionario) return <p role="status">Carregando questionário…</p>;

  const inicio = (pagina - 1) * POR_PAGINA;
  return (
    <section aria-label="Questionário em modo de leitura">
      <p>
        Versão atual do questionário, somente para leitura e comentários.
        As revisões e os resultados continuam individuais.
      </p>
      {!questionario.perguntas.length && <p>Este questionário ainda não possui perguntas disponíveis.</p>}
      {questionario.perguntas.slice(inicio, inicio + POR_PAGINA).map((pergunta, indice) => (
        <article className="acompanhamento-card" key={pergunta.id}>
          <h3>Questão {inicio + indice + 1} · {pergunta.tipo === "alternativa" ? "Alternativa" : "Dissertativa"}</h3>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{pergunta.enunciado}</p>
          {pergunta.tipo === "alternativa" ? (
            <ol type="A">
              {pergunta.alternativas.map((texto, opcao) => (
                <li key={opcao} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {texto}{opcao === pergunta.alternativa_correta && <strong> — Correta</strong>}
                </li>
              ))}
            </ol>
          ) : (
            <>
              <strong>Resposta:</strong>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{pergunta.resposta}</p>
            </>
          )}
        </article>
      ))}
      <Paginacao
        pagina={pagina}
        total={Math.ceil(questionario.perguntas.length / POR_PAGINA)}
        onChange={setPagina}
      />
    </section>
  );
}
