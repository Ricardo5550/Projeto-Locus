import RelatedSidebar from '../mindmaps/components/RelatedSidebar';
import './AnnotationPlaceholder.css';

type AnnotationPlaceholderProps = {
  title: string;
  breadcrumb: string[];
  relatedNames: string[];
  showRelated: boolean;
  onBack: () => void;
};

export default function AnnotationPlaceholder({
  title,
  breadcrumb,
  relatedNames,
  showRelated,
  onBack,
}: AnnotationPlaceholderProps) {
  return (
    <div className="annotation-layout">
      <main className="annotation-main">
        <button className="annotation-back" type="button" onClick={onBack}>
          ← Voltar
        </button>

        <div className="annotation-breadcrumb">
          {breadcrumb.map((item, index) => (
            <span key={`${item}-${index}`}>
              {index > 0 && ' / '}
              {item}
            </span>
          ))}
        </div>

        <span className="annotation-eyebrow">ANOTAÇÃO</span>
        <h1>{title}</h1>
        <p>Voa Ricardo, acredito em você</p>
      </main>

      {showRelated && <RelatedSidebar relatedNames={relatedNames} />}
    </div>
  );
}


