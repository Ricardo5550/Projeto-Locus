import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import Modal from '../../components/Modal';
import Paginacao from '../../components/Paginacao';
import { useListaPaginada } from '../../services/useListaPaginada';
import * as api from './apiRevisoes';
import './Questionarios.css';
const AVISO = 'Salvar esta alteração reiniciará o agendamento das revisões. Seu histórico será preservado.';
const dataBr = (d:string|null) => d ? new Date(`${d.slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR') : 'Ainda não estudado';
function hoje(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
type Formulario =
 | {modo:'questionario'; id:number; titulo:string; limite:string}
 | {modo:'perguntas'; id:number; destinos:api.QuestionarioSalvo[]};
const ORDEM_RESULTADOS = ['errei','parcial','acertei'] as const;
const CLASSIFICACOES = {errei:'Errei', parcial:'Parcial', acertei:'Acertei'} as const;
export type NavegacaoQuestionario = {voltar: () => void};
type Props = {ref?:Ref<NavegacaoQuestionario>; initialId?:number|null; initialDevolutiva?:boolean; onOpenNote?:(id:number,title:string,questionario:number)=>void; onSessionChange?:(active:boolean)=>void; onDetalheChange?:(aberto:boolean)=>void};
export default function Questionario({ref,initialId=null,initialDevolutiva=false,onOpenNote,onSessionChange,onDetalheChange}:Props){
 const [atual,setAtual]=useState<api.QuestionarioSalvo|null>(null),[perguntas,setPerguntas]=useState<api.PerguntaEstudo[]>([]),[devolutiva,setDevolutiva]=useState<api.Devolutiva|null>(null);
 const [erro,setErro]=useState(''),[busy,setBusy]=useState(false),[busca,setBusca]=useState(''),[situacao,setSituacao]=useState('');
 const [form,setForm]=useState<Formulario|null>(null),[ajuda,setAjuda]=useState(false);
 const [edit,setEdit]=useState<api.PerguntaEstudo|null>(null),[manter,setManter]=useState(false);
 const [destino,setDestino]=useState<number|null>(null);
 const [mostrarDevolutiva,setMostrarDevolutiva]=useState(false);
 const tituloDevolutiva = useRef<HTMLHeadingElement>(null);
 useEffect(() => {
   if (mostrarDevolutiva) tituloDevolutiva.current?.focus();
 }, [mostrarDevolutiva]);
 const [sessao,setSessao]=useState<{chave:string;versao:number;treino:boolean}|null>(null),[respostas,setRespostas]=useState<Record<number,{texto:string;resultado?:api.Classificacao;revelada:boolean}>>({});
 const [pagina,setPagina]=useState(1);
 const filtros = new URLSearchParams({pagina:String(pagina)});
 if (busca.trim()) filtros.set('busca', busca.trim());
 if (situacao) filtros.set('situacao', situacao);
 const lista = useListaPaginada<api.QuestionarioSalvo>(atual ? null : `/questionarios/paginados/?${filtros}`);

 async function abrir(id:number, verDevolutiva=false, sinal?:AbortSignal) {
   setErro('');
   setBusy(true);
   try {
     const [q,p,d] = await Promise.all([api.obterQuestionario(id),api.perguntasQuestionario(id),api.obterDevolutiva(id)]);
     if (sinal?.aborted) return;
     setAtual(q);
     setPerguntas(p);
     setDevolutiva(d);
     setMostrarDevolutiva(verDevolutiva && !!d);
     setSessao(null);
     setRespostas({});
   } catch (e) {
     if (!sinal?.aborted) setErro(e instanceof Error ? e.message : 'Não foi possível abrir o questionário.');
   } finally {
     if (!sinal?.aborted) setBusy(false);
   }
 }
 useEffect(()=>{
   if (!initialId) return;
   const controle = new AbortController();
   void abrir(initialId, initialDevolutiva, controle.signal);
   return () => controle.abort();
 },[initialId,initialDevolutiva]);
 useEffect(()=>{onSessionChange?.(!!sessao);return()=>onSessionChange?.(false);},[sessao,onSessionChange]);
 useEffect(()=>{if(!sessao)return;const sair=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',sair);return()=>window.removeEventListener('beforeunload',sair);},[sessao]);
 async function executar(action:()=>Promise<void>){if(busy)return;setBusy(true);setErro('');try{await action();}catch(e){setErro(e instanceof Error?e.message:'Não foi possível concluir.');}finally{setBusy(false);}}
 function editarQuestionario(q:api.QuestionarioSalvo) {
   setErro('');
   setForm({modo:'questionario',id:q.id,titulo:q.titulo,limite:String(q.limite_dias??'')});
 }

 function selecionarPergunta(pergunta:api.PerguntaEstudo, questionarioId:number) {
   setErro('');
   setEdit(pergunta);
   setDestino(questionarioId);
   setManter(false);
 }

 async function editarPerguntas(id:number) {
   await executar(async () => {
     const questionarios = await api.listarQuestionarios();
     setForm({modo:'perguntas',id,destinos:questionarios.filter(q=>q.id!==id)});
     if (perguntas[0]) selecionarPergunta(perguntas[0], id);
   });
 }

 function fecharEdicao() {
   setForm(null);
   setEdit(null);
   setErro('');
 }

 const emDetalhe = atual !== null;
 useEffect(() => {
   onDetalheChange?.(emDetalhe);
   return () => onDetalheChange?.(false);
 }, [emDetalhe, onDetalheChange]);

 useImperativeHandle(ref, () => ({
   voltar() {
     if (busy || !atual) return;
     if (sessao && !window.confirm('Sair sem finalizar? Esta sessão não será contabilizada.')) return;
     setSessao(null);
     setMostrarDevolutiva(false);
     fecharEdicao();
     setAtual(null);
   },
 }));

 async function salvarPergunta() {
   if (form?.modo !== 'perguntas' || !edit || destino === null) return;
   const transferir = destino !== form.id;
   if (transferir && !window.confirm('Mover esta pergunta reiniciará o agendamento dos dois questionários. O histórico será preservado. Continuar?')) return;
   await executar(async () => {
     await api.atualizarPergunta(edit.id, {
       enunciado:edit.enunciado,
       resposta:edit.resposta,
       questionario:destino,
       manter_agendamento:manter && !transferir,
       confirmar_reinicio:true,
     });
     setEdit(null);
     lista.atualizar();
     window.dispatchEvent(new Event('revisoes:atualizadas'));
     await abrir(form.id);
   });
 }

 async function removerPergunta(id:number) {
   if (form?.modo !== 'perguntas' || !window.confirm('Remover a pergunta? O agendamento será reiniciado. O histórico será preservado.')) return;
   await executar(async () => {
     await api.excluirPergunta(id);
     lista.atualizar();
     window.dispatchEvent(new Event('revisoes:atualizadas'));
     await abrir(form.id);
   });
 }

 const treinoAutomatico = !!atual?.proxima_revisao && atual.proxima_revisao > hoje();
 function iniciar(treino:boolean) {
   if (!atual) return;
   setRespostas({});
   setSessao({chave:crypto.randomUUID(),versao:atual.versao,treino});
 }
 function mudar(id:number,valor:Partial<{texto:string;resultado:api.Classificacao;revelada:boolean}>) {
   if (!sessao) iniciar(treinoAutomatico);
   setRespostas(r=>({...r,[id]:{...(r[id]??{texto:'',revelada:false}),...valor}}));
 }
 async function finalizar() {
   if (!atual || !sessao || !completas) return;
   await executar(async () => {
     const d = await api.finalizarQuestionario(atual.id, {
       ...sessao,
       respostas: perguntas.map(p=>({
         pergunta:p.id,resposta_digitada:respostas[p.id].texto,resultado:respostas[p.id].resultado!,
       })),
     });
     setSessao(null);
     setRespostas({});
     setDevolutiva(d);
     setMostrarDevolutiva(true);
     lista.atualizar();
     window.dispatchEvent(new Event('revisoes:atualizadas'));
     setAtual(await api.obterQuestionario(atual.id));
   });
 }
 const completas=perguntas.length>0&&perguntas.every(p=>respostas[p.id]?.resultado);
 const visiveis=lista.dados?.itens ?? [];
 return <section className="revisoes" aria-label="Questionários">
  <div className="revisoes-titulo"><h2>{atual?atual.titulo:'Seus questionários'}</h2><button onClick={()=>setAjuda(true)}>Como marcamos a repetição do questionário?</button></div>
  {erro&&<p role="alert" className="revisoes-aviso">{erro}</p>}{busy&&<p role="status">Processando...</p>}
  {!atual?<>
   <div className="revisoes-filtros"><input aria-label="Buscar questionário" placeholder="Buscar questionário" value={busca} maxLength={150} onChange={e=>{setBusca(e.target.value);setPagina(1);}}/><select aria-label="Situação" value={situacao} onChange={e=>{setSituacao(e.target.value);setPagina(1);}}><option value="">Todos</option><option value="hoje">Para hoje</option><option value="atrasadas">Atrasados</option><option value="novos">Ainda não estudados</option></select></div>
   {lista.erro && <p role="alert" className="revisoes-aviso">{lista.erro} <button type="button" onClick={lista.atualizar}>Tentar novamente</button></p>}
   {lista.carregando && <p role="status">Carregando questionários...</p>}
   {!busy&&lista.dados&&!visiveis.length&&<p>Nenhum questionário encontrado. Crie uma pergunta em uma anotação para gerar um questionário automaticamente.</p>}
   <div className="revisoes-lista">{visiveis.map(q=><article key={q.id}><h3>{q.titulo}</h3><p>{q.total_perguntas} {q.total_perguntas === 1 ? 'pergunta' : 'perguntas'}</p><p>Próxima revisão: {dataBr(q.proxima_revisao)}</p><div className="revisoes-acoes"><button disabled={busy} onClick={()=>void abrir(q.id)}>Abrir</button><button disabled={busy} onClick={()=>editarQuestionario(q)}>Editar</button><button className="is-danger" disabled={busy} onClick={()=>{if(confirm('Excluir este questionário e seus resultados? As anotações serão preservadas.'))void executar(async()=>{await api.removerQuestionario(q.id);lista.atualizar();window.dispatchEvent(new Event('revisoes:atualizadas'));});}}>Excluir</button></div></article>)}</div>
   {lista.dados && <Paginacao pagina={lista.dados.pagina} total={lista.dados.total_paginas} disabled={busy} onChange={setPagina}/>}
  </>:mostrarDevolutiva && devolutiva ? <section aria-label="Devolutiva">
   <h2 ref={tituloDevolutiva} tabIndex={-1}>{devolutiva.treino?'Resultado do treino':'Última devolutiva'}</h2>
   <p>{new Date(devolutiva.data_criacao).toLocaleString('pt-BR')} · {devolutiva.acertos} acertos · {devolutiva.parciais} parciais · {devolutiva.total-devolutiva.acertos-devolutiva.parciais} erros</p>
   <p>Pontuação: {devolutiva.pontuacao.toFixed(1)}% · Avaliação do agendamento: {devolutiva.qualidade}/5</p>
   {devolutiva.versao!==atual.versao&&<p>O conteúdo foi alterado depois desta sessão.</p>}
   {ORDEM_RESULTADOS.map(tipo=>devolutiva.respostas.filter(r=>r.resultado===tipo).map(r=>
     <article key={r.pergunta} className={`devolutiva-${tipo}`}>
       <h3>{CLASSIFICACOES[tipo]} — {r.enunciado}</h3>
       <p>Sua resposta: {r.resposta_digitada||'Não informada'}</p>
       <p>Resposta esperada: {r.resposta}</p>
       {tipo!=='acertei'&&r.anotacao!==null&&(r.anotacao_disponivel
         ? <button onClick={()=>onOpenNote?.(r.anotacao!,r.titulo_anotacao,atual.id)}>Ver anotação</button>
         : <p>Anotação indisponível</p>)}
     </article>
   ))}
  </section>:<>
   <p>Próxima revisão: {dataBr(atual.proxima_revisao)} · {atual.limite_dias?`Limite: ${atual.limite_dias} dias`:'Sem limite máximo'}</p>
   {!sessao && <div className="revisoes-acoes">
     {devolutiva && <button type="button" disabled={busy || form?.modo==='perguntas'} onClick={()=>setMostrarDevolutiva(true)}>Ver devolutiva</button>}
     {form?.modo==='perguntas'
       ? <button type="button" disabled={busy} onClick={fecharEdicao}>Sair da edição</button>
       : <button type="button" disabled={busy} onClick={()=>void editarPerguntas(atual.id)}>Editar perguntas</button>}
   </div>}
   {form?.modo==='perguntas' ? <section aria-label="Edição das perguntas">
     {!perguntas.length && <p>Este questionário está sem perguntas.</p>}
     {perguntas.map((p,i)=><article key={p.id}>
       {edit?.id===p.id ?
         <form className="revisoes-edicao-form" aria-label={`Editar pergunta ${i+1}`} onSubmit={e=>{e.preventDefault();void salvarPergunta();}}>
           <div className="revisoes-acoes">
             <button className="is-primary" disabled={busy} type="submit">Salvar alterações</button>
             <button disabled={busy} type="button" onClick={()=>{setEdit(null);setErro('');}}>Cancelar</button>
           </div>

           <label>
             Pergunta
             <textarea aria-label="Pergunta" required maxLength={20000} disabled={busy} value={edit.enunciado}
               onChange={e=>setEdit({...edit,enunciado:e.target.value})}/>
           </label>
           <label>
             Resposta esperada
             <textarea aria-label="Resposta esperada" required maxLength={20000} disabled={busy} value={edit.resposta}
               onChange={e=>setEdit({...edit,resposta:e.target.value})}/>
           </label>

           <div className="revisoes-edicao-opcoes">
             <label>
               Questionário de destino
               <select aria-label="Questionário de destino" disabled={busy} value={destino??form.id}
                 onChange={e=>{setDestino(Number(e.target.value));setManter(false);}}>
                 <option value={form.id}>Manter neste questionário</option>
                 {form.destinos.map(q=><option key={q.id} value={q.id}>{q.titulo}</option>)}
               </select>
             </label>
             {destino === form.id && <label className="revisoes-edicao-checkbox">
               <span>Apenas ajuste de texto: manter o agendamento</span>
               <input type="checkbox" disabled={busy} checked={manter} onChange={e=>setManter(e.target.checked)}/>
             </label>}
           </div>

           {destino !== form.id
             ? <p className="revisoes-aviso">A transferência reiniciará o agendamento dos dois questionários. O histórico será preservado.</p>
             : manter
               ? <p>Use apenas para correções que preservem o significado.</p>
               : <p className="revisoes-aviso">{AVISO}</p>}
         </form>
       : <>
         <h3>{i+1}. {p.enunciado}</h3>
         <div className="revisoes-acoes">
           <button type="button" disabled={busy} onClick={()=>selecionarPergunta(p,form.id)}>Editar pergunta</button>
           <button type="button" disabled={busy} onClick={()=>void removerPergunta(p.id)}>Remover</button>
         </div>
       </>}
     </article>)}
   </section> : <>
    <p className="revisoes-aviso">{(sessao?.treino ?? treinoAutomatico)?'Treino livre':'Revisão programada'}: só será registrada ao clicar em Finalizar.</p>
    {!sessao && !treinoAutomatico && <button type="button" disabled={busy || !perguntas.length} onClick={()=>iniciar(true)}>Treino livre</button>}
    {!perguntas.length && <p>Crie perguntas no editor das suas anotações.</p>}
    {perguntas.map((p,i)=>{const r=respostas[p.id];return <article key={p.id}><h3>{i+1}. {p.enunciado}</h3><textarea aria-label={`Sua resposta ${i+1}`} value={r?.texto??''} disabled={busy} onChange={e=>mudar(p.id,{texto:e.target.value})}/><button disabled={busy} onClick={()=>mudar(p.id,{revelada:true})}>Ver resposta esperada</button>{r?.revelada&&<><p className="revisoes-resposta">{p.resposta}</p><div className="revisoes-acoes" role="group" aria-label={`Classificar pergunta ${i+1}`}>{ORDEM_RESULTADOS.map(tipo=><button key={tipo} disabled={busy} aria-pressed={r.resultado===tipo} className={`resultado-${tipo}`} onClick={()=>mudar(p.id,{resultado:tipo})}>{CLASSIFICACOES[tipo]}</button>)}</div></>}
    </article>;})}
    {perguntas.length > 0 && <button className="is-primary" disabled={busy||!completas} onClick={()=>void finalizar()}>Finalizar</button>}
   </>}

  </>}
  {form?.modo==='questionario' && <Modal title="Editar questionário" onClose={()=>setForm(null)} busy={busy} actions={
    <div className="revisoes-acoes">
      <button className="is-primary" type="submit" form="editar-questionario" disabled={busy}>Salvar</button>
      <button type="button" onClick={()=>setForm(null)} disabled={busy}>Cancelar</button>
    </div>
  }>
    <form id="editar-questionario" onSubmit={e=>{e.preventDefault();void executar(async()=>{await api.salvarQuestionario({titulo:form.titulo,limite_dias:form.limite?Number(form.limite):null},form.id);setForm(null);lista.atualizar();});}}><label>Título<input required maxLength={150} value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}/></label><label>Intervalo máximo<select aria-label="Intervalo máximo" value={form.limite===''?'sem':'definir'} onChange={e=>setForm({...form,limite:e.target.value==='sem'?'':'20'})}><option value="sem">Sem limite</option><option value="definir">Definir limite</option></select></label>{form.limite!==''&&<label>Máximo de dias<input type="number" min={1} max={36500} required value={form.limite} onChange={e=>setForm({...form,limite:e.target.value})}/></label>}<p>O limite passa a valer na próxima revisão concluída. Renomear o questionário preserva o agendamento e o histórico.</p></form>
    {erro && <p role="alert">{erro}</p>}
  </Modal>}
  {ajuda&&<Modal
    title="Sobre as revisões"
    onClose={()=>setAjuda(false)}
    actions={<p><button type="button" onClick={()=>setAjuda(false)}>Fechar</button></p>}
  ><p>Usamos uma adaptação do SuperMemo SM-2 para o questionário completo. Ao finalizar, acertos valem 1, parciais 0,5 e erros 0. Multiplicamos a proporção por 5 e usamos a parte inteira como avaliação de 0 a 5.</p><p>A facilidade começa em 2,5. Avaliações de 3 a 5 avançam a sequência: primeiro 1 dia, depois 6 dias e, a partir daí, o intervalo anterior multiplicado pela facilidade. A facilidade é ajustada a cada revisão. Uma avaliação inferior a 3 reinicia a sequência em 1 dia.</p><p>Você pode limitar o máximo de dias ou deixar sem limite. O prazo começa na conclusão. A adaptação e os pesos são escolhas do Locus, sem garantia de memorização. A porcentagem de acertos no painel considera apenas os acertos completos.</p><a href="https://super-memory.org/archive/english/ol/sm2.htm" target="_blank" rel="noreferrer">Referência do SM-2</a></Modal>}
 </section>;
}
