import { useEffect, useState } from 'react';
import {
  listarQuestionarios,
  obterResultados,
  type DadosResultados,
  type QuestionarioSalvo,
} from './apiRevisoes';
import './Questionarios.css';

const pct = (acertos: number, total: number) =>
  total ? (100 * acertos) / total : 0;

export default function Resultados() {
  const [questionarios, setQuestionarios] = useState<QuestionarioSalvo[]>([]);
  const [questionario, setQuestionario] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [dados, setDados] = useState<DadosResultados | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarQuestionarios()
      .then(setQuestionarios)
      .catch(e => setErro(e.message));
  }, []);

  useEffect(() => {
    let ativo = true;

    setDados(null);
    setErro('');

    const params = new URLSearchParams({ agrupamento: 'questionario' });

    if (questionario) params.set('questionario', questionario);
    if (inicio) params.set('inicio', inicio);
    if (fim) params.set('fim', fim);

    obterResultados(params)
      .then(resultado => {
        if (ativo) setDados(resultado);
      })
      .catch(e => {
        if (ativo) setErro(e.message);
      });

    return () => {
      ativo = false;
    };
  }, [questionario, inicio, fim]);

  const linha = dados?.linha ?? [];
  const tempo = (data: string) => new Date(`${data}T12:00:00Z`).getTime();

  function x(data: string) {
    if (linha.length < 2) return 300;

    const primeiroDia = tempo(linha[0].data);
    const ultimoDia = tempo(linha[linha.length - 1].data);

    return 40 + ((tempo(data) - primeiroDia) / (ultimoDia - primeiroDia)) * 520;
  }

  return (
    <section className="revisoes">
      <h2>Resultados do estudo</h2>

      <p>
        Desempenho informado por você nas revisões finalizadas. Parciais são
        exibidas separadamente e não contam como acertos completos. Treinos
        livres não entram nestes gráficos.
      </p>

      <div className="revisoes-filtros resultados-filtros">
        <label>
          Questionário
          <select
            value={questionario}
            onChange={e => setQuestionario(e.target.value)}
          >
            <option value="">Todos os questionários</option>
            {questionarios.map(item => (
              <option key={item.id} value={item.id}>
                {item.titulo}
              </option>
            ))}
          </select>
        </label>

        <label>
          De
          <input
            type="date"
            value={inicio}
            onChange={e => setInicio(e.target.value)}
          />
        </label>

        <label>
          Até
          <input
            type="date"
            value={fim}
            min={inicio}
            onChange={e => setFim(e.target.value)}
          />
        </label>
      </div>

      {erro && <p role="alert">{erro}</p>}
      {!dados && !erro && <p role="status">Carregando resultados...</p>}

      {dados && (
        <>
          <div className="resultados-indicadores">
            {[
              ['Para hoje', dados.hoje],
              ['Atrasadas', dados.atrasadas],
              ['Revisões concluídas', dados.sessoes],
              [
                'Acertos',
                dados.total
                  ? `${pct(dados.acertos, dados.total).toFixed(1)}%`
                  : 'Sem dados',
              ],
            ].map(([nome, valor]) => (
              <article key={nome}>
                <span>{nome}</span>
                <strong>{valor}</strong>
              </article>
            ))}
          </div>

          <p>
            Concluídas e acertos respeitam o período. Pendências mostram a
            situação atual do questionário selecionado.
          </p>

          <article>
            <h3>Acertos por questionário</h3>

            {dados.barras.length === 0 ? (
              <p>Sem dados no período selecionado.</p>
            ) : (
              dados.barras.map(barra => {
                const percentual = pct(barra.acertos, barra.total);
                const percentualFormatado = percentual.toFixed(1);
                const erros = barra.total - barra.acertos - barra.parciais;

                return (
                  <div className="resultado-barra" key={barra.id ?? 'sem'}>
                    <span>{barra.nome}</span>

                    <div
                      role="img"
                      aria-label={`${barra.nome}: ${percentualFormatado}% de acertos, ${barra.total} respostas`}
                    >
                      <i style={{ width: `${percentual}%` }} />
                    </div>

                    <strong>{percentualFormatado}%</strong>
                    <small>
                      {barra.acertos} acertos · {barra.parciais} parciais ·{' '}
                      {erros} erros
                    </small>
                  </div>
                );
              })
            )}
          </article>

          <article>
            <h3>
              Evolução dos acertos
              {questionario
                ? ` — ${questionarios.find(item => String(item.id) === questionario)?.titulo ?? ''}`
                : ''}
            </h3>

            {linha.length === 0 ? (
              <p>Sem dados no período selecionado.</p>
            ) : (
              <>
                <svg
                  className="resultado-linha"
                  viewBox="0 0 600 250"
                  role="img"
                  aria-label="Evolução diária da porcentagem de acertos"
                >
                  <title>Acertos completos por dia de revisão</title>

                  {[0, 25, 50, 75, 100].map(valor => (
                    <g key={valor}>
                      <line
                        x1={40}
                        x2={560}
                        y1={210 - valor * 1.7}
                        y2={210 - valor * 1.7}
                        stroke="#ded5ca"
                      />
                      <text x={3} y={214 - valor * 1.7} fontSize="11">
                        {valor}%
                      </text>
                    </g>
                  ))}

                  <polyline
                    points={linha
                      .map(ponto => {
                        const y = 210 - pct(ponto.acertos, ponto.total) * 1.7;
                        return `${x(ponto.data)},${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#5e402b"
                    strokeWidth={3}
                  />

                  {linha.map(ponto => (
                    <circle
                      key={ponto.data}
                      cx={x(ponto.data)}
                      cy={210 - pct(ponto.acertos, ponto.total) * 1.7}
                      r={5}
                      fill="#5e402b"
                    >
                      <title>
                        {ponto.data}: {pct(ponto.acertos, ponto.total).toFixed(1)}%
                        {' — '}{ponto.acertos}/{ponto.total}
                      </title>
                    </circle>
                  ))}

                  <text x={40} y={240} fontSize="11">
                    {linha[0].data}
                  </text>
                  <text x={560} y={240} textAnchor="end" fontSize="11">
                    {linha[linha.length - 1].data}
                  </text>
                </svg>

                <p>
                  O gráfico liga os dias em que houve revisão. Nos dias sem
                  revisão, não há valor registrado.
                </p>
              </>
            )}
          </article>
        </>
      )}
    </section>
  );
}