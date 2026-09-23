import { useEffect, useRef, useState, type FormEvent } from 'react';
import { searchReferences, type AcademicReference } from './referenceApi';

type ReferencePanelProps = {
  initialTerm: string;
  onInsert: (reference: AcademicReference) => void;
  onClose: () => void;
};

export default function ReferencePanel({ initialTerm, onInsert, onClose }: ReferencePanelProps) {
  const [term, setTerm] = useState(initialTerm);
  const [results, setResults] = useState<AcademicReference[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return () => requestRef.current?.abort();
  }, []);

  // Uma seleção diferente substitui a pesquisa anterior, sem mostrar resultados desatualizados.
  useEffect(() => {
    setTerm(initialTerm);
    void runSearch(initialTerm);
  }, [initialTerm]);

  async function runSearch(value: string) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setResults([]);
    setSearched(false);
    setError('');
    setLoading(true);

    try {
      const items = await searchReferences(value, controller.signal);
      if (controller.signal.aborted) return;
      setResults(items);
      setSearched(true);
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError(failure instanceof Error ? failure.message : 'Não foi possível consultar as fontes.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(term);
  }

  return (
    <section ref={panelRef} className="note-references" aria-label="Fontes relacionadas">
      <header className="note-references__header">
        <div>
          <h2>Fontes relacionadas</h2>
          <p>Publicações encontradas por termos de pesquisa; os resultados não comprovam automaticamente a anotação.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar pesquisa de fontes">Fechar</button>
      </header>

      <form className="note-references__search" onSubmit={handleSubmit}>
        <label htmlFor="note-reference-query">Trecho selecionado ou termos de pesquisa</label>
        <div>
          <input
            id="note-reference-query"
            value={term}
            maxLength={200}
            onChange={(event) => {
              requestRef.current?.abort();
              setLoading(false);
              setResults([]);
              setSearched(false);
              setError('');
              setTerm(event.target.value);
            }}
            placeholder="Digite o título, assunto ou autor"
          />
          <button type="submit" disabled={loading || term.trim().length < 2}>
            {loading ? 'Pesquisando...' : 'Pesquisar'}
          </button>
        </div>
      </form>

      {error && <p className="note-references__message" role="alert">{error}</p>}
      {loading && <p className="note-references__message" role="status">Consultando a Crossref...</p>}
      {!loading && !error && searched && results.length === 0 && (
        <p className="note-references__message">Nenhuma fonte encontrada. Tente outros termos.</p>
      )}

      {results.length > 0 && (
        <ul className="note-references__results">
          {results.map((item, index) => (
            <li key={`${item.doi || item.url || item.titulo}-${index}`}>
              <h3>{item.titulo || 'Publicação sem título informado'}</h3>
              <p>{item.autores.length ? item.autores.join(', ') : 'Autores não informados'}
                {item.ano ? ` · ${item.ano}` : ''}
                {item.publicacao ? ` · ${item.publicacao}` : ''}</p>
              {item.doi && <p className="note-references__doi">DOI: {item.doi}</p>}
              <div className="note-references__actions">
                {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer">Abrir publicação</a>}
                <button type="button" onClick={() => onInsert(item)}>Inserir dados na anotação</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
