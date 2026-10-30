import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import './PageHeader.css';

type Props = {
  title: string;
  onBack?: () => void;
  onTitleChange?: (title: string) => void;
  placeholder?: string;
  titleLabel?: string;
  maxLength?: number;
  status?: string;
  actions?: ReactNode;
};

export function BackButton({ onClick, label = 'Voltar' }: { onClick: () => void; label?: string }) {
  return <button type="button" className="page-back" onClick={onClick} aria-label={label} title={label}>
    <ArrowLeft size={18} aria-hidden="true" />
  </button>;
}

export default function PageHeader({ title, onBack, onTitleChange, placeholder, titleLabel, maxLength, status, actions }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const measure = () => header.parentElement?.style.setProperty('--page-header-height', `${header.offsetHeight}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    measure();
    return () => observer.disconnect();
  }, []);
  return <header className="page-header" ref={ref}>
    {onBack && <BackButton onClick={onBack} />}
    {onTitleChange ? <input className="page-header__title" value={title} onChange={e => onTitleChange(e.target.value)}
      placeholder={placeholder} aria-label={titleLabel || 'Título'} maxLength={maxLength} />
      : <h1 className="page-header__title">{title}</h1>}
    <div className="page-header__actions">
      {status && <span className="page-header__status" role="status">{status}</span>}
      {actions}
    </div>
  </header>;
}
