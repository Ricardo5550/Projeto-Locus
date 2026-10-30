import { useEffect, useRef, type ReactNode } from 'react';
import './Modal.css';
export default function Modal({ title, onClose, children, busy=false }: {title:string;onClose:()=>void;children:ReactNode;busy?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return ()=>dialog?.close();},[]);
  return <dialog ref={ref} className="locus-modal" aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <h2>{title}</h2>{children}
    <button type="button" className="page-action" onClick={onClose} disabled={busy}>Cancelar</button>
  </dialog>;
}
