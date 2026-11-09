import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import CompartilharMateriais from './CompartilharMateriais';
import ConvidarTutor from './ConvidarTutor';
import ConversaEspaco from './ConversaEspaco';
import MaterialEspaco from './MaterialEspaco';
import {
  listarMateriaisEspaco, listarTutoresEspaco, removerTutorEspaco,
  type EspacoAcompanhamento, type MateriaisEspaco, type MaterialSelecionado, type TutorEspaco,
} from './apiAcompanhamento';

export default function DetalheEspaco({ espaco, proprietario, material, abaInicial = 'duvidas', onAbrirMaterial }: {
  espaco: EspacoAcompanhamento;
  proprietario: boolean;
  material?: MaterialSelecionado;
  abaInicial?: 'duvidas' | 'materiais';
  onAbrirMaterial: (material: MaterialSelecionado) => void;
}) {
  const [aba, setAba] = useState<'duvidas' | 'materiais' | 'tutores'>(abaInicial);
  const [modal, setModal] = useState<'convite' | 'compartilhar' | null>(null);
  const [materiais, setMateriais] = useState<MateriaisEspaco | null>(null);
  const [tutores, setTutores] = useState<TutorEspaco[] | null>(null);
  const [atualizacao, setAtualizacao] = useState(0);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState('');
  const [erroRemover, setErroRemover] = useState('');

  useEffect(() => {
    let ativo = true;
    setErro('');
    const falhou = (erro: Error) => { if (ativo) setErro(erro.message); };
    if (aba === 'materiais') {
      listarMateriaisEspaco(espaco.id).then(dados => { if (ativo) setMateriais(dados); }).catch(falhou);
    } else if (aba === 'tutores' && proprietario) {
      listarTutoresEspaco(espaco.id).then(dados => { if (ativo) setTutores(dados); }).catch(falhou);
    }
    return () => { ativo = false; };
  }, [aba, atualizacao, espaco.id, proprietario]);

  async function remover(id: number) {
    if (removendo || !window.confirm('Remover este tutor do canal?')) return;
    setRemovendo(true);
    setErroRemover('');
    try {
      await removerTutorEspaco(espaco.id, id);
      setTutores(atuais => atuais?.filter(tutor => tutor.tutor_id !== id) ?? null);
    } catch (erro) {
      setErroRemover(erro instanceof Error ? erro.message : 'Não foi possível remover o tutor.');
    } finally {
      setRemovendo(false);
    }
  }

  if (material) {
    return <MaterialEspaco key={`${material.tipo}-${material.id}`} espacoId={espaco.id} material={material} />;
  }

  return <section className="acompanhamento-page">
    <h2>{espaco.nome}</h2>
    <nav className="acompanhamento-acoes" aria-label="Seções do canal">
      <button type="button" aria-pressed={aba === 'duvidas'} onClick={() => setAba('duvidas')}>Dúvidas</button>
      <button type="button" aria-pressed={aba === 'materiais'} onClick={() => setAba('materiais')}>Materiais compartilhados</button>
      {proprietario && <button type="button" aria-pressed={aba === 'tutores'} onClick={() => setAba('tutores')}>Tutores</button>}
    </nav>

    {erro && <p role="alert">{erro} <button type="button" onClick={() => setAtualizacao(n => n + 1)}>Tentar novamente</button></p>}

    {aba === 'duvidas' && <ConversaEspaco espacoId={espaco.id} podePublicar={proprietario} />}

    {aba === 'materiais' && <>
      {proprietario && <button type="button" className="is-primary" onClick={() => setModal('compartilhar')}>Compartilhar material</button>}
      {!materiais && !erro && <p role="status">Carregando materiais…</p>}
      {materiais && (['anotacao', 'mapa'] as const).map(tipo => {
        const itens = tipo === 'anotacao' ? materiais.anotacoes : materiais.mapas;
        return <section key={tipo}>
          <h3>{tipo === 'anotacao' ? 'Anotações' : 'Mapas mentais'}</h3>
          {itens.length ? <div className="acompanhamento-grade">
            {itens.map(item => <article key={item.id} className="acompanhamento-card">
              <h4>{item.titulo}</h4>
              <button type="button" onClick={() => onAbrirMaterial({ ...item, tipo })}>Visualizar</button>
            </article>)}
          </div> : <p>Nenhum material compartilhado nesta categoria.</p>}
        </section>;
      })}
    </>}

    {aba === 'tutores' && proprietario && <>
      <button type="button" className="is-primary" onClick={() => setModal('convite')}>Convidar tutor</button>
      {!tutores && !erro && <p role="status">Carregando tutores…</p>}
      {tutores?.length === 0 && <p>Nenhum vínculo com tutor atualmente.</p>}
      {erroRemover && <p role="alert">{erroRemover}</p>}
      {tutores?.map(tutor => <article className="acompanhamento-card acompanhamento-acoes" key={tutor.participacao_id}>
        <strong>{tutor.nome_apresentacao}</strong>
        <button type="button" disabled={removendo} onClick={() => void remover(tutor.tutor_id)}>Remover tutor</button>
      </article>)}
    </>}

    {modal && <Modal title={modal === 'convite' ? 'Convidar tutor' : 'Compartilhar material'} onClose={() => setModal(null)}
      actions={<button type="button" onClick={() => setModal(null)}>Fechar</button>}>
      {modal === 'convite' ? <ConvidarTutor espacoId={espaco.id} /> :
        <CompartilharMateriais espacoId={espaco.id} onCompartilhado={() => setAtualizacao(n => n + 1)} />}
    </Modal>}
  </section>;
}
