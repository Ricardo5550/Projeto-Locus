import { useEffect, useState, type SubmitEvent } from 'react';
import { ErroApi } from '../../services/apiClient';
import {
  obterMeuPerfilTutor,
  criarPerfilTutor,
  atualizarPerfilTutor,
  type DadosPerfilTutor,
} from './apiAcompanhamento';
import './PerfilTutor.css';

const dadosIniciais: DadosPerfilTutor = {
  nome_apresentacao: '',
  descricao: '',
  visibilidade: 'privado',
  ativo: false,
};

export default function PerfilTutor() {
  const [dados, setDados] = useState<DadosPerfilTutor>(
    dadosIniciais
  );

  const [possuiPerfil, setPossuiPerfil] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    let ativo = true;

    async function carregarPerfil() {
      try {
        const perfil = await obterMeuPerfilTutor();

        if (!ativo) return;

        setDados({
          nome_apresentacao: perfil.nome_apresentacao,
          descricao: perfil.descricao ?? '',
          visibilidade: perfil.visibilidade,
          ativo: perfil.ativo,
        });

        setPossuiPerfil(true);
      } catch (error) {
        if (!ativo) return;

        if (error instanceof ErroApi && error.status === 404) {
          setPossuiPerfil(false);
        } else {
          setErro(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar o perfil de tutor.'
          );
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregarPerfil();

    return () => {
      ativo = false;
    };
  }, []);

  function atualizarCampo<K extends keyof DadosPerfilTutor>(
    campo: K,
    valor: DadosPerfilTutor[K]
  ) {
    setDados((atual) => ({
      ...atual,
      [campo]: valor,
    }));

    setMensagem('');
    setErro('');
  }

  async function salvarPerfil(
    event: SubmitEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (salvando) return;

    const nome = dados.nome_apresentacao.trim();

    if (!nome) {
      setErro('Informe um nome de apresentação.');
      return;
    }

    setSalvando(true);
    setErro('');
    setMensagem('');

    const dadosEnviar: DadosPerfilTutor = {
      ...dados,
      nome_apresentacao: nome,
      descricao: dados.descricao.trim(),
    };

    try {
      const perfil = possuiPerfil
        ? await atualizarPerfilTutor(dadosEnviar)
        : await criarPerfilTutor(dadosEnviar);

      setDados({
        nome_apresentacao: perfil.nome_apresentacao,
        descricao: perfil.descricao ?? '',
        visibilidade: perfil.visibilidade,
        ativo: perfil.ativo,
      });

      setPossuiPerfil(true);

      setMensagem(
        possuiPerfil
          ? 'Perfil de tutor atualizado com sucesso.'
          : 'Perfil de tutor criado com sucesso.'
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o perfil de tutor.'
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <section className="perfil-tutor-page">
        <p role="status">Carregando perfil de tutor...</p>
      </section>
    );
  }

  return (
    <section className="perfil-tutor-page">
      <header className="perfil-tutor-header">
        <h2>Meu perfil de tutor</h2>

        <p>
          Configure como seu perfil será apresentado
          aos estudantes do Locus.
        </p>
      </header>

      {erro && (
        <p className="perfil-tutor-erro" role="alert">
          {erro}
        </p>
      )}

      {mensagem && (
        <p className="perfil-tutor-sucesso" role="status">
          {mensagem}
        </p>
      )}

      <form
        className="perfil-tutor-form"
        onSubmit={salvarPerfil}
      >
        <div className="perfil-tutor-campo">
          <label htmlFor="tutor-nome">
            Nome de apresentação
          </label>

          <input
            id="tutor-nome"
            type="text"
            value={dados.nome_apresentacao}
            onChange={(event) =>
              atualizarCampo(
                'nome_apresentacao',
                event.target.value
              )
            }
            placeholder="Ex.: Tutor de Matemática"
            maxLength={100}
            required
          />
        </div>

        <div className="perfil-tutor-campo">
          <label htmlFor="tutor-descricao">
            Descrição
          </label>

          <textarea
            id="tutor-descricao"
            value={dados.descricao}
            onChange={(event) =>
              atualizarCampo(
                'descricao',
                event.target.value
              )
            }
            placeholder="Conte um pouco sobre sua experiência e suas áreas de conhecimento."
            rows={5}
          />
        </div>

        <div className="perfil-tutor-campo">
          <label htmlFor="tutor-visibilidade">
            Visibilidade do perfil
          </label>

          <select
            id="tutor-visibilidade"
            value={dados.visibilidade}
            onChange={(event) =>
              atualizarCampo(
                'visibilidade',
                event.target.value as 'publico' | 'privado'
              )
            }
          >
            <option value="privado">
              Privado
            </option>

            <option value="publico">
              Público
            </option>
          </select>

          <small>
            Perfis públicos e ativos podem aparecer
            na pesquisa de tutores do Locus.
          </small>
        </div>

        <div className="perfil-tutor-disponibilidade">
          <label htmlFor="tutor-ativo">
            <input
              id="tutor-ativo"
              type="checkbox"
              checked={dados.ativo}
              onChange={(event) =>
                atualizarCampo(
                  'ativo',
                  event.target.checked
                )
              }
            />

            <span>
              Perfil ativo
            </span>
          </label>

          <p>
            Ative esta opção para disponibilizar
            seu perfil para acompanhamento.
          </p>
        </div>

        <div className="perfil-tutor-acoes">
          <button
            type="submit"
            disabled={salvando}
          >
            {salvando
              ? 'Salvando...'
              : possuiPerfil
                ? 'Salvar alterações'
                : 'Criar perfil'}
          </button>
        </div>
      </form>
    </section>
  );
}