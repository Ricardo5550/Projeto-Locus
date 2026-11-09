import { useEffect, useState, type SubmitEvent } from 'react';
import { ErroApi } from '../../services/apiClient';
import {
  obterMeuPerfilTutor,
  areasTutor,
  criarPerfilTutor,
  atualizarPerfilTutor,
  type DadosPerfilTutor,
  type FormacaoTutor,
} from './apiAcompanhamento';
import './PerfilTutor.css';

const dadosIniciais: DadosPerfilTutor = {
  nome_apresentacao: '',
  descricao: '',
  area: '',
  formacoes: [],
  visibilidade: 'privado',
  ativo: true,
};

export default function PerfilTutor({ onSalvo }: { onSalvo: () => void }) {
  const [dados, setDados] = useState<DadosPerfilTutor>(
    dadosIniciais
  );

  const [possuiPerfil, setPossuiPerfil] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;

    async function carregarPerfil() {
      try {
        const perfil = await obterMeuPerfilTutor();

        if (!ativo) return;

        setDados({
          nome_apresentacao: perfil.nome_apresentacao,
          descricao: perfil.descricao ?? '',
          area: perfil.area ?? '',
          formacoes: perfil.formacoes,
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

    setErro('');
  }

  function atualizarFormacao(indice: number, campo: keyof FormacaoTutor, valor: string) {
    atualizarCampo('formacoes', dados.formacoes.map((formacao, posicao) =>
      posicao === indice ? { ...formacao, [campo]: valor } : formacao
    ));
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

    const dadosEnviar: DadosPerfilTutor = {
      ...dados,
      nome_apresentacao: nome,
      descricao: dados.descricao.trim(),
      formacoes: dados.formacoes.map(formacao => ({
        titulo: formacao.titulo.trim(),
        instituicao: formacao.instituicao.trim(),
        link_comprovante: formacao.link_comprovante.trim(),
      })),
    };

    try {
      if (possuiPerfil) {
        await atualizarPerfilTutor(dadosEnviar);
      } else {
        await criarPerfilTutor(dadosEnviar);
      }
      onSalvo();
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
        <h2>{possuiPerfil ? 'Meu perfil de tutor' : 'Tornar-se tutor'}</h2>

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
            maxLength={1000}
            rows={5}
          />
        </div>

        <div className="perfil-tutor-campo">
          <label htmlFor="tutor-area">Área de proficiência</label>
          <select id="tutor-area" value={dados.area}
            onChange={event => atualizarCampo('area', event.target.value as DadosPerfilTutor['area'])}>
            <option value="">Selecionar área</option>
            {Object.entries(areasTutor).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </div>

        <section className="perfil-tutor-formacoes" aria-labelledby="tutor-formacoes">
          <h3 id="tutor-formacoes">Formação e cursos (opcional)</h3>
          <p>Adicione uma entrada para cada formação ou curso que quiser exibir no seu perfil.</p>
          {dados.formacoes.map((formacao, indice) => (
            <fieldset className="perfil-tutor-formacao" key={indice} disabled={salvando}>
              <legend>Formação ou curso {indice + 1}</legend>
              <div className="perfil-tutor-campo">
                <label htmlFor={`tutor-formacao-${indice}`}>Nome da formação ou curso</label>
                <input id={`tutor-formacao-${indice}`} value={formacao.titulo} maxLength={200} required
                  onChange={event => atualizarFormacao(indice, 'titulo', event.target.value)} />
              </div>
              <div className="perfil-tutor-campo">
                <label htmlFor={`tutor-instituicao-${indice}`}>Instituição (opcional)</label>
                <input id={`tutor-instituicao-${indice}`} value={formacao.instituicao} maxLength={200}
                  onChange={event => atualizarFormacao(indice, 'instituicao', event.target.value)} />
              </div>
              <div className="perfil-tutor-campo">
                <label htmlFor={`tutor-link-${indice}`}>Link do diploma ou certificado (opcional)</label>
                <input id={`tutor-link-${indice}`} type="url" value={formacao.link_comprovante} maxLength={500}
                  onChange={event => atualizarFormacao(indice, 'link_comprovante', event.target.value)} />
              </div>
              <button type="button" className="perfil-tutor-acao-secundaria" aria-label={`Remover formação ou curso ${indice + 1}`}
                onClick={() => atualizarCampo('formacoes', dados.formacoes.filter((_, posicao) => posicao !== indice))}>
                Remover
              </button>
            </fieldset>
          ))}
          <button type="button" className="perfil-tutor-acao-secundaria" disabled={salvando || dados.formacoes.length >= 20}
            onClick={() => atualizarCampo('formacoes', [...dados.formacoes, { titulo: '', instituicao: '', link_comprovante: '' }])}>
            Adicionar formação ou curso
          </button>
          {dados.formacoes.length >= 20 && <p>Limite de 20 entradas atingido.</p>}
        </section>

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
            Perfis públicos aparecem na pesquisa quando ativos. Para convidar um perfil privado, o estudante precisa saber o nome de usuário exato.
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