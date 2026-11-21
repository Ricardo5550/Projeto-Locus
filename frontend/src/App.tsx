import { useDialogos } from "./components/contextoDialogos";
import { useEffect, useMemo, useRef, useState } from "react";
import HomeMenu from "./features/home/HomeMenu";
import HomeLayout, { type SecaoHome } from "./features/home/HomeLayout";
import { obterUsuarioAtual } from "./features/usuarios/apiUsuarios";
import ConfiguracoesConta from "./features/usuarios/ConfiguracoesConta";
import MapaMental from "./features/mapas/MapaMental";
import AnotacaoEditor, {
  type ContextoRelacionamentoAnotacao,
  type DestinoRelacionamentoAnotacao,
} from "./features/anotacoes/AnotacaoEditor";
import Cadastro from "./features/cadastro/Cadastro";
import Login from "./features/login/Login";
import RecuperarSenha from "./features/login/RecuperarSenha";
import RedefinirSenha from "./features/login/RedefinirSenha";
import VerificarEmail from "./features/cadastro/VerificarEmail";
import TermosUso from "./features/usuarios/TermosUso";
import PoliticaPrivacidade from "./features/usuarios/PoliticaPrivacidade";
import ConfirmarAlteracaoEmail from "./features/usuarios/ConfirmarAlteracaoEmail";
import Resultados from "./features/revisoes/Resultados";
import Gestao from "./features/gestao/Gestao";
import Questionario, {
  type NavegacaoQuestionario,
} from "./features/revisoes/Questionario";
import { restaurarSessao, encerrarSessao } from "./services/apiClient";
import Acompanhamento, {
  type NavegacaoAcompanhamento,
} from "./features/acompanhamento/Acompanhamento";
import "./App.css";

import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  caminhos,
  enderecoBiblioteca,
  enderecoMapa,
  type Tela,
} from "./navegacao/rotas";
import { useProtecaoHistorico } from "./navegacao/useProtecaoHistorico";

type EstadoNavegacao = {
  breadcrumb?: string[];
  pastaOrigem?: string | null;
  relacionamento?: ContextoRelacionamentoAnotacao;
  voltarPara?: string;
  estadoRetorno?: EstadoNavegacao;
  retornoQuestionario?: string;
  retornoLogin?: string;
  mensagemAcompanhamento?: string;
};
const publicas = new Set<Tela>([
  "login",
  "admin-login",
  "register",
  "forgot-password",
  "reset-password",
  "verify-email",
  "change-email",
  "terms",
  "privacy",
  "not-found",
]);
const AVISO_REVISAO = "Sair sem finalizar? Esta sessão não será contabilizada.";

