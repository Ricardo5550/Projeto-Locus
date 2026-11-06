import { useState, type SubmitEvent } from 'react';
import {
  buscarTutoresDisponiveis,
  criarConvite,
  type TutorDisponivel,
} from './apiAcompanhamento';

type Props = {
  espacoId: number;
};

export default function ConvidarTutor({ espacoId }: Props) {
  const [busca, setBusca] = useState('');
  const [tutores, setTutores] = useState<TutorDisponivel[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [convidandoId, setConvidandoId] = useState<number | null>(null);
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

  async function handleConvidar(tutorId: number) {
    if (convidandoId !== null || buscando) return;

    setConvidandoId(tutorId);
    setErro('');
    setMensagem('');

    try {
      await criarConvite(espacoId, tutorId);

      setTutores((atuais) =>
        atuais.filter((tutor) => tutor.id !== tutorId)
      );

      setMensagem('Convite enviado com sucesso.');
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
    <section>
      <h2>Convidar tutor</h2>

      <form onSubmit={handleBuscar}>
        <input
          type="search"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Pesquisar tutor pelo nome"
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
        <ul>
          {tutores.map((tutor) => (
            <li key={tutor.id}>
              <span>{tutor.nome_apresentacao}</span>

              <button
                type="button"
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
        busca.trim().length >= 2 &&
        tutores.length === 0 &&
        !erro &&
        !mensagem && (
          <p>Nenhum tutor encontrado.</p>
        )}
    </section>
  );
}