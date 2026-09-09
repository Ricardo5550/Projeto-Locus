import './HomeMenu.css';

type HomeMenuProps = {
  onCreateMindMap: () => void;
  onCreateNote: () => void;
  onOpenMindMap: () => void;
};

type LibraryItem = {
  id: number;
  type: 'Mapa mental' | 'Anotação';
  title: string;
  updatedAt: string;
};

const libraryItems: LibraryItem[] = [
  {
    id: 1,
    type: 'Mapa mental',
    title: 'Projeto 3',
    updatedAt: '07/09/2026',
  },
  {
    id: 2,
    type: 'Mapa mental',
    title: 'Projeto 2',
    updatedAt: '07/09/2026',
  },
  {
    id: 3,
    type: 'Anotação',
    title: 'Projeto 1',
    updatedAt: '07/09/2026',
  },
];

export default function HomeMenu({
  onCreateMindMap,
  onCreateNote,
  onOpenMindMap,
}: HomeMenuProps) {
  function openLibraryItem(item: LibraryItem) {
    if (item.type === 'Mapa mental') {
      onOpenMindMap();
      return;
    }

    onCreateNote();
  }

  return (
    <div className="home-layout">
      <aside className="home-sidebar">
        <div className="home-brand">
          <div className="home-brand-logo" aria-hidden="true">
            L
          </div>
          <span>Locus</span>
        </div>

        <nav className="home-nav" aria-label="Navegação principal">
          <button className="home-nav-item home-nav-item--active" type="button">
            <span aria-hidden="true">▣</span>
            <span>Biblioteca</span>
          </button>
        </nav>
      </aside>

      <main className="home-main">
        <header className="home-topbar">
          <input
            className="home-search"
            type="search"
            placeholder="Buscar conteúdos"
            aria-label="Buscar conteúdos"
          />
        </header>

        <div className="home-content">
          <section className="home-create-section">
            <span className="home-eyebrow">NOVO CONTEÚDO</span>
            <h1>O que deseja criar?</h1>
            <p className="home-create-description">
              Crie anotações ou mapas mentais e conecte seus conteúdos de estudo.
            </p>

            <div className="home-create-options">
              <button
                className="home-create-card"
                type="button"
                onClick={onCreateNote}
              >
                <div className="home-note-preview" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <strong>Anotação</strong>
              </button>

              <button
                className="home-create-card"
                type="button"
                onClick={onCreateMindMap}
              >
                <div className="home-map-preview" aria-hidden="true">
                  <span className="home-map-node home-map-node--purple" />
                  <span className="home-map-node home-map-node--green" />
                  <span className="home-map-node home-map-node--blue home-map-node--circle" />
                  <span className="home-map-line home-map-line--horizontal" />
                  <span className="home-map-line home-map-line--vertical" />
                </div>
                <strong>Mapa mental</strong>
              </button>
            </div>
          </section>

          <section className="home-library-section">
            <span className="home-eyebrow">SUA BIBLIOTECA</span>
            <h2>Projetos</h2>

            <div className="home-library-list">
              {libraryItems.map((item) => (
                <button
                  key={item.id}
                  className="home-library-row"
                  type="button"
                  onClick={() => openLibraryItem(item)}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.type}</span>
                  </div>
                  <time>{item.updatedAt}</time>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
