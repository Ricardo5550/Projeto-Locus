import { useContext, useState, type FormEvent } from "react";
import { ContextoGestao } from "./contextoGestao";
import { useDadosGestao } from "./useDadosGestao";
import { dataGestao, type PaginaGestao } from "./apiGestao";
import { apiJson, encerrarSessao } from "../../services/apiClient";
import { useDialogos } from "../../components/contextoDialogos";

type TipoDocumento = "termos" | "privacidade";
type Documento = { versao: string; conteudo: string; publicada_em: string };
type Documentos = Record<TipoDocumento, Documento>;
const nomes: Record<TipoDocumento, string> = {
  termos: "Termos de Uso",
  privacidade: "Política de Privacidade",
};

export default function DocumentosGestao() {
  const supremo = useContext(ContextoGestao);
  return supremo ? (
    <ConteudoDocumentos />
  ) : (
    <p role="alert">Somente administradores supremos podem gerenciar os documentos legais.</p>
  );
}

function ConteudoDocumentos() {
  const consulta = useDadosGestao<Documentos>("/gestao/documentos/");
  const [tipo, setTipo] = useState<TipoDocumento>("termos");
  if (consulta.carregando) return <p role="status">Carregando documentos…</p>;
  if (consulta.erro)
    return (
      <>
        <p className="gestao-erro" role="alert">{consulta.erro}</p>
        <button className="page-action" onClick={consulta.atualizar}>Tentar novamente</button>
      </>
    );
  if (!consulta.dados) return null;
  return (
    <EditorDocumento
      key={tipo}
      tipo={tipo}
      atual={consulta.dados[tipo]}
      onTipo={setTipo}
    />
  );
}

function HistoricoDocumentos({
  tipo,
  versaoAtual,
}: {
  tipo: TipoDocumento;
  versaoAtual: string;
}) {
  const [pagina, setPagina] = useState(1);
  const [selecionada, setSelecionada] = useState("");
  const consulta = useDadosGestao<
    PaginaGestao<Pick<Documento, "versao" | "publicada_em">>
  >(`/gestao/documentos/?tipo=${tipo}&pagina=${pagina}`);

  function mudarPagina(numero: number) {
    setSelecionada("");
    setPagina(numero);
  }

  return (
    <section className="gestao-cartao" aria-label="Histórico de documentos">
      <h3>Versões publicadas</h3>

      {consulta.carregando && <p role="status">Carregando versões…</p>}
      {consulta.erro && <p role="alert">{consulta.erro}</p>}

      {consulta.dados && (
        <>
          <ul>
            {consulta.dados.itens.map((item) => (
              <li key={item.versao}>
                <button
                  type="button"
                  className="page-action"
                  onClick={() => setSelecionada(item.versao)}
                >
                  Ver versão {item.versao}
                </button>
                {" · "}
                {dataGestao(item.publicada_em)}
                {item.versao === versaoAtual && " · Vigente"}
              </li>
            ))}
          </ul>

          <div className="gestao-decisoes">
            <button
              type="button"
              className="page-action"
              disabled={pagina <= 1}
              onClick={() => mudarPagina(pagina - 1)}
            >
              Anterior
            </button>
            <span>
              Página {consulta.dados.pagina} de{" "}
              {consulta.dados.total_paginas}
            </span>
            <button
              type="button"
              className="page-action"
              disabled={pagina >= consulta.dados.total_paginas}
              onClick={() => mudarPagina(pagina + 1)}
            >
              Próxima
            </button>
          </div>
        </>
      )}

      {selecionada && (
        <VersaoHistorica
          key={`${tipo}-${selecionada}`}
          tipo={tipo}
          versao={selecionada}
          onFechar={() => setSelecionada("")}
        />
      )}
    </section>
  );
}

function VersaoHistorica({
  tipo,
  versao,
  onFechar,
}: {
  tipo: TipoDocumento;
  versao: string;
  onFechar: () => void;
}) {
  const consulta = useDadosGestao<Documento>(
    `/gestao/documentos/?tipo=${tipo}&versao=${encodeURIComponent(versao)}`,
  );

  return (
    <section aria-label={`Leitura da versão ${versao}`}>
      <h4>{nomes[tipo]} — versão {versao}</h4>

      {consulta.carregando && <p role="status">Carregando texto…</p>}
      {consulta.erro && <p role="alert">{consulta.erro}</p>}

      {consulta.dados && (
        <div
          className="gestao-descricao"
          style={{ overflowWrap: "anywhere" }}
        >
          {consulta.dados.conteudo}
        </div>
      )}

      <button type="button" className="page-action" onClick={onFechar}>
        Fechar versão
      </button>
    </section>
  );
}

function EditorDocumento({ tipo, atual, onTipo }: {
  tipo: TipoDocumento;
  atual: Documento;
  onTipo: (tipo: TipoDocumento) => void;
}) {
  const dialogos = useDialogos();
  const [versao, setVersao] = useState("");
  const [conteudo, setConteudo] = useState(atual.conteudo);
  const [senha, setSenha] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [publicado, setPublicado] = useState(false);

  async function publicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (processando || publicado) return;
    setProcessando(true);
    setErro("");
    try {
      const confirmou = await dialogos.confirmar(
        `Publicar ${nomes[tipo]}, versão ${versao.trim()}? A publicação é imediata e não pode ser editada. Todas as contas, inclusive a sua, precisarão confirmar os documentos atualizados no próximo acesso.`,
      );
      if (!confirmou) return;
      await apiJson("/gestao/documentos/", {
        method: "POST",
        body: JSON.stringify({ tipo, versao, conteudo, senha_atual: senha }),
      });
      setPublicado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível publicar o documento.");
    } finally {
      setSenha("");
      setProcessando(false);
    }
  }

  if (publicado)
    return (
      <section className="gestao-cartao" aria-label="Documento publicado">
        <h2>Documento publicado</h2>
        <p className="gestao-aviso" role="status">
          {nomes[tipo]}, versão {versao.trim()}, publicado com sucesso.
          As versões anteriores e os registros de aceite foram preservados.
        </p>
        <p>Entre novamente para confirmar os documentos atualizados e continuar na administração.</p>
        <button
          className="page-action is-primary"
          disabled={processando}
          onClick={async () => {
            setProcessando(true);
            setErro("");
            try {
              await encerrarSessao();
            } catch {
              setErro("Não foi possível encerrar a sessão. Tente novamente.");
              setProcessando(false);
            }
          }}
        >Entrar novamente</button>
        {erro && <p className="gestao-erro" role="alert">{erro}</p>}
      </section>
    );

  return (
    <>
      <h2>Publicar documento legal</h2>
      <p>
        Cada publicação cria uma nova versão e exige nova confirmação das contas.
      </p>
      
      <form className="gestao-formulario gestao-documentos" onSubmit={(e) => void publicar(e)}>
        <label htmlFor="documento-tipo">Documento</label>
          <select id="documento-tipo" value={tipo} disabled={processando} onChange={async (e) => {
            const proximo = e.target.value as TipoDocumento;
            if (proximo === tipo) return;
            if ((versao || conteudo !== atual.conteudo) && !(await dialogos.confirmar("Trocar de documento e descartar as alterações não publicadas?"))) return;
            onTipo(proximo);
          }}>
            <option value="termos">Termos de Uso</option>
            <option value="privacidade">Política de Privacidade</option>
          </select>
        <p>Versão vigente: <strong>{atual.versao}</strong> · Publicada em {dataGestao(atual.publicada_em)}</p>
        <label htmlFor="documento-versao">Nova versão</label>
        <input id="documento-versao" value={versao} maxLength={20} required disabled={processando} placeholder="Ex.: 1.4" onChange={(e) => setVersao(e.target.value)} />
        <label htmlFor="documento-conteudo">Conteúdo</label>
        <textarea id="documento-conteudo" value={conteudo} minLength={10} maxLength={100000} rows={18} required disabled={processando} onChange={(e) => setConteudo(e.target.value)} />

        <label htmlFor="documento-senha">Sua senha atual</label>
        <input id="documento-senha" type="password" value={senha} maxLength={1024} required disabled={processando} autoComplete="current-password" onChange={(e) => setSenha(e.target.value)} />
        {erro && <p className="gestao-erro" role="alert">{erro}</p>}
        <button className="page-action is-primary" type="submit" disabled={processando}>
          {processando ? "Processando…" : "Publicar nova versão"}
        </button>

          <HistoricoDocumentos tipo={tipo} versaoAtual={atual.versao} />

      </form>
        
      
    </>
  );

}