export default function App({
  tela: screen,
  perfilTutor = false,
}: {
  tela: Tela;
  perfilTutor?: boolean;
}) {
  const dialogos = useDialogos();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const estado = (location.state ?? {}) as EstadoNavegacao;
  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  const [administrador, setAdministrador] = useState(false);
  const [loginNotice, setLoginNotice] = useState("");
  const [revisaoEmAndamento, setRevisaoEmAndamento] = useState(false);
  const [editorPendente, setEditorPendente] = useState(false);
  const [accountVersion, setAccountVersion] = useState(0);
  const [emDetalheQuestionario, setEmDetalheQuestionario] = useState(false);
  const [emDetalheAcompanhamento, setEmDetalheAcompanhamento] = useState(false);
  const navegacaoQuestionario = useRef<NavegacaoQuestionario>(null);
  const navegacaoAcompanhamento = useRef<NavegacaoAcompanhamento>(null);
  const logoutVoluntario = useRef(false);

  const libraryFolderId =
    screen === "home"
      ? (params.id ?? null)
      : (estado.pastaOrigem ?? query.get("pasta"));
  const librarySearch = screen === "home" ? (query.get("busca") ?? "") : "";
  const currentMapId = screen === "mindmap" ? (params.id ?? null) : null;
  const currentNoteId = screen === "annotation" ? (params.id ?? null) : null;
  const questionarioAberto =
    screen === "questionnaire" ? (params.id ?? null) : null;
  const currentMapViewStack = useMemo(
    () => query.get("visoes")?.split(",").filter(Boolean),
    [query],
  );
  const breadcrumb = estado.breadcrumb ?? [
    "Início",
    screen === "mindmap" ? "Mapa mental" : "Anotação",
  ];
  const avisoCanal = useMemo(
    () =>
      params.canalId
        ? {
            id: params.canalId,
            aba:
              query.get("aba") === "duvidas"
                ? ("duvidas" as const)
                : ("materiais" as const),
          }
        : undefined,
    [params.canalId, query],
  );

  useProtecaoHistorico(
    autenticado
      ? revisaoEmAndamento
        ? AVISO_REVISAO
        : editorPendente
          ? "Há alterações não salvas. Deseja sair e descartá-las?"
          : null
      : null,
  );

  useEffect(() => {
    let ativo = true;
    void restaurarSessao()
      .then(async (ok) => {
        const conta = ok ? await obterUsuarioAtual() : null;
        if (ativo) {
          setAdministrador(!!conta?.is_staff);
          setAutenticado(ok);
        }
      })
      .catch(() => {
        if (ativo) setAutenticado(false);
      });
    return () => {
      ativo = false;
    };
  }, [accountVersion]);

  useEffect(() => {
    const encerrar = () => {
      setAutenticado(false);
      setAdministrador(false);
      setRevisaoEmAndamento(false);
      setEditorPendente(false);
      if (!publicas.has(screen))
        void navigate(
          administrador ? caminhos["admin-login"] : caminhos.login,
          {
            replace: true,
            state: logoutVoluntario.current
              ? null
              : { retornoLogin: location.pathname + location.search },
          },
        );
    };
    window.addEventListener("auth:logout", encerrar);
    return () => window.removeEventListener("auth:logout", encerrar);
  }, [navigate, screen, location.pathname, location.search, administrador]);

  function goHome() {
    void navigate(administrador ? caminhos.gestao : caminhos.home);
  }
  function goBack() {
    void navigate(
      estado.voltarPara ?? enderecoBiblioteca(estado.pastaOrigem ?? null),
      { state: estado.estadoRetorno },
    );
  }
  async function podeSairDaRevisao() {
    return !revisaoEmAndamento || (await dialogos.confirmar(AVISO_REVISAO));
  }
  async function handleLogout() {
    if (!(await podeSairDaRevisao())) return;
    logoutVoluntario.current = true;
    try {
      await encerrarSessao();
    } catch {
      logoutVoluntario.current = false;
      void dialogos.avisar(
        "Não foi possível encerrar a sessão no servidor. Verifique a conexão e tente novamente.",
      );
    }
  }
  async function openHomeSection(section: SecaoHome) {
    if (!(await podeSairDaRevisao())) return;
    setRevisaoEmAndamento(false);
    void navigate(caminhos[section]);
  }
  function abrirEditor(
    tipo: "mindmap" | "annotation",
    id: string | null,
    title: string,
  ) {
    const pasta = libraryFolderId;
    const base =
      tipo === "mindmap" ? enderecoMapa(id) : `/anotacoes/${id ?? "nova"}`;
    void navigate(`${base}${!id && pasta ? `?pasta=${pasta}` : ""}`, {
      state: {
        breadcrumb: ["Início", title],
        pastaOrigem: pasta,
        voltarPara: location.pathname + location.search,
      } satisfies EstadoNavegacao,
    });
  }
  async function openAnnotationFromMap(
    blockName: string,
    noteId: string,
    parentMapId: string,
    viewStack: string[],
    sourceNodeId: string,
  ) {
    const parentUrl = enderecoMapa(parentMapId, viewStack);
    const parentState = { ...estado, breadcrumb, pastaOrigem: libraryFolderId };
    // A entrada anterior também guarda a visão para o Voltar do navegador.
    await navigate(parentUrl, { replace: true, state: parentState });
    void navigate(`/anotacoes/${noteId}`, {
      state: {
        breadcrumb: [...breadcrumb, blockName],
        pastaOrigem: libraryFolderId,
        relacionamento: {
          parentMapId,
          parentViewStack: viewStack,
          sourceNodeId,
        },
        voltarPara: parentUrl,
        estadoRetorno: parentState,
      } satisfies EstadoNavegacao,
    });
  }
  function navigateFromAnnotation(target: DestinoRelacionamentoAnotacao) {
    const parentBreadcrumb = breadcrumb.slice(0, -1);
    if (
      target.linkedContentType === "annotation" &&
      target.linkedAnnotationId
    ) {
      void navigate(`/anotacoes/${target.linkedAnnotationId}`, {
        state: {
          ...estado,
          breadcrumb: [...parentBreadcrumb, target.blockName],
          relacionamento: {
            parentMapId: target.parentMapId,
            parentViewStack: target.parentViewStack,
            sourceNodeId: target.nodeId,
          },
        } satisfies EstadoNavegacao,
      });
    } else {
      const visoes =
        target.linkedContentType === "mindmap" && target.linkedViewId
          ? [...target.parentViewStack, target.linkedViewId]
          : target.parentViewStack;
      void navigate(
        enderecoMapa(
          target.parentMapId,
          visoes,
          target.linkedViewId ? undefined : target.nodeId,
        ),
        {
          state: {
            breadcrumb: parentBreadcrumb,
            pastaOrigem: estado.pastaOrigem,
          } satisfies EstadoNavegacao,
        },
      );
    }
  }
  function atualizarEnderecoSalvo(
    tipo: "mindmap" | "annotation",
    id: string,
    title: string,
  ) {
    const novoBreadcrumb = [...breadcrumb.slice(0, -1), title];
    const path =
      tipo === "mindmap"
        ? enderecoMapa(id, currentMapViewStack)
        : `/anotacoes/${id}`;
    void navigate(path, {
      replace: true,
      state: { ...estado, breadcrumb: novoBreadcrumb },
    });
  }
  function voltarAoLogin(mensagem: string) {
    setLoginNotice(mensagem);
    void navigate(caminhos.login, { replace: true });
  }

  // Os links de e-mail antigos continuam válidos: /?verify_email=..., etc.
  const legado = query.has("change_email")
    ? "change-email"
    : query.has("verify_email")
      ? "verify-email"
      : query.has("reset_uid") && query.has("reset_token")
        ? "reset-password"
        : null;
  if (legado && screen !== legado)
    return <Navigate to={caminhos[legado] + location.search} replace />;

  if (!publicas.has(screen)) {
    if (autenticado === null) return <p role="status">Verificando sessão...</p>;
    if (!autenticado)
      return (
        <Navigate
          to={screen === "gestao" ? caminhos["admin-login"] : caminhos.login}
          replace
          state={{ retornoLogin: location.pathname + location.search }}
        />
      );
    if (administrador && !["gestao", "account"].includes(screen))
      return <Navigate to={caminhos.gestao} replace />;
    if (location.pathname === "/")
      return <Navigate to={caminhos.home} replace />;
  }

  if (screen === "change-email")
    return (
      <ConfirmarAlteracaoEmail
        onBackToLogin={() =>
          voltarAoLogin("Entre com o endereço de e-mail atual da sua conta.")
        }
      />
    );
  if (screen === "verify-email")
    return (
      <VerificarEmail
        onBackToLogin={() =>
          voltarAoLogin("E-mail confirmado. Entre com sua conta.")
        }
      />
    );
  if (screen === "reset-password")
    return (
      <RedefinirSenha
        onBackToLogin={() => voltarAoLogin("Use sua nova senha para entrar.")}
      />
    );
  if (screen === "forgot-password")
    return (
      <RecuperarSenha onBackToLogin={() => void navigate(caminhos.login)} />
    );
  if (screen === "register")
    return (
      <Cadastro
        onNavigateToLogin={() => void navigate(caminhos.login)}
        onRegistrationSuccess={() =>
          voltarAoLogin(
            "Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.",
          )
        }
      />
    );
  if (screen === "login" || screen === "admin-login") {
    if (autenticado === null) return <p role="status">Verificando sessão...</p>;
    if (autenticado) {
      const retorno = estado.retornoLogin;
      return (
        <Navigate
          to={
            administrador
              ? caminhos.gestao
              : retorno?.startsWith("/") && !retorno.startsWith("//")
                ? retorno
                : caminhos.home
          }
          replace
        />
      );
    }
    return (
      <Login
        key={screen}
        administrativo={screen === "admin-login"}
        onNavigateToAdmin={() => void navigate(caminhos["admin-login"])}
        notice={loginNotice}
        onLoginSuccess={() => {
          logoutVoluntario.current = false;
          setAutenticado(null);
          setAccountVersion((v) => v + 1);
          setLoginNotice("");
        }}
        onNavigateToRegister={() => {
          setLoginNotice("");
          void navigate(
            screen === "admin-login" ? caminhos.login : caminhos.register,
          );
        }}
        onNavigateToForgotPassword={() => {
          setLoginNotice("");
          void navigate(caminhos["forgot-password"]);
        }}
      />
    );
  }
  if (screen === "not-found")
    return (
      <main>
        <h1>Página não encontrada</h1>
        <button className="page-action" onClick={goHome}>
          Ir para a Biblioteca
        </button>
      </main>
    );
  if (!autenticado && screen === "terms")
    return <TermosUso onBack={() => void navigate(caminhos.login)} />;
  if (!autenticado && screen === "privacy")
    return <PoliticaPrivacidade onBack={() => void navigate(caminhos.login)} />;

  if (screen === "annotation")
    return (
      <AnotacaoEditor
        noteId={currentNoteId}
        initialFolderId={libraryFolderId}
        initialTitle={breadcrumb.at(-1) || "Nova anotação"}
        breadcrumb={breadcrumb}
        onSaidaPendenteChange={setEditorPendente}
        onBack={() =>
          estado.retornoQuestionario
            ? void navigate(
                `/questionarios/${estado.retornoQuestionario}?devolutiva=1`,
              )
            : goBack()
        }
        onHome={goHome}
        relationshipContext={estado.relacionamento}
        onNavigateRelationship={navigateFromAnnotation}
        onCreated={(id, title) =>
          atualizarEnderecoSalvo("annotation", id, title)
        }
      />
    );

  if (screen === "mindmap")
    return (
      <MapaMental
        mapId={currentMapId}
        initialFolderId={libraryFolderId}
        breadcrumb={breadcrumb}
        initialViewStack={currentMapViewStack}
        initialSelectedNodeId={query.get("bloco") ?? undefined}
        onSaidaPendenteChange={setEditorPendente}
        onViewChange={(id, visoes) => {
          const path = enderecoMapa(
            id,
            visoes,
            query.get("bloco") ?? undefined,
          );
          if (path !== location.pathname + location.search)
            void navigate(path, { replace: true, state: estado });
        }}
        onBack={goBack}
        onHome={goHome}
        onMapCreated={(id, title) =>
          atualizarEnderecoSalvo("mindmap", id, title)
        }
        onOpenAnnotation={openAnnotationFromMap}
      />
    );

  return (
    <HomeLayout
      administrativo={administrador}
      active={screen as SecaoHome}
      onNavigate={openHomeSection}
      onLogout={() => void handleLogout()}
      onBack={
        screen === "questionnaire" && emDetalheQuestionario
          ? () => navegacaoQuestionario.current?.voltar()
          : screen === "acompanhamento" && emDetalheAcompanhamento
            ? () => navegacaoAcompanhamento.current?.voltar()
            : undefined
      }
      search={librarySearch}
      onSearchChange={(busca) =>
        void navigate(enderecoBiblioteca(libraryFolderId, busca), {
          replace: true,
        })
      }
      accountVersion={accountVersion}
      onNotification={async (destino, id) => {
        if (!(await podeSairDaRevisao())) return;
        if (destino === "perfil-tutor") void navigate("/acompanhamento/perfil");
        else if (destino === "acompanhamento-convites")
          void navigate(`/acompanhamento?convite=${encodeURIComponent(id)}`);
        else if (destino === "questionnaire")
          void navigate(`/questionarios/${id}`);
        else if (
          destino === "acompanhamento" ||
          destino === "acompanhamento-duvidas"
        )
          void navigate(
            `/acompanhamento/canais/${id}${destino === "acompanhamento-duvidas" ? "?aba=duvidas" : ""}`,
          );
      }}
    >
      {screen === "home" && (
        <HomeMenu
          folderId={libraryFolderId}
          search={librarySearch}
          onFolderChange={(id) => void navigate(enderecoBiblioteca(id))}
          onCreateMindMap={() => abrirEditor("mindmap", null, "Mapa mental")}
          onCreateNote={() => abrirEditor("annotation", null, "Nova anotação")}
          onOpenMindMap={(id, title) => abrirEditor("mindmap", id, title)}
          onOpenNote={(id, title) => abrirEditor("annotation", id, title)}
          onOpenQuestionario={(id) => void navigate(`/questionarios/${id}`)}
        />
      )}
      {screen === "results" && <Resultados />}
      {screen === "gestao" && <Gestao />}
      {screen === "questionnaire" && (
        <Questionario
          key={questionarioAberto ?? "lista"}
          ref={navegacaoQuestionario}
          initialId={questionarioAberto}
          initialDevolutiva={query.get("devolutiva") === "1"}
          onAbrirQuestionario={(id) => void navigate(`/questionarios/${id}`)}
          onVoltarLista={() => void navigate(caminhos.questionnaire)}
          onSessionChange={setRevisaoEmAndamento}
          onDetalheChange={setEmDetalheQuestionario}
          onOpenNote={(id, title, qid) =>
            void navigate(`/anotacoes/${id}`, {
              state: {
                breadcrumb: ["Início", "Questionários", title],
                retornoQuestionario: qid,
              } satisfies EstadoNavegacao,
            })
          }
        />
      )}
      {screen === "acompanhamento" && (
        <Acompanhamento
          key={params.canalId ?? (perfilTutor ? "perfil" : "lista")}
          ref={navegacaoAcompanhamento}
          avisoCanal={avisoCanal}
          avisoConvite={query.get("convite") ?? undefined}
          initialPerfil={perfilTutor}
          onAbrirCanal={(id) => void navigate(`/acompanhamento/canais/${id}`)}
          onAbrirPerfil={() => void navigate("/acompanhamento/perfil")}
          initialMensagem={estado.mensagemAcompanhamento}
          onVoltarLista={(mensagem) =>
            void navigate(caminhos.acompanhamento, {
              state: { mensagemAcompanhamento: mensagem },
            })
          }
          onDetalheChange={setEmDetalheAcompanhamento}
        />
      )}
      {screen === "account" && (
        <ConfiguracoesConta
          embedded
          onBack={goHome}
          onAccountUpdated={() => setAccountVersion((n) => n + 1)}
          onEncerramentoSolicitado={(mensagem) => {
            logoutVoluntario.current = true;
            setLoginNotice(mensagem);
            window.dispatchEvent(new Event("auth:logout"));
          }}
          onAccountDeleted={() => {
            window.dispatchEvent(new Event("auth:logout"));
            setLoginNotice("Conta excluída com sucesso.");
          }}
        />
      )}
      {screen === "terms" && <TermosUso embedded onBack={goHome} />}
      {screen === "privacy" && <PoliticaPrivacidade embedded onBack={goHome} />}
    </HomeLayout>
  );
}
