import './Paginacao.css';

export default function Paginacao({ pagina, total, onChange, disabled = false }: {
  pagina: number;
  total: number;
  onChange: (pagina: number) => void;
  disabled?: boolean;
}) {
  if (total <= 1) return null;
  return (
    <nav className="locus-paginacao" aria-label="Paginação">
      <button type="button" className="page-action" disabled={disabled || pagina <= 1} onClick={() => onChange(pagina - 1)}>Anterior</button>
      <span aria-live="polite">Página {pagina} de {total}</span>
      <button type="button" className="page-action" disabled={disabled || pagina >= total} onClick={() => onChange(pagina + 1)}>Próxima</button>
    </nav>
  );
}
