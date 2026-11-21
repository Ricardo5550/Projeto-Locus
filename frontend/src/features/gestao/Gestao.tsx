import { Navigate, Route, Routes } from "react-router-dom";
import { useDadosGestao } from "./useDadosGestao";
import ContasGestao, { DetalheContaGestao } from "./ContasGestao";
import TutoresGestao, { DetalheTutorGestao } from "./TutoresGestao";
import AuditoriaGestao from "./AuditoriaGestao";
import "./Gestao.css";
import { ContextoGestao } from "./contextoGestao";
import { EquipeAdmin, NovoAdministrador } from "./EquipeAdmin";
import DocumentosGestao from "./DocumentosGestao";

export default function Gestao() {
  const acesso = useDadosGestao<{ administrador: boolean; supremo: boolean }>(
    "/gestao/acesso/",
  );
  if (acesso.carregando)
    return <p role="status">Verificando acesso administrativo…</p>;
  if (acesso.erro)
    return (
      <section className="gestao">
        <h2>Acesso administrativo</h2>
        <p role="alert">{acesso.erro}</p>
        <button className="page-action" onClick={acesso.atualizar}>
          Tentar novamente
        </button>
      </section>
    );
  return (
    <ContextoGestao.Provider value={!!acesso.dados?.supremo}>
      <section className="gestao" aria-label="Gestão do Locus">
        <Routes>
          <Route index element={<Navigate to="contas" replace />} />
          <Route path="contas" element={<ContasGestao />} />
          <Route
            path="contas/nova"
            element={<Navigate to="../equipe/nova" replace />}
          />
          <Route path="equipe" element={<EquipeAdmin />} />
          <Route path="equipe/nova" element={<NovoAdministrador />} />
          <Route path="contas/:usuarioId" element={<DetalheContaGestao />} />
          <Route path="tutores" element={<TutoresGestao />} />
          <Route path="tutores/:perfilId" element={<DetalheTutorGestao />} />
          <Route path="auditoria" element={<AuditoriaGestao />} />
          <Route path="documentos" element={<DocumentosGestao />} />
          <Route
            path="*"
            element={
              <h2>Página administrativa não encontrada</h2>
            }
          />
        </Routes>
      </section>
    </ContextoGestao.Provider>
  );
}
