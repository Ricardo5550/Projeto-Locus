import DocumentoLegal, { type DocumentoLegalProps } from "./DocumentoLegal";
import "./TermosUso.css";

export default function TermosUso(props: DocumentoLegalProps) {
  return <DocumentoLegal {...props} categoria="termos" titulo="Termos de Uso" />;
}
