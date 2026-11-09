import { useEffect, useImperativeHandle, useState, type Ref, type SubmitEvent } from 'react';
import Modal from '../../components/Modal';
import DetalheEspaco from './DetalheEspaco';
import PerfilTutor from './PerfilTutor';
import {
  aceitarConvite, criarEspaco, excluirCanal, listarConvitesRecebidos, listarEspacosComoTutor,
  listarMeusEspacos, obterMeuPerfilTutor, recusarConvite, renomearCanal,
  type ConviteRecebido, type EspacoAcompanhamento, type MaterialSelecionado,
} from './apiAcompanhamento';
import { ErroApi } from '../../services/apiClient';
import './Acompanhamento.css';

type Tela = { tipo: 'lista' | 'perfil' } |
  { tipo: 'espaco'; espaco: EspacoAcompanhamento; proprietario: boolean; material?: MaterialSelecionado; abaInicial?: 'duvidas' | 'materiais' };

type AcaoCanal = { tipo: 'criar' } | { tipo: 'editar' | 'excluir'; canal: EspacoAcompanhamento };

const titulosCanal = { criar: 'Criar canal', editar: 'Editar canal', excluir: 'Excluir canal' };

export type NavegacaoAcompanhamento = { voltar: () => void };

export default function Acompanhamento({ ref, onDetalheChange, avisoCanal }: {
  ref?: Ref<NavegacaoAcompanhamento>;
  onDetalheChange: (aberto: boolean) => void;
  avisoCanal?: { id: number; aba: 'duvidas' | 'materiais' };
}) {
  const [tela, setTela] = useState<Tela>({ tipo: 'lista' });
  const [meus, setMeus] = useState<EspacoAcompanhamento[]>([]);
  const [comoTutor, setComoTutor] = useState<EspacoAcompanhamento[]>([]);
  const [convites, setConvites] = useState<ConviteRecebido[]>([]);
  const [perfilExiste, setPerfilExiste] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [tentarNovamente, setTentarNovamente] = useState(0);
  const [acaoCanal, setAcaoCanal] = useState<AcaoCanal | null>(null);
  const [nome, setNome] = useState('');
  const [salvandoCanal, setSalvandoCanal] = useState(false);
  const [erroCanal, setErroCanal] = useState('');
  const [canalIndisponivel, setCanalIndisponivel] = useState(false);
  const [mensagemPerfil, setMensagemPerfil] = useState('');
  const [respondendo, setRespondendo] = useState(false);
  const [erroConvite, setErroConvite] = useState('');
  const emDetalhe = tela.tipo !== 'lista';

  useEffect(() => {
    onDetalheChange(emDetalhe);
    return () => onDetalheChange(false);
  }, [emDetalhe, onDetalheChange]);

  useImperativeHandle(ref, () => ({
    voltar() {
      if (tela.tipo === 'espaco' && tela.material) {
        setTela({ ...tela, material: undefined });
      } else {
        setTela({ tipo: 'lista' });
      }
    },
  }));

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    const perfil = obterMeuPerfilTutor().then(() => true).catch(erro => {
      if (erro instanceof ErroApi && erro.status === 404) return false;
      throw erro;
    });
    Promise.all([listarMeusEspacos(), listarEspacosComoTutor(), listarConvitesRecebidos(), perfil])
      .then(([espacos, acompanhados, recebidos, temPerfil]) => {
        if (!ativo) return;
        setMeus(espacos);
        setComoTutor(acompanhados);
        setConvites(recebidos);
        setPerfilExiste(temPerfil);
        if (avisoCanal) {
          const canalProprio = espacos.find(canal => canal.id === avisoCanal.id);
          const canal = canalProprio ?? acompanhados.find(canal => canal.id === avisoCanal.id);
          setCanalIndisponivel(!canal);
          if (canal) setTela({
            tipo: 'espaco', espaco: canal, proprietario: !!canalProprio, abaInicial: avisoCanal.aba,
          });
        }
      })
      .catch((erro: Error) => { if (ativo) setErro(erro.message); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [tentarNovamente, avisoCanal]);

  function abrirAcaoCanal(acao: AcaoCanal) {
    setNome(acao.tipo === 'criar' ? '' : acao.canal.nome);
    setErroCanal('');
    setAcaoCanal(acao);
  }

  async function confirmarAcaoCanal(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!acaoCanal || salvandoCanal || (acaoCanal.tipo !== 'excluir' && !nome.trim())) return;
    setSalvandoCanal(true);
    setErroCanal('');
    try {
      if (acaoCanal.tipo === 'criar') {
        const canal = await criarEspaco(nome.trim());
        setMeus(atuais => [canal, ...atuais]);
        setTela({ tipo: 'espaco', espaco: canal, proprietario: true });
      } else if (acaoCanal.tipo === 'editar') {
        const canal = await renomearCanal(acaoCanal.canal.id, nome.trim());
        setMeus(atuais => atuais.map(item => item.id === canal.id ? canal : item));
      } else {
        await excluirCanal(acaoCanal.canal.id);
        setMeus(atuais => atuais.filter(item => item.id !== acaoCanal.canal.id));
      }
      setAcaoCanal(null);
    } catch (erro) {
      setErroCanal(erro instanceof Error ? erro.message : 'Não foi possível concluir a ação.');
    } finally {
      setSalvandoCanal(false);
    }
  }

  async function responder(id: number, aceitar: boolean) {
    if (respondendo) return;
    setRespondendo(true);
    setErroConvite('');
    try {
      await (aceitar ? aceitarConvite(id) : recusarConvite(id));
      setConvites(atuais => atuais.filter(convite => convite.id !== id));
      if (aceitar) setComoTutor(await listarEspacosComoTutor());
    } catch (erro) {
      setErroConvite(erro instanceof Error ? erro.message : 'Não foi possível atualizar os convites.');
    } finally {
      setRespondendo(false);
    }
  }

  function listarEspacos(espacos: EspacoAcompanhamento[], proprietario: boolean) {
    return <div className="acompanhamento-grade">
      {espacos.map(espaco => (
        <article className="acompanhamento-card" key={espaco.id}>
          <h3>{espaco.nome}</h3>
          <div className="acompanhamento-acoes">
            <button type="button" onClick={() => setTela({ tipo: 'espaco', espaco, proprietario })}>Abrir</button>
            {proprietario && <>
              <button type="button" onClick={() => abrirAcaoCanal({ tipo: 'editar', canal: espaco })}>Editar</button>
              <button type="button" className="is-danger"
                onClick={() => abrirAcaoCanal({ tipo: 'excluir', canal: espaco })}>Excluir</button>
            </>}
          </div>
        </article>
      ))}
    </div>;
  }

  if (tela.tipo === 'perfil') {
    return <PerfilTutor onSalvo={() => {
      setPerfilExiste(true);
      setMensagemPerfil('Perfil de tutor salvo.');
      setTela(atual => atual.tipo === 'perfil' ? { tipo: 'lista' } : atual);
    }} />;
  }

  if (tela.tipo === 'espaco') {
    return <DetalheEspaco key={tela.espaco.id} espaco={tela.espaco} proprietario={tela.proprietario}
      material={tela.material} abaInicial={tela.abaInicial} onAbrirMaterial={material => setTela({ ...tela, material })} />;
  }

  return <section className="acompanhamento-page" aria-label="Acompanhamento">
    <div className="acompanhamento-acoes acompanhamento-titulo">
      <h2>Meus canais</h2>
      <div className="acompanhamento-acoes">
        <button type="button" className="is-primary" disabled={carregando || !!erro}
          onClick={() => abrirAcaoCanal({ tipo: 'criar' })}>Criar canal</button>
        {perfilExiste !== null && <button type="button" onClick={() => { setMensagemPerfil(''); setTela({ tipo: 'perfil' }); }}>
          {perfilExiste ? 'Meu perfil de tutor' : 'Tornar-se tutor'}
        </button>}
      </div>
    </div>
    {canalIndisponivel && <p role="status">O canal desta notificação não está mais disponível.</p>}
    {mensagemPerfil && <p role="status">{mensagemPerfil}</p>}
    {carregando && <p role="status">Carregando acompanhamento…</p>}
    {erro && <p role="alert">{erro} <button type="button" onClick={() => setTentarNovamente(n => n + 1)}>Tentar novamente</button></p>}
    {!carregando && !erro && <>
      {meus.length ? listarEspacos(meus, true) : <p>Nenhum vínculo com tutor atualmente. Crie um canal para convidar um tutor.</p>}
      {(perfilExiste || comoTutor.length > 0 || convites.length > 0) && <>
        <h2>Canais que acompanho</h2>
        {comoTutor.length ? listarEspacos(comoTutor, false) : <p>Você ainda não acompanha estudantes.</p>}
        <h2>Convites recebidos</h2>
        {erroConvite && <p role="alert">{erroConvite}</p>}
        {convites.length === 0 ? <p>Nenhum convite pendente.</p> : <div className="acompanhamento-grade">
          {convites.map(convite => <article className="acompanhamento-card" key={convite.id}>
            <h3>{convite.espaco_nome}</h3>
            <div className="acompanhamento-acoes">
              <button type="button" disabled={respondendo} onClick={() => void responder(convite.id, true)}>Aceitar</button>
              <button type="button" disabled={respondendo} onClick={() => void responder(convite.id, false)}>Recusar</button>
            </div>
          </article>)}
        </div>}
      </>}
    </>}
    {acaoCanal && <Modal title={titulosCanal[acaoCanal.tipo]} onClose={() => setAcaoCanal(null)} busy={salvandoCanal} actions={
      <div className="acompanhamento-acoes">
        <button type="submit" form="acao-canal-acompanhamento" disabled={salvandoCanal}
          className={acaoCanal.tipo === 'excluir' ? 'is-danger' : 'is-primary'}>
          {acaoCanal.tipo === 'editar' ? 'Salvar alterações' : titulosCanal[acaoCanal.tipo]}
        </button>
        <button type="button" onClick={() => setAcaoCanal(null)} disabled={salvandoCanal}>Cancelar</button>
      </div>
    }>
      <form id="acao-canal-acompanhamento" onSubmit={confirmarAcaoCanal}>
        {acaoCanal.tipo === 'excluir' ? <p>
          Excluir <strong>{acaoCanal.canal.nome}</strong> apaga as conversas e encerra o acesso dos tutores.
          As anotações e os mapas originais continuam na sua biblioteca.
        </p> : <>
          {acaoCanal.tipo === 'criar' && <p>Apenas você e os tutores que aceitarem seu convite terão acesso ao canal.</p>}
          <label>Nome do canal<input value={nome} onChange={e => setNome(e.target.value)}
            required maxLength={100} disabled={salvandoCanal} /></label>
        </>}
      </form>
      {erroCanal && <p role="alert">{erroCanal}</p>}
    </Modal>}
  </section>;
}
