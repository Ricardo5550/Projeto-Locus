import type { DadosBloco, DadosMapaMental } from "./tiposMapa";

export const ID_VISAO_RAIZ = "root";

export function criarDadosBloco(
  label: string,
  elementKind: "shape" | "text" = "shape",
): DadosBloco {
  return {
    label,
    elementKind,
    shape: "square",
    connectionMode: false,
    fontSize: 16,
    fontFamily: "Arial",
    textColor: "#000000",
    bold: false,
    underline: false,
    italic: false,
    strike: false,
    textAlign: elementKind === "text" ? "left" : "center",
    verticalAlign: "center",
    backgroundColor: elementKind === "text" ? "transparent" : "#ffffff",
    borderColor: "#5e402b",
    borderWidth: elementKind === "text" ? 0 : 1,
    borderRadius: 0,
  };
}

export function criarMapaVazio(title: string): DadosMapaMental {
  return {
    rootViewId: ID_VISAO_RAIZ,
    views: {
      [ID_VISAO_RAIZ]: {
        title,
        nodes: [],
        edges: [],
      },
    },
  };
}

export function redefinirModoConexao(data: DadosMapaMental): DadosMapaMental {
  return {
    ...data,
    views: Object.fromEntries(
      Object.entries(data.views).map(([viewId, view]) => [
        viewId,
        {
          ...view,
          nodes: view.nodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              connectionMode: false,
            },
          })),
        },
      ]),
    ),
  };
}

export function validarCaminhoVisoes(
  data: DadosMapaMental,
  requested?: string[],
): string[] {
  if (
    requested &&
    requested.length > 0 &&
    requested[0] === data.rootViewId &&
    requested.every((viewId) => Boolean(data.views[viewId]))
  ) {
    return requested;
  }

  return [data.rootViewId];
}
