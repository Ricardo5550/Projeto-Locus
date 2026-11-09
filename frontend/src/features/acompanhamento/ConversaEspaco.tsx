import { useEffect, useState, type SubmitEvent } from 'react';
import Modal from '../../components/Modal';
import {
  editarComentario, excluirComentario, listarMensagens, publicarMensagem, type MaterialSelecionado, type MensagemAcompanhamento,
} from './apiAcompanhamento';

export default function ConversaEspaco({ espacoId, podePublicar, material }: {
  espacoId: number;
  podePublicar: boolean;
  material?: MaterialSelecionado;
}) {
  const [mensagens, setMensagens] = useState<MensagemAcompanhamento[] | null>(null);
  const [texto, setTexto] = useState('');
  const [respondendo, setRespondendo] = useState<number | undefined>();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [erroEnvio, setErroEnvio] = useState('');
  const [atualizacao, setAtualizacao] = useState(0);
  const [acaoComentario, setAcaoComentario] = useState<{ tipo: 'editar' | 'excluir'; id: number } | null>(null);
  const [textoEdicao, setTextoEdicao] = useState('');
  const [erroComentario, setErroComentario] = useState('');

  useEffect(() => {
    let ativo = true;
    setErro('');
    listarMensagens(espacoId, material)
      .then(dados => { if (ativo) setMensagens(dados); })
      .catch((erro: Error) => { if (ativo) setErro(erro.message); });
    return () => { ativo = false; };
  }, [espacoId, material, atualizacao]);

  async function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando || !texto.trim()) return;
    setEnviando(true);
    setErroEnvio('');
    try {
      await publicarMensagem(espacoId, texto.trim(), respondendo, material);
      setTexto('');
      setRespondendo(undefined);
      setAtualizacao(n => n + 1);
    } catch (erro) {
      setErroEnvio(erro instanceof Error ? erro.message : 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarComentario(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!material || !acaoComentario || enviando) return;
    if (acaoComentario.tipo === 'editar' && !textoEdicao.trim()) return;
    setEnviando(true);
    setErroComentario('');
    try {
      if (acaoComentario.tipo === 'editar') {
        await editarComentario(espacoId, material, acaoComentario.id, textoEdicao.trim());
      } else {
        await excluirComentario(espacoId, material, acaoComentario.id);
        if (respondendo === acaoComentario.id) {
          setRespondendo(undefined);
          setTexto('');
          setErroEnvio('');
        }
      }
      setAcaoComentario(null);
      setAtualizacao(n => n + 1);
    } catch (erro) {
      setErroComentario(erro instanceof Error ? erro.message : 'Não foi possível alterar o comentário.');
    } finally {
      setEnviando(false);
    }
  }

  function abrirAcaoComentario(tipo: 'editar' | 'excluir', mensagem: MensagemAcompanhamento) {
    setAcaoComentario({ tipo, id: mensagem.id });
    setTextoEdicao(mensagem.texto);
    setErroComentario('');
  }

  function formulario() {
    const rotulo = respondendo ? 'Sua resposta' : material ? 'Seu comentário' : 'Sua dúvida';
    return <form className="acompanhamento-card acompanhamento-formulario" onSubmit={enviar}>
      <label>{rotulo}
        <textarea value={texto} onChange={e => setTexto(e.target.value)} maxLength={2000} rows={3}
          required disabled={enviando} />
      </label>
      <div className="acompanhamento-acoes">
        <button type="submit" className="is-primary" disabled={enviando || !texto.trim()}>
          {respondendo ? 'Enviar resposta' : material ? 'Publicar comentário' : 'Publicar dúvida'}
        </button>
        {respondendo && <button type="button" disabled={enviando}
          onClick={() => { setRespondendo(undefined); setTexto(''); setErroEnvio(''); }}>Cancelar resposta</button>}
      </div>
      {erroEnvio && <p role="alert">{erroEnvio}</p>}
    </form>;
  }

  function exibir(mensagem: MensagemAcompanhamento) {
    if (!mensagem.texto) return <p>Comentário excluído.</p>;
    return <>
      <strong>{mensagem.autor_nome}</strong>{' '}
      <time dateTime={mensagem.criada_em}>{new Date(mensagem.criada_em).toLocaleString('pt-BR')}</time>
      <p className="acompanhamento-mensagem">{mensagem.texto}</p>
      {material && mensagem.pode_gerenciar && !erro && <div className="acompanhamento-acoes">
        <button type="button" disabled={enviando} onClick={() => abrirAcaoComentario('editar', mensagem)}>Editar</button>
        <button type="button" className="is-danger" disabled={enviando}
          onClick={() => abrirAcaoComentario('excluir', mensagem)}>Excluir</button>
      </div>}
    </>;
  }

  const respostas = new Map<number, MensagemAcompanhamento[]>();
  for (const mensagem of mensagens ?? []) {
    if (mensagem.resposta_a === null) continue;
    const grupo = respostas.get(mensagem.resposta_a) ?? [];
    grupo.push(mensagem);
    respostas.set(mensagem.resposta_a, grupo);
  }

  return <section aria-label={material ? 'Comentários' : 'Dúvidas'}>
    {material && <h3>Comentários</h3>}
    {erro && <p role="alert">{erro} <button type="button" onClick={() => setAtualizacao(n => n + 1)}>Tentar novamente</button></p>}
    {!mensagens && !erro && <p role="status">Carregando mensagens…</p>}
    {mensagens?.length === 0 && <p>{material ? 'Nenhum comentário ainda.' : 'Nenhuma dúvida publicada neste canal.'}</p>}
    {!erro && mensagens && podePublicar && !respondendo && formulario()}
    {mensagens?.filter(mensagem => mensagem.resposta_a === null).map(mensagem => (
      <article className="acompanhamento-card" key={mensagem.id}>
        {exibir(mensagem)}
        {respostas.get(mensagem.id)?.map(resposta =>
          <div className="acompanhamento-resposta" key={resposta.id}>{exibir(resposta)}</div>)}
        {!erro && mensagem.texto && (respondendo === mensagem.id ? formulario() :
          <button type="button" disabled={enviando} onClick={() => {
            setRespondendo(mensagem.id);
            setTexto('');
            setErroEnvio('');
          }}>Responder</button>)}
      </article>
    ))}
    {acaoComentario && <Modal title={acaoComentario.tipo === 'editar' ? 'Editar comentário' : 'Excluir comentário'}
      onClose={() => setAcaoComentario(null)} busy={enviando} actions={
        <div className="acompanhamento-acoes">
          <button type="submit" form="acao-comentario" disabled={enviando}
            className={acaoComentario.tipo === 'excluir' ? 'is-danger' : 'is-primary'}>
            {acaoComentario.tipo === 'editar' ? 'Salvar alterações' : 'Excluir comentário'}
          </button>
          <button type="button" onClick={() => setAcaoComentario(null)} disabled={enviando}>Cancelar</button>
        </div>
      }>
      <form id="acao-comentario" onSubmit={confirmarComentario}>
        {acaoComentario.tipo === 'editar' ? <label>Seu comentário
          <textarea value={textoEdicao} onChange={e => setTextoEdicao(e.target.value)} maxLength={2000}
            rows={3} required disabled={enviando} />
        </label> : <p>Confirma a exclusão deste comentário? As respostas serão mantidas.</p>}
      </form>
      {erroComentario && <p role="alert">{erroComentario}</p>}
    </Modal>}
  </section>;
}
