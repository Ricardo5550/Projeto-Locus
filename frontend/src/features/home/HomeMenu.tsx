import { useEffect, useMemo, useState } from 'react';
import { Folder, FolderInput, Pencil, Trash2 } from 'lucide-react';
import { BackButton } from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { excluirMapaMental, listarMapasMentais, renomearMapaMental, type MapaMentalSalvo } from '../mapas/apiMapas';
import { excluirAnotacao, listarAnotacoes, renomearAnotacao } from '../anotacoes/apiAnotacoes';
import { criarPasta, excluirPasta, listarPastas, moverConteudo, renomearPasta, type PastaSalva } from './apiPastas';
import './HomeMenu.css';

type HomeMenuProps = {
  search: string;
  folderId: number | null;
  onFolderChange: (id: number | null) => void;
  onCreateMindMap: () => void;
  onCreateNote: () => void;
  onOpenMindMap: (id: number, title: string) => void;
  onOpenNote: (id: number, title: string) => void;
};
type ItemBiblioteca = { id:number; type:'Mapa mental'|'Anotação'|'Pasta'; title:string; folder:number|null; updatedAt?:string };

function anotacoesVinculadas(maps: MapaMentalSalvo[]): Set<number> {
  const ids=new Set<number>();
  for(const map of maps) for(const view of Object.values(map.dados.views ?? {})) {
    for(const node of view.nodes ?? []) if(typeof node.data?.linkedAnnotationId==='number') ids.add(node.data.linkedAnnotationId);
  }
  return ids;
}
function caminhoPasta(id:number|null, folders:PastaSalva[]):PastaSalva[] {
  const path:PastaSalva[]=[];const visited=new Set<number>();
  while(id!==null && !visited.has(id)) {
    visited.add(id);const folder=folders.find(f=>f.id===id);if(!folder)break;
    path.unshift(folder);id=folder.pai;
  }
  return path;
}

export default function HomeMenu({folderId,onFolderChange,onCreateMindMap,onCreateNote,onOpenMindMap,onOpenNote,search = ''}:HomeMenuProps) {
  const [items,setItems]=useState<ItemBiblioteca[]>([]);
  const [folders,setFolders]=useState<PastaSalva[]>([]);
  const [status,setStatus]=useState('Carregando biblioteca...');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [deleting,setDeleting]=useState<ItemBiblioteca|null>(null);
  const [moving,setMoving]=useState<ItemBiblioteca|null>(null);
  const [destination,setDestination]=useState('');

  async function refresh() {
    const [maps,notes,nextFolders]=await Promise.all([listarMapasMentais(),listarAnotacoes(),listarPastas()]);
    const linked=anotacoesVinculadas(maps);
    const next:ItemBiblioteca[]=[
      ...nextFolders.map(f=>({id:f.id,type:'Pasta' as const,title:f.nome,folder:f.pai})),
      ...maps.map(m=>({id:m.id,type:'Mapa mental' as const,title:m.titulo,folder:m.pasta,updatedAt:m.data_atualizacao})),
      ...notes.filter(n=>!linked.has(n.id)).map(n=>({id:n.id,type:'Anotação' as const,title:n.titulo,folder:n.pasta,updatedAt:n.data_atualizacao})),
    ];
    next.sort((a,b)=>a.type==='Pasta' && b.type!=='Pasta' ? -1 : b.type==='Pasta' && a.type!=='Pasta' ? 1 : a.title.localeCompare(b.title,'pt-BR'));
    setFolders(nextFolders);setItems(next);setStatus('');
  }
  useEffect(()=>{
    refresh().catch(()=>{setError('Não foi possível carregar a biblioteca. Verifique a conexão e as migrações do backend.');setStatus('');});
  },[]);

  const path=caminhoPasta(folderId,folders);
  const visible=useMemo(()=>items.filter(i=>i.folder===folderId && i.title.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))),[items,folderId,search]);
  function navigate(id:number|null) {onFolderChange(id);setError('');}
  function open(item:ItemBiblioteca) {
    if(item.type==='Pasta')navigate(item.id);
    else if(item.type==='Mapa mental')onOpenMindMap(item.id,item.title);
    else onOpenNote(item.id,item.title);
  }
  async function run(action:()=>Promise<unknown>) {
    setBusy(true);setError('');
    try {await action();await refresh();}
    catch(e) {setError(e instanceof Error?e.message:'Não foi possível concluir a operação.');}
    finally {setBusy(false);}
  }
  async function rename(item:ItemBiblioteca) {
    const name=window.prompt('Novo nome:',item.title);if(name===null || !name.trim())return;
    await run(()=>item.type==='Pasta'?renomearPasta(item.id,name.trim()):item.type==='Mapa mental'?renomearMapaMental(item.id,name.trim()):renomearAnotacao(item.id,name.trim()));
  }
  async function addFolder() {
    const name=window.prompt('Nome da pasta:');if(!name?.trim())return;
    await run(()=>criarPasta(name.trim(),folderId));
  }
  async function remove(mode?:'excluir_tudo'|'manter_anotacoes') {
    const item=deleting;if(!item)return;
    await run(async()=>{
      if(item.type==='Mapa mental') {if(!mode)return;await excluirMapaMental(item.id,mode);}
      else if(item.type==='Pasta')await excluirPasta(item.id);
      else await excluirAnotacao(item.id);
      setDeleting(null);
    });
  }

  const destinations=folders.filter(f=>!moving || moving.type!=='Pasta' || !caminhoPasta(f.id,folders).some(parent=>parent.id===moving.id));
  return <>
      <div className="home-content">
        <section><span className="home-eyebrow">NOVO CONTEÚDO</span><h1>O que deseja criar?</h1>
          <p className="home-description">Crie conteúdos na pasta atual e conecte seus materiais de estudo.</p>
          <div className="home-create-grid">
            <button type="button" onClick={onCreateNote}><div className="home-preview home-preview--note">≡</div><strong>Anotação</strong></button>
            <button type="button" onClick={onCreateMindMap}><div className="home-preview">□ ─ ○</div><strong>Mapa mental</strong></button>
            <button type="button" disabled={busy} onClick={()=>void addFolder()}><div className="home-preview"><Folder size={32}/></div><strong>Nova pasta</strong></button>
          </div>
        </section>

        <section className="home-library" aria-busy={busy}>
          <span className="home-eyebrow">SUA BIBLIOTECA</span>

          <nav className="home-folder-path" aria-label="Caminho da pasta">
            {folderId!==null && <BackButton onClick={()=>navigate(path.at(-1)?.pai ?? null)} />}
            <button type="button" onClick={()=>navigate(null)}>Início</button>
            {path.map(f=><span key={f.id}> / <button type="button" onClick={()=>navigate(f.id)}>{f.nome}</button></span>)}
          </nav>
          
          {error && <p role="alert" className="home-error">{error}</p>}
          {status && <p role="status">{status}</p>}
          {!status && folderId!==null && !folders.some(f=>f.id===folderId) && <p>Esta pasta não está disponível. <button onClick={()=>navigate(null)}>Voltar ao início</button></p>}
          <div className="home-library__list">{visible.map(item=><div key={`${item.type}-${item.id}`} className="home-library__item">
            <button type="button" className="home-library__open" onClick={()=>open(item)}>
              {item.type==='Pasta' && <Folder size={24} aria-hidden="true"/>}<div><strong>{item.title}</strong><span>{item.type}</span></div>
            </button>
            <div className="home-library__meta">
              {item.updatedAt && <time>{new Date(item.updatedAt).toLocaleDateString('pt-BR')}</time>}
              <button type="button" disabled={busy} className="home-library__icon-button" aria-label={`Mover ${item.title}`} title="Mover para pasta" onClick={()=>{setDestination(item.folder===null?'':String(item.folder));setMoving(item);setError('');}}><FolderInput size={16}/></button>
              <button type="button" disabled={busy} className="home-library__icon-button" aria-label={`Renomear ${item.title}`} title="Renomear" onClick={()=>void rename(item)}><Pencil size={16}/></button>
              <button type="button" disabled={busy} className="home-library__icon-button is-danger" aria-label={`Excluir ${item.title}`} title="Excluir" onClick={()=>{setDeleting(item);setError('');}}><Trash2 size={16}/></button>
            </div>
          </div>)}</div>

          {!status && !visible.length && <p className="home-library__status">{search?'Nenhum resultado nesta pasta.':'Esta pasta ainda não possui conteúdos.'}</p>}
        </section>
      </div>

    {deleting && <Modal title={`Excluir “${deleting.title}”`} busy={busy} onClose={()=>setDeleting(null)}>
      {deleting.type==='Mapa mental'?<>
        <p>O mapa principal e seus mapas internos serão excluídos. Escolha o destino das anotações:</p>
        <div className="locus-modal__actions">
          <button type="button" className="page-action" disabled={busy} onClick={()=>void remove('manter_anotacoes')}>Manter anotações em pastas</button>
          <button type="button" className="page-action is-danger" disabled={busy} onClick={()=>void remove('excluir_tudo')}>Excluir mapa e as anotações vinculadas</button>
        </div>
        <p>Ao manter, será criada uma pasta com o nome do mapa e subpastas para os mapas internos. Perguntas e tentativas das anotações mantidas serão preservadas.</p>
      </>:<>
        <p>{deleting.type==='Pasta'?'A pasta só pode ser excluída quando estiver vazia.':'A anotação, suas perguntas e tentativas deixarão de ficar disponíveis.'}</p>
        <div className="locus-modal__actions"><button type="button" className="page-action is-danger" disabled={busy} onClick={()=>void remove()}>Confirmar exclusão</button></div>
      </>}
      {error && <p role="alert">{error}</p>}{busy && <p role="status">Processando...</p>}
    </Modal>}
    {moving && <Modal title={`Mover “${moving.title}”`} busy={busy} onClose={()=>setMoving(null)}>
      <label htmlFor="folder-destination">Pasta de destino</label>
      <select id="folder-destination" value={destination} onChange={e=>setDestination(e.target.value)}>
        <option value="">Início</option>
        {destinations.map(f=><option key={f.id} value={f.id}>{caminhoPasta(f.id,folders).map(p=>p.nome).join(' / ')}</option>)}
      </select>
      <div className="locus-modal__actions"><button className="page-action is-primary" type="button" disabled={busy} onClick={()=>void run(async()=>{await moverConteudo(moving.type,moving.id,destination?Number(destination):null);setMoving(null);})}>Mover</button></div>
      {error && <p role="alert">{error}</p>}
    </Modal>}
  </>;
}
