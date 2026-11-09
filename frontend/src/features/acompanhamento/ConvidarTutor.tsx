import { useState, type SubmitEvent } from 'react';
import {
  buscarTutoresDisponiveis,
  areasTutor,
  criarConvite,
  type TutorDisponivel,
} from './apiAcompanhamento';

import './ConvidarTutor.css';

type Props = {
  espacoId: number;
};

export default function ConvidarTutor({ espacoId }: Props) {
  const [busca, setBusca] = useState('');
  const [buscaFeita, setBuscaFeita] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [tutores, setTutores] = useState<TutorDisponivel[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [convidandoId, setConvidandoId] = useState<number | string | null>(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function handleBuscar(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (buscando || convidandoId !== null) return;

    setErro('');
    setMensagem('');
    setTutores([]);

    if (busca.trim().length < 2) {
      setErro('Digite pelo menos dois caracteres.');
      return;
    }

    setBuscando(true);

    try {
      const resultado = await buscarTutoresDisponiveis(busca);
      setTutores(resultado);
      setBuscaFeita(true);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível pesquisar os tutores.'
      );
    } finally {
      setBuscando(false);
    }
  }

  async function handleConvidar(tutorId: number | string) {
    if (convidandoId !== null || buscando) return;

    setConvidandoId(tutorId);
    setErro('');
    setMensagem('');

    try {
      await criarConvite(espacoId, tutorId);

      setTutores((atuais) =>
        atuais.filter((tutor) => tutor.id !== tutorId)
      );

      setMensagem('Convite enviado. O acesso será liberado após o aceite.');
      setUsuario('');
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar o convite.'
      );
    } finally {
      setConvidandoId(null);
    }
  }

  return (
    <section className="convite-tutor">
      <p>Pesquise tutores públicos pelo nome de apresentação ou pela área.</p>

      <form className="convite-tutor__busca" onSubmit={handleBuscar}>
        <input
          type="search"
          value={busca}
          onChange={(event) => { setBusca(event.target.value); setBuscaFeita(false); }}
          placeholder="Nome ou área de proficiência"
          maxLength={100}
          aria-label="Pesquisar tutor"
          disabled={buscando || convidandoId !== null}
        />

        <button
          type="submit"
          disabled={buscando || convidandoId !== null}
        >
          {buscando ? 'Pesquisando...' : 'Pesquisar'}
        </button>
      </form>

      {erro && <p role="alert">{erro}</p>}
      {mensagem && <p role="status">{mensagem}</p>}

      {tutores.length > 0 && (
        <ul className="convite-tutor__resultados" aria-label="Tutores encontrados">
          {tutores.map((tutor) => (
            <li className="convite-tutor__cartao" key={tutor.id}>
              <h3>{tutor.nome_apresentacao}</h3>
              {tutor.area && <span className="convite-tutor__area">{areasTutor[tutor.area]}</span>}
              {tutor.descricao && <p className="convite-tutor__descricao">{tutor.descricao}</p>}
              {tutor.formacoes.length > 0 && <section className="convite-tutor__formacoes">
                <h4>Formação e cursos</h4>
                <ul>
                  {tutor.formacoes.map((formacao, indice) => <li key={indice}>
                    <strong>{formacao.titulo}</strong>
                    {formacao.instituicao && <span>{formacao.instituicao}</span>}
                    {/^https?:\/\//i.test(formacao.link_comprovante) && <a href={formacao.link_comprovante}
                      target="_blank" rel="noreferrer">Ver diploma ou certificado</a>}
                  </li>)}
                </ul>
              </section>}

              <button
                type="button"
                className="convite-tutor__convidar"
                disabled={convidandoId !== null || buscando}
                onClick={() => handleConvidar(tutor.id)}
              >
                {convidandoId === tutor.id
                  ? 'Enviando...'
                  : 'Convidar'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!buscando &&
        buscaFeita &&
        tutores.length === 0 &&
        !erro &&
        !mensagem && (
          <p>Nenhum tutor encontrado.</p>
        )}

      <details className="convite-tutor__direto">
        <summary>Convidar pelo nome de usuário</summary>
        <form onSubmit={event => {
          event.preventDefault();
          if (usuario.trim()) void handleConvidar(usuario.trim());
        }}>
          <label>Nome de usuário exato
            <input value={usuario} onChange={event => setUsuario(event.target.value)} maxLength={150} required />
          </label>
          <button type="submit" disabled={buscando || convidandoId !== null}>Enviar convite</button>
        </form>
      </details>
    </section>
  );
}
