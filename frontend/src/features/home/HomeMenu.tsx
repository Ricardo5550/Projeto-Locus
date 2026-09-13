import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  deleteMindMap,
  listMindMaps,
  renameMindMap,
  type StoredMindMap,
} from '../mindmaps/mindMapApi';
import {
  deleteNote,
  listNotes,
  renameNote,
} from '../notes/noteApi';
import './HomeMenu.css';

type HomeMenuProps = {
  onCreateMindMap: () => void;
  onCreateNote: () => void;
  onOpenMindMap: (id: number, title: string) => void;
  onOpenNote: (id: number, title: string) => void;
};

type LibraryItem = {
  id: number;
  type: 'Mapa mental' | 'Anotação';
  title: string;
  updatedAt: string;
};

function getLinkedAnnotationIds(maps: StoredMindMap[]): Set<number> {
  const linkedIds = new Set<number>();

  for (const map of maps) {
    const views = Object.values(map.dados.views);

    for (const view of views) {
      for (const node of view.nodes) {
        const noteId = node.data.linkedAnnotationId;

        if (typeof noteId === 'number') {
          linkedIds.add(noteId);
        }
      }
    }
  }

  return linkedIds;
}

export default function HomeMenu({
  onCreateMindMap,
  onCreateNote,
  onOpenMindMap,
  onOpenNote,
}: HomeMenuProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Carregando biblioteca...');

  useEffect(() => {
    Promise.all([listMindMaps(), listNotes()])
      .then(([maps, notes]) => {
        const linkedAnnotationIds = getLinkedAnnotationIds(maps);
        const libraryNotes = notes.filter(
          (note) => !linkedAnnotationIds.has(note.id)
        );

        const nextItems: LibraryItem[] = [
          ...maps.map((map) => ({
            id: map.id,
            type: 'Mapa mental' as const,
            title: map.titulo,
            updatedAt: map.data_atualizacao,
          })),
          ...libraryNotes.map((note) => ({
            id: note.id,
            type: 'Anotação' as const,
            title: note.titulo,
            updatedAt: note.data_atualizacao,
          })),
        ].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        setItems(nextItems);
        setStatus(nextItems.length === 0 ? 'Nenhum conteúdo salvo ainda.' : '');
      })
      .catch((error) => {
        console.error(error);
        setStatus('Não foi possível carregar a biblioteca. Verifique o backend.');
      });
  }, []);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return items;

    return items.filter((item) =>
      `${item.title} ${item.type}`.toLocaleLowerCase('pt-BR').includes(term)
    );
  }, [items, search]);

  function openItem(item: LibraryItem) {
    if (item.type === 'Mapa mental') {
      onOpenMindMap(item.id, item.title);
    } else {
      onOpenNote(item.id, item.title);
    }
  }

  async function handleRename(item: LibraryItem) {
    const typedName = window.prompt('Novo nome:', item.title);
    if (typedName === null) return;

    const nextTitle = typedName.trim();
    if (!nextTitle) {
      window.alert('O nome não pode ficar vazio.');
      return;
    }

    try {
      const updated =
        item.type === 'Mapa mental'
          ? await renameMindMap(item.id, nextTitle)
          : await renameNote(item.id, nextTitle);

      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id && currentItem.type === item.type
            ? {
                ...currentItem,
                title: updated.titulo,
                updatedAt: updated.data_atualizacao,
              }
            : currentItem
        )
      );
    } catch (error) {
      console.error(error);
      window.alert('Não foi possível alterar o nome.');
    }
  }

  async function handleDelete(item: LibraryItem) {
    const confirmed = window.confirm(
      `Excluir “${item.title}”? Esta ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    try {
      if (item.type === 'Mapa mental') {
        await deleteMindMap(item.id);
      } else {
        await deleteNote(item.id);
      }

      setItems((current) =>
        current.filter(
          (currentItem) =>
            !(currentItem.id === item.id && currentItem.type === item.type)
        )
      );
    } catch (error) {
      console.error(error);
      window.alert('Não foi possível excluir o conteúdo.');
    }
  }

  return (
    <div className="home-layout">
      <aside className="home-sidebar">
        <div className="home-brand">
          <div className="home-brand__logo">L</div>
          <strong>Locus</strong>
        </div>

        <button className="home-nav-button" type="button">
          ▣ Biblioteca
        </button>
      </aside>

      <main className="home-main">
        <header className="home-topbar">
          <input
            type="search"
            placeholder="Buscar conteúdos"
            aria-label="Buscar conteúdos"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </header>

        <div className="home-content">
          <section>
            <span className="home-eyebrow">NOVO CONTEÚDO</span>
            <h1>O que deseja criar?</h1>
            <p className="home-description">
              Crie anotações ou mapas mentais e conecte seus conteúdos de estudo.
            </p>

            <div className="home-create-grid">
              <button type="button" onClick={onCreateNote}>
                <div className="home-preview home-preview--note">≡</div>
                <strong>Anotação</strong>
              </button>

              <button type="button" onClick={onCreateMindMap}>
                <div className="home-preview">□ ─ ○</div>
                <strong>Mapa mental</strong>
              </button>
            </div>
          </section>

          <section className="home-library">
            <span className="home-eyebrow">SUA BIBLIOTECA</span>
            <h2>Projetos</h2>

            {status && <p className="home-library__status">{status}</p>}

            <div className="home-library__list">
              {filteredItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="home-library__item"
                >
                  <button
                    type="button"
                    className="home-library__open"
                    onClick={() => openItem(item)}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.type}</span>
                    </div>
                  </button>

                  <div className="home-library__meta">
                    <time>
                      {new Date(item.updatedAt).toLocaleDateString('pt-BR')}
                    </time>

                    <button
                      type="button"
                      className="home-library__icon-button"
                      title="Renomear"
                      aria-label={`Renomear ${item.title}`}
                      onClick={() => void handleRename(item)}
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      type="button"
                      className="home-library__icon-button is-danger"
                      title="Excluir"
                      aria-label={`Excluir ${item.title}`}
                      onClick={() => void handleDelete(item)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!status && filteredItems.length === 0 && (
              <p className="home-library__status">Nenhum resultado para a busca.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
