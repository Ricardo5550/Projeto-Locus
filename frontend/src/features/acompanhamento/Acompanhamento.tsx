import { useEffect, useState, type SubmitEvent } from 'react';
import ConvidarTutor from './ConvidarTutor';
import CompartilharMateriais from './CompartilharMateriais';
import PerfilTutor from './PerfilTutor';
import VisualizarAnotacaoCompartilhada from './VisualizarAnotacaoCompartilhada';
import {
  listarMeusEspacos,
  listarEspacosComoTutor,
  criarEspaco,
  listarMateriaisEspaco,
  listarConvitesRecebidos,
  aceitarConvite,
  recusarConvite,
  listarTutoresEspaco,
  removerTutorEspaco,
  type EspacoAcompanhamento,
  type EspacoParticipando,
  type MateriaisEspaco,
  type ConviteRecebido,
  type TutorEspaco,
} from './apiAcompanhamento';
import './Acompanhamento.css';

export default function Acompanhamento() {
  const [mostrarPerfilTutor, setMostrarPerfilTutor] = useState(false);

  const [meusEspacos, setMeusEspacos] =
    useState<EspacoAcompanhamento[]>([]);

  const [participando, setParticipando] =
    useState<EspacoParticipando[]>([]);

  const [convites, setConvites] =
    useState<ConviteRecebido[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [nomeEspaco, setNomeEspaco] = useState('');
  const [criando, setCriando] = useState(false);
  const [erroCriacao, setErroCriacao] = useState('');

  const [espacoSelecionado, setEspacoSelecionado] =
    useState<number | null>(null);

  const [materiais, setMateriais] =
    useState<MateriaisEspaco | null>(null);

  const [versaoMateriais, setVersaoMateriais] = useState(0);

  const [carregandoMateriais, setCarregandoMateriais] =
    useState(false);

  const [erroMateriais, setErroMateriais] = useState('');

  const [anotacaoVisualizadaId, setAnotacaoVisualizadaId] =
    useState<number | null>(null);

  const [processandoConvite, setProcessandoConvite] =
    useState<number | null>(null);

  const [erroConvites, setErroConvites] = useState('');

  const [tutores, setTutores] = useState<TutorEspaco[]>([]);

  const [carregandoTutores, setCarregandoTutores] =
    useState(false);

  const [erroTutores, setErroTutores] = useState('');

  const [removendoTutorId, setRemovendoTutorId] =
    useState<number | null>(null);

  const [erroRemocaoTutor, setErroRemocaoTutor] = useState('');

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
        if (ativo) {
          setCarregando(false);
        }
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
        if (ativo) {
          setMateriais(dados);
        }
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
        if (ativo) {
          setCarregandoMateriais(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [espacoSelecionado, versaoMateriais]);

  useEffect(() => {
    let ativo = true;

    setTutores([]);
    setErroTutores('');
    setErroRemocaoTutor('');

    if (
      espacoSelecionado === null ||
      !ehProprietarioDoEspaco
    ) {
      setCarregandoTutores(false);
      return;
    }

    setCarregandoTutores(true);

    listarTutoresEspaco(espacoSelecionado)
      .then((dados) => {
        if (ativo) {
          setTutores(dados);
        }
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
        if (ativo) {
          setCarregandoTutores(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [espacoSelecionado, ehProprietarioDoEspaco]);

  function selecionarEspaco(espacoId: number) {
    setAnotacaoVisualizadaId(null);
    setEspacoSelecionado(espacoId);
  }

  async function handleCriarEspaco(
    event: SubmitEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const nome = nomeEspaco.trim();

    if (!nome || nome.length > 100 || criando) {
      return;
    }

    setCriando(true);
    setErroCriacao('');

    try {
      const novoEspaco = await criarEspaco(nome);

      setMeusEspacos((atuais) => [
        novoEspaco,
        ...atuais,
      ]);

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
    if (processandoConvite !== null) {
      return;
    }

    setProcessandoConvite(conviteId);
    setErroConvites('');

    try {
      if (acao === 'aceitar') {
        await aceitarConvite(conviteId);
      } else {
        await recusarConvite(conviteId);
      }

      setConvites((atuais) =>
        atuais.filter(
          (convite) => convite.id !== conviteId
        )
      );

      if (acao === 'aceitar') {
        try {
          const atualizados =
            await listarEspacosComoTutor();

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

  async function handleRemoverTutor(tutorId: number) {
    if (
      espacoSelecionado === null ||
      !ehProprietarioDoEspaco ||
      removendoTutorId !== null
    ) {
      return;
    }

    const confirmado = window.confirm(
      'Tem certeza de que deseja remover este tutor do espaço?'
    );

    if (!confirmado) {
      return;
    }

    const espacoId = espacoSelecionado;

    setRemovendoTutorId(tutorId);
    setErroRemocaoTutor('');

    try {
      await removerTutorEspaco(espacoId, tutorId);

      setTutores((atuais) =>
        atuais.filter(
          (tutor) => tutor.tutor_id !== tutorId
        )
      );
    } catch (error) {
      setErroRemocaoTutor(
        error instanceof Error
          ? error.message
          : 'Não foi possível remover o tutor.'
      );
    } finally {
      setRemovendoTutorId(null);
    }
  }

  if (carregando) {
    return (
      <section className="acompanhamento-page">
        <p role="status">
          Carregando acompanhamento...
        </p>
      </section>
    );
  }

  if (erro) {
    return (
      <section className="acompanhamento-page">
        <p role="alert">{erro}</p>
      </section>
    );
  }

  if (mostrarPerfilTutor) {
    return (
      <div className="perfil-tutor-visualizacao">
        <button
          type="button"
          className="perfil-tutor-voltar"
          onClick={() => setMostrarPerfilTutor(false)}
        >
          ← Voltar ao acompanhamento
        </button>

        <PerfilTutor />
      </div>
    );
  }

  return (
    <section className="acompanhamento-page">
      <button
        type="button"
        className="acompanhamento-abrir-perfil"
        onClick={() => setMostrarPerfilTutor(true)}
      >
        Meu perfil de tutor
      </button>

      <h2>Criar espaço de acompanhamento</h2>

      <form onSubmit={handleCriarEspaco}>
        <input
          type="text"
          value={nomeEspaco}
          onChange={(event) =>
            setNomeEspaco(event.target.value)
          }
          placeholder="Nome do espaço"
          maxLength={100}
          required
          aria-label="Nome do espaço"
        />

        <button
          type="submit"
          disabled={criando}
        >
          {criando ? 'Criando...' : 'Criar espaço'}
        </button>
      </form>

      {erroCriacao && (
        <p role="alert">
          {erroCriacao}
        </p>
      )}

      <h2>Meus espaços</h2>

      {meusEspacos.length === 0 ? (
        <p>
          Você ainda não criou espaços de acompanhamento.
        </p>
      ) : (
        <ul>
          {meusEspacos.map((espaco) => (
            <li key={espaco.id}>
              <button
                type="button"
                onClick={() =>
                  selecionarEspaco(espaco.id)
                }
                aria-pressed={
                  espacoSelecionado === espaco.id
                }
              >
                {espaco.nome}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Espaços que acompanho</h2>

      {participando.length === 0 ? (
        <p>
          Você ainda não participa de nenhum espaço.
        </p>
      ) : (
        <ul>
          {participando.map((espaco) => (
            <li key={espaco.id}>
              <button
                type="button"
                onClick={() =>
                  selecionarEspaco(espaco.id)
                }
                aria-pressed={
                  espacoSelecionado === espaco.id
                }
              >
                {espaco.nome}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Convites recebidos</h2>

      {convites.length === 0 ? (
        <p>
          Você não possui convites pendentes.
        </p>
      ) : (
        <ul>
          {convites.map((convite) => (
            <li key={convite.id}>
              <p>
                Espaço: {convite.espaco_nome}
              </p>

              <button
                type="button"
                disabled={processandoConvite !== null}
                onClick={() =>
                  handleResponderConvite(
                    convite.id,
                    'aceitar'
                  )
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
                  handleResponderConvite(
                    convite.id,
                    'recusar'
                  )
                }
              >
                Recusar
              </button>
            </li>
          ))}
        </ul>
      )}

      {erroConvites && (
        <p role="alert">
          {erroConvites}
        </p>
      )}

      {espacoSelecionado !== null && (
        <section>
          {ehProprietarioDoEspaco && (
            <>
              <div className="acompanhamento-convite-aprimorado">
                <ConvidarTutor
                  key={`convidar-${espacoSelecionado}`}
                  espacoId={espacoSelecionado}
                />
              </div>

              <CompartilharMateriais
                key={`compartilhar-${espacoSelecionado}`}
                espacoId={espacoSelecionado}
                onCompartilhado={() =>
                  setVersaoMateriais(
                    (atual) => atual + 1
                  )
                }
              />

              <h2>Tutores do espaço</h2>

              {carregandoTutores && (
                <p role="status">
                  Carregando tutores...
                </p>
              )}

              {erroTutores && (
                <p role="alert">
                  {erroTutores}
                </p>
              )}

              {erroRemocaoTutor && (
                <p role="alert">
                  {erroRemocaoTutor}
                </p>
              )}

              {!carregandoTutores &&
                !erroTutores &&
                (
                  tutores.length === 0 ? (
                    <p>
                      Este espaço ainda não possui tutores ativos.
                    </p>
                  ) : (
                    <ul>
                      {tutores.map((tutor) => (
                        <li key={tutor.participacao_id}>
                          <span>
                            {tutor.nome_apresentacao}
                          </span>

                          <button
                            type="button"
                            disabled={removendoTutorId !== null}
                            onClick={() =>
                              handleRemoverTutor(
                                tutor.tutor_id
                              )
                            }
                          >
                            {removendoTutorId === tutor.tutor_id
                              ? 'Removendo...'
                              : 'Remover tutor'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                )}
            </>
          )}

          <h2>Materiais compartilhados</h2>

          {carregandoMateriais && (
            <p role="status">
              Carregando materiais...
            </p>
          )}

          {erroMateriais && (
            <p role="alert">
              {erroMateriais}
            </p>
          )}

          {materiais && (
            <>
              <h3>Anotações</h3>

              {materiais.anotacoes.length === 0 ? (
                <p>
                  Nenhuma anotação compartilhada.
                </p>
              ) : (
                <ul>
                  {materiais.anotacoes.map((anotacao) => (
                    <li
                      key={anotacao.id}
                      className="acompanhamento-material-item"
                    >
                      <span className="acompanhamento-material-titulo">
                        {anotacao.titulo}
                      </span>

                      <button
                        type="button"
                        className="acompanhamento-material-visualizar"
                        onClick={() =>
                          setAnotacaoVisualizadaId(
                            anotacao.id
                          )
                        }
                      >
                        Visualizar
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {anotacaoVisualizadaId !== null && (
                <VisualizarAnotacaoCompartilhada
                  key={anotacaoVisualizadaId}
                  anotacaoId={anotacaoVisualizadaId}
                  onFechar={() =>
                    setAnotacaoVisualizadaId(null)
                  }
                />
              )}

              <h3>Mapas mentais</h3>

              {materiais.mapas.length === 0 ? (
                <p>
                  Nenhum mapa mental compartilhado.
                </p>
              ) : (
                <ul>
                  {materiais.mapas.map((mapa) => (
                    <li
                      key={mapa.id}
                      className="acompanhamento-material-item"
                    >
                      <span className="acompanhamento-material-titulo">
                        {mapa.titulo}
                      </span>
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