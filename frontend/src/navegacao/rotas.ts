export const caminhos = {
  home: "/biblioteca",
  login: "/login",
  "admin-login": "/administracao/entrar",
  register: "/cadastro",
  "forgot-password": "/recuperar-senha",
  "reset-password": "/redefinir-senha",
  "verify-email": "/confirmar-email",
  "change-email": "/confirmar-alteracao-email",
  account: "/minha-conta",
  terms: "/termos",
  privacy: "/privacidade",
  results: "/resultados",
  questionnaire: "/questionarios",
  acompanhamento: "/acompanhamento",
  gestao: "/administracao",
};

export type Tela =
  keyof typeof caminhos | "mindmap" | "annotation" | "not-found";

export const rotas: { path: string; tela: Tela; perfilTutor?: boolean }[] = [
  { path: "/", tela: "home" },
  ...Object.entries(caminhos).map(([tela, path]) => ({
    path: tela === "gestao" ? `${path}/*` : path,
    tela: tela as Tela,
  })),
  { path: "/biblioteca/pastas/:id", tela: "home" },
  { path: "/mapas/novo", tela: "mindmap" },
  { path: "/mapas/:id", tela: "mindmap" },
  { path: "/anotacoes/nova", tela: "annotation" },
  { path: "/anotacoes/:id", tela: "annotation" },
  { path: "/questionarios/:id", tela: "questionnaire" },
  { path: "/acompanhamento/perfil", tela: "acompanhamento", perfilTutor: true },
  { path: "/acompanhamento/canais/:canalId", tela: "acompanhamento" },
  { path: "*", tela: "not-found" },
];

export function enderecoMapa(
  id: string | null,
  visoes?: string[],
  bloco?: string,
) {
  const params = new URLSearchParams();
  if (visoes?.length) params.set("visoes", visoes.join(","));
  if (bloco) params.set("bloco", bloco);
  return `/mapas/${id ?? "novo"}${params.size ? `?${params}` : ""}`;
}

export function enderecoBiblioteca(pasta: string | null, busca = "") {
  const params = new URLSearchParams();
  if (busca.trim()) params.set("busca", busca);
  return `${caminhos.home}${pasta ? `/pastas/${pasta}` : ""}${params.size ? `?${params}` : ""}`;
}
