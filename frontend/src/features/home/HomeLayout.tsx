import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { CircleUserRound, Menu, X } from "lucide-react";
import SinoNotificacoes from "../notificacoes/SinoNotificacoes";
import PageHeader from "../../components/PageHeader";
import { obterUsuarioAtual } from "../usuarios/apiUsuarios";
import "./HomeMenu.css";
import "./HomeLayout.css";

export type SecaoHome =
  | "home"
  | "results"
  | "questionnaire"
  | "acompanhamento"
  | "gestao"
  | "account"
  | "terms"
  | "privacy";

const titulos: Record<SecaoHome, string> = {
  home: "Biblioteca",
  results: "Resultados",
  questionnaire: "Questionários",
  acompanhamento: "Acompanhamento",
  account: "Minha conta",
  gestao: "Administração",
  terms: "Termos de Uso",
  privacy: "Política de Privacidade",
};

export default function HomeLayout({
  active,
  administrativo,
  children,
  onNavigate,
  onLogout,
  search,
  onSearchChange,
  accountVersion,
  onNotification,
  onBack,
}: {
  active: SecaoHome;
  administrativo: boolean;
  children: ReactNode;
  onNavigate: (section: SecaoHome) => void;
  onLogout: () => void;
  onBack?: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  accountVersion: number;
  onNotification: (destino: string, id: string) => void;
}) {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const [supremo, setSupremo] = useState(false);
  const retornoGestao =
    pathname === "/administracao/equipe/nova" ||
    (pathname.startsWith("/administracao/contas/") && state?.origemEquipe)
      ? "/administracao/equipe"
      : pathname.startsWith("/administracao/tutores/")
        ? "/administracao/tutores"
        : pathname !== "/administracao" &&
            pathname !== "/administracao/contas"
          ? "/administracao/contas"
          : null;
  const [menuRecolhido, setMenuRecolhido] = useState(
    () => window.matchMedia("(max-width: 900px)").matches,
  );
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const ajustar = () => setMenuRecolhido(media.matches);
    media.addEventListener("change", ajustar);
    return () => media.removeEventListener("change", ajustar);
  }, []);
  useEffect(() => {
    const fechar = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuRecolhido(true);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, []);
  const [accountName, setAccountName] = useState("Conta");

  const mainRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [active, pathname]);
  useEffect(() => {
    let activeRequest = true;
    obterUsuarioAtual()
      .then((user) => {
        if (activeRequest) {
          setAccountName(user.username || user.email);
          setSupremo(!!user.is_superuser);
        }
      })
      .catch(() => {});
    return () => {
      activeRequest = false;
    };
  }, [accountVersion]);
  function nav(section: SecaoHome) {
    return (
      <button
        className="home-nav-button"
        type="button"
        aria-current={active === section ? "page" : undefined}
        onClick={() => {
          onNavigate(section);
          if (window.matchMedia("(max-width: 900px)").matches)
            setMenuRecolhido(true);
        }}
      >
        {titulos[section]}
      </button>
    );
  }
  return (
    <div
      className={`home-layout home-layout--shared ${menuRecolhido ? "home-layout--recolhido" : "home-layout--aberto"}`}
    >
      {!menuRecolhido && (
        <button
          type="button"
          className="home-menu-fundo"
          aria-label="Fechar menu"
          onClick={() => setMenuRecolhido(true)}
        />
      )}
      <aside
        id="menu-principal"
        className="home-sidebar"
        aria-label="Menu principal"
        hidden={menuRecolhido}
      >
        <button
          className="home-menu-fechar"
          type="button"
          onClick={() => {
            setMenuRecolhido(true);
            menuButton.current?.focus();
          }}
          aria-label="Recolher menu"
        >
          <X size={20} />
        </button>
        <div className="home-brand">
          <div className="home-brand__logo">L</div>
          <strong>Locus</strong>
        </div>
        <nav aria-label={administrativo ? "Administração" : "Conteúdos"}>
          {administrativo ? (
            <>
              {[
                ["contas", "Contas e suporte"],
                ...(supremo ? [["equipe", "Equipe administrativa"]] : []),
                ["tutores", "Aprovação de tutores"],
                ["auditoria", "Auditoria"],
                ...(supremo ? [["documentos", "Documentos legais"]] : []),
              ].map(([aba, titulo]) => (
                <NavLink
                  key={aba}
                  className="home-nav-button"
                  to={`/administracao/${aba}`}
                  onClick={() => {
                    if (window.matchMedia("(max-width: 900px)").matches)
                      setMenuRecolhido(true);
                  }}
                >
                  {titulo}
                </NavLink>
              ))}
            </>
          ) : (
            <>
              {nav("home")}
              {nav("questionnaire")}
              {nav("results")}
              {nav("acompanhamento")}
            </>
          )}
        </nav>
        <nav className="home-sidebar__bottom" aria-label="Informações e sessão">
          {nav("terms")}
          {nav("privacy")}
          <button
            className="home-nav-button home-nav-button--logout"
            type="button"
            onClick={onLogout}
          >
            Sair
          </button>
        </nav>
      </aside>
      <div className="home-main" ref={mainRef}>
        <PageHeader
          title={
            active === "gestao"
              ? pathname.includes("/tutores")
                ? "Aprovação de tutores"
                : pathname.includes("/documentos")
                  ? "Documentos legais"
                : pathname.includes("/auditoria")
                  ? "Auditoria"
                  : pathname.includes("/equipe")
                    ? "Equipe administrativa"
                    : "Contas e suporte"
              : titulos[active]
          }
          onBack={
            onBack ??
            (administrativo && active === "gestao" && retornoGestao
              ? () => void navigate(retornoGestao)
              : undefined)
          }
          beforeTitle={
            menuRecolhido && (
              <button
                ref={menuButton}
                type="button"
                className="page-action home-menu-toggle"
                aria-controls="menu-principal"
                aria-expanded={false}
                onClick={() => setMenuRecolhido(false)}
                aria-label="Expandir menu"
              >
                <Menu size={20} aria-hidden="true" />
                <span>Menu</span>
              </button>
            )
          }
          center={
            active === "home" && (
              <input
                className="home-search"
                type="search"
                placeholder="Buscar seus conteúdos"
                aria-label="Buscar seus conteúdos"
                value={search}
                maxLength={150}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            )
          }
          actions={
            <>
              {!administrativo && <SinoNotificacoes onOpen={onNotification} />}
              <button
                type="button"
                className="home-account"
                title="Minha conta"
                aria-label={`Minha conta: ${accountName}`}
                aria-current={active === "account" ? "page" : undefined}
                onClick={() => onNavigate("account")}
              >
                <CircleUserRound size={19} aria-hidden="true" />
                <span>{accountName}</span>
              </button>
            </>
          }
        />
        <main className="home-view" key={active}>
          {children}
        </main>
      </div>
    </div>
  );
}
