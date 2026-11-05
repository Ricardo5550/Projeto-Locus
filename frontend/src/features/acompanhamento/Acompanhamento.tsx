import { useEffect, useState, type SubmitEvent } from 'react';

import {
  listarMeusEspacos,
  listarEspacosComoTutor,
  criarEspaco,
  listarMateriaisEspaco,
  listarConvitesRecebidos,
  aceitarConvite,
  recusarConvite,
  listarTutoresEspaco,
  type EspacoAcompanhamento,
  type EspacoParticipando,
  type MateriaisEspaco,
  type ConviteRecebido,
  type TutorEspaco,
} from './apiAcompanhamento';

export default function Acompanhamento() {
  const [meusEspacos, setMeusEspacos] = useState<EspacoAcompanhamento[]>([]);
  const [participando, setParticipando] = useState<EspacoParticipando[]>([]);
  const [convites, setConvites] = useState<ConviteRecebido[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [nomeEspaco, setNomeEspaco] = useState('');
  const [criando, setCriando] = useState(false);
  const [erroCriacao, setErroCriacao] = useState('');

  const [espacoSelecionado, setEspacoSelecionado] = useState<number | null>(null);
  const [materiais, setMateriais] = useState<MateriaisEspaco | null>(null);
  const [carregandoMateriais, setCarregandoMateriais] = useState(false);
  const [erroMateriais, setErroMateriais] = useState('');

  const [processandoConvite, setProcessandoConvite] = useState<number | null>(null);
  const [erroConvites, setErroConvites] = useState('');

  const [tutores, setTutores] = useState<TutorEspaco[]>([]);
  const [carregandoTutores, setCarregandoTutores] = useState(false);
  const [erroTutores, setErroTutores] = useState('');

  const ehProprietarioDoEspaco = meusEspacos.some(
    (espaco) => espaco.id === espacoSelecionado
  );

  useEffect(() => {
    let ativo = true;

    Promise.all([
      listarMeusEspacos(),
      listarEspacosComoTutor(),
      listarConvitesRecebidos(),
    ])
      .then(([meus, outros, recebidos]) => {
        if (!ativo) return;

        setMeusEspacos(meus);
        setParticipando(outros);
        setConvites(recebidos);
      })
      .catch((error) => {
        if (ativo) {
          setErro(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar o acompanhamento.'
          );
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (espacoSelecionado === null) {
      setMateriais(null);
      return;
    }

    let ativo = true;

    setCarregandoMateriais(true);
    setMateriais(null);
    setErroMateriais('');

    listarMateriaisEspaco(espacoSelecionado)
      .then((dados) => {
        if (ativo) setMateriais(dados);
      })
      .catch((error) => {
        if (ativo) {
          setErroMateriais(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar os materiais.'
          );
        }
      })
      .finally(() => {
        if (ativo) setCarregandoMateriais(false);
      });

    return () => {
      ativo = false;
    };
  }, [espacoSelecionado]);

  useEffect(() => {
    let ativo = true;

    setTutores([]);
    setErroTutores('');

    if (espacoSelecionado === null || !ehProprietarioDoEspaco) {
      setCarregandoTutores(false);
      return;
    }

    setCarregandoTutores(true);

    listarTutoresEspaco(espacoSelecionado)
      .then((dados) => {
        if (ativo) setTutores(dados);
      })
      .catch((error) => {
        if (ativo) {
          setErroTutores(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar os tutores.'
          );
        }
      })
      .finally(() => {
        if (ativo) setCarregandoTutores(false);
      });

    return () => {
      ativo = false;
    };
  }, [espacoSelecionado, ehProprietarioDoEspaco]);

  async function handleCriarEspaco(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const nome = nomeEspaco.trim();
    if (!nome || nome.length > 100 || criando) return;

    setCriando(true);
    setErroCriacao('');

    try {
      const novoEspaco = await criarEspaco(nome);
      setMeusEspacos((atuais) => [novoEspaco, ...atuais]);
      setNomeEspaco('');
    } catch (error) {
      setErroCriacao(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar o espaço.'
      );
    } finally {
      setCriando(false);
    }
  }

  async function handleResponderConvite(
    conviteId: number,
    acao: 'aceitar' | 'recusar'
  ) {
    if (processandoConvite !== null) return;

    setProcessandoConvite(conviteId);
    setErroConvites('');

    try {
      if (acao === 'aceitar') {
        await aceitarConvite(conviteId);
      } else {
        await recusarConvite(conviteId);
      }

      setConvites((atuais) =>
        atuais.filter((convite) => convite.id !== conviteId)
      );

      if (acao === 'aceitar') {
        try {
          const atualizados = await listarEspacosComoTutor();
          setParticipando(atualizados);
        } catch {
          setErroConvites(
            'Convite aceito, mas não foi possível atualizar os espaços.'
          );
        }
      }
    } catch (error) {
      setErroConvites(
        error instanceof Error
          ? error.message
          : 'Não foi possível responder ao convite.'
      );
    } finally {
      setProcessandoConvite(null);
    }
  }

  if (carregando) {
    return <p>Carregando acompanhamento...</p>;
  }

  if (erro) {
    return <p role="alert">{erro}</p>;
  }

  return (
    <section>
      <h2>Criar espaço de acompanhamento</h2>

      <form onSubmit={handleCriarEspaco}>
        <input
          type="text"
          value={nomeEspaco}
          onChange={(event) => setNomeEspaco(event.target.value)}
          placeholder="Nome do espaço"
          maxLength={100}
          required
          aria-label="Nome do espaço"
        />

        <button type="submit" disabled={criando}>
          {criando ? 'Criando...' : 'Criar espaço'}
        </button>
      </form>

      {erroCriacao && <p role="alert">{erroCriacao}</p>}

      <h2>Meus espaços</h2>

      {meusEspacos.length === 0 ? (
        <p>Você ainda não criou espaços de acompanhamento.</p>
      ) : (
        <ul>
          {meusEspacos.map((espaco) => (
            <li key={espaco.id}>
              <button
                type="button"
                onClick={() => setEspacoSelecionado(espaco.id)}
              >
                {espaco.nome}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Espaços que acompanho</h2>

      {participando.length === 0 ? (
        <p>Você ainda não participa de nenhum espaço.</p>
      ) : (
        <ul>
          {participando.map((espaco) => (
            <li key={espaco.id}>
              <button
                type="button"
                onClick={() => setEspacoSelecionado(espaco.id)}
              >
                {espaco.nome}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Convites recebidos</h2>

      {convites.length === 0 ? (
        <p>Você não possui convites pendentes.</p>
      ) : (
        <ul>
          {convites.map((convite) => (
            <li key={convite.id}>
              <p>Espaço: {convite.espaco_nome}</p>

              <button
                type="button"
                disabled={processandoConvite !== null}
                onClick={() =>
                  handleResponderConvite(convite.id, 'aceitar')
                }
              >
                {processandoConvite === convite.id
                  ? 'Processando...'
                  : 'Aceitar'}
              </button>

              <button
                type="button"
                disabled={processandoConvite !== null}
                onClick={() =>
                  handleResponderConvite(convite.id, 'recusar')
                }
              >
                Recusar
              </button>
            </li>
          ))}
        </ul>
      )}

      {erroConvites && <p role="alert">{erroConvites}</p>}

      {espacoSelecionado !== null && (
        <section>
          {ehProprietarioDoEspaco && (
            <>
              <h2>Tutores do espaço</h2>

              {carregandoTutores && <p>Carregando tutores...</p>}
              {erroTutores && <p role="alert">{erroTutores}</p>}

              {!carregandoTutores && !erroTutores && (
                tutores.length === 0 ? (
                  <p>Este espaço ainda não possui tutores ativos.</p>
                ) : (
                  <ul>
                    {tutores.map((tutor) => (
                      <li key={tutor.participacao_id}>
                        {tutor.nome_apresentacao}
                      </li>
                    ))}
                  </ul>
                )
              )}
            </>
          )}

          <h2>Materiais compartilhados</h2>

          {carregandoMateriais && <p>Carregando materiais...</p>}
          {erroMateriais && <p role="alert">{erroMateriais}</p>}

          {materiais && (
            <>
              <h3>Anotações</h3>

              {materiais.anotacoes.length === 0 ? (
                <p>Nenhuma anotação compartilhada.</p>
              ) : (
                <ul>
                  {materiais.anotacoes.map((anotacao) => (
                    <li key={anotacao.id}>
                      {anotacao.titulo}
                    </li>
                  ))}
                </ul>
              )}

              <h3>Mapas mentais</h3>

              {materiais.mapas.length === 0 ? (
                <p>Nenhum mapa mental compartilhado.</p>
              ) : (
                <ul>
                  {materiais.mapas.map((mapa) => (
                    <li key={mapa.id}>
                      {mapa.titulo}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}