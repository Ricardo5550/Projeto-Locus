import { apiJson, apiSemRetorno } from "../../services/apiClient";
export type PastaSalva = {
  id: string;
  nome: string;
  pai: string | null;
  autor: string;
};
export const listarPastas = () => apiJson<PastaSalva[]>("/pastas/");
export const criarPasta = (nome: string, pai: string | null) =>
  apiJson<PastaSalva>("/pastas/", {
    method: "POST",
    body: JSON.stringify({ nome, pai }),
  });
export const renomearPasta = (id: string, nome: string) =>
  apiJson<PastaSalva>(`/pastas/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ nome }),
  });
export const excluirPasta = (id: string, confirmarConteudo = false) =>
  apiSemRetorno(
    `/pastas/${id}/${confirmarConteudo ? "?confirmar_conteudo=true" : ""}`,
    { method: "DELETE" },
  );
export const moverConteudo = (
  type: "Mapa mental" | "Anotação" | "Pasta",
  id: string,
  pasta: string | null,
) =>
  apiJson(
    `/${type === "Pasta" ? "pastas" : type === "Mapa mental" ? "mapas-mentais" : "anotacoes"}/${id}/`,
    {
      method: "PATCH",
      body: JSON.stringify(type === "Pasta" ? { pai: pasta } : { pasta }),
    },
  );
