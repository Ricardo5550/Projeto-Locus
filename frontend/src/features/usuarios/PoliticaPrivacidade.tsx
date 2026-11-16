import DocumentoLegal, { type DocumentoLegalProps } from "./DocumentoLegal";
import type { DadosDocumentoLegal } from "./versoesLegais";
import "./PoliticaPrivacidade.css";

export type DadosPolitica = DadosDocumentoLegal;

export default function PoliticaPrivacidade({
  politica,
  ...props
}: Omit<DocumentoLegalProps, "dados"> & { politica?: DadosPolitica }) {
  return (
    <DocumentoLegal
      {...props}
      dados={politica}
      categoria="privacidade"
      titulo="Política de Privacidade"
    />
  );
}
