type RelatedSidebarProps = {
  relatedNames: string[];
};

export default function RelatedSidebar({
  relatedNames,
}: RelatedSidebarProps) {
  return (
    <aside className="related-sidebar">
      <h3>Relacionados</h3>

      {relatedNames.length === 0 ? (
        <p className="related-sidebar__empty">
          Nenhum conteúdo relacionado.
        </p>
      ) : (
        <div className="related-sidebar__list">
          {relatedNames.map((name) => (
            <button
              key={name}
              className="related-sidebar__item"
              type="button"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}