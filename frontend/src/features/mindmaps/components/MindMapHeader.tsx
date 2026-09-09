type MindMapHeaderProps = {
  breadcrumb: string[];
  onBack: () => void;
};

export default function MindMapHeader({
  breadcrumb,
  onBack,
}: MindMapHeaderProps) {
  return (
    <header className="mindmap-header">
      <button
        className="mindmap-header__back"
        type="button"
        onClick={onBack}
        aria-label="Voltar"
      >
        ←
      </button>

      <div className="mindmap-header__title">
        <span>
          {breadcrumb.map((item, index) => (
            <span key={`${item}-${index}`}>
              {index > 0 && ' / '}
              {item}
            </span>
          ))}
        </span>
        <strong>{breadcrumb[breadcrumb.length - 1] ?? 'Mapa mental'}</strong>
      </div>

      <span className="mindmap-header__tag">Mapa mental</span>
    </header>
  );
}
