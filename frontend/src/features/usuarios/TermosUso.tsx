import PageHeader, { BackButton } from '../../components/PageHeader';
import './DocumentosLegais.css';
import './TermosUso.css';

type TermosUsoProps = {
  onBack: () => void;
  embedded?: boolean;
  backLabel?: string;
};

export default function TermosUso({
  onBack,
  backLabel = 'Voltar',
  embedded = false,
}: TermosUsoProps) {
  return (
    <div className={`legal-page${embedded ? ' is-embedded' : ''}`}>
      {!embedded && (
        <PageHeader title="Termos de Uso" actions={<BackButton onClick={onBack} label={backLabel} />} />
      )}
      <article className="terms-container">
        <div className="legal-document__header">
          <div className="legal-document__topo">
            {embedded && <BackButton onClick={onBack} label={backLabel} />}
            <span className="legal-document__brand">Locus</span>
            
          </div>
          <h1>Termos de Uso</h1>
          <p>Versão 1.0 — vigente a partir de 27 de setembro de 2026.</p>
        </div>

        <h2>1. Sobre o Locus</h2>
        <p>
          O Locus é uma plataforma web de apoio à organização e à revisão de conteúdos de estudo.
          A plataforma permite criar e relacionar anotações e mapas mentais, organizar materiais em pastas e utilizar questionários com revisões programadas.
          O usuário também pode compartilhar materiais com tutores e receber comentários nos canais de acompanhamento.
          No cadastro, o usuário aceita estes Termos de Us9p0o e declara ciência da Política de Privacidade.
        </p>

        <h2>2. Conta e segurança</h2>
        <p>
          O usuário é responsável por fornecer informações corretas no cadastro,
          manter sua senha em sigilo e não compartilhar o acesso à conta. As senhas
          não são armazenadas em texto puro: o sistema utiliza os mecanismos de hash
          seguro fornecidos pelo Django. O usuário deve comunicar qualquer suspeita
          de acesso não autorizado.
        </p>

        <h2>3. Uso adequado da plataforma</h2>
        <p>
          É proibido utilizar o Locus para praticar atos ilícitos, tentar obter acesso
          não autorizado a contas ou sistemas, explorar vulnerabilidades, prejudicar
          deliberadamente a disponibilidade do serviço ou inserir conteúdo que viole
          a legislação aplicável ou direitos de terceiros.
        </p>

        <h2>4. Conteúdo criado pelo usuário</h2>
        <p>
          O usuário mantém a titularidade sobre os conteúdos que cria, como anotações,
          mapas mentais, perguntas e respostas de revisão. O Locus trata esses conteúdos
          somente na medida necessária para armazená-los, exibi-los, relacioná-los e
          fornecer as funcionalidades solicitadas pelo próprio usuário, conforme a
          Política de Privacidade.
        </p>

        <h2>5. Acompanhamento por tutores</h2>
         <p>
            O estudante decide quem convidar para o acompanhamento, e cada tutor decide se aceita o convite.
            O Locus disponibiliza a busca de perfis, o envio de convites e a troca de comentários.
            As informações de formação e os links de diplomas ou certificados são fornecidos pelo próprio tutor.
            O Locus não verifica a autenticidade dessas informações nem garante a disponibilidade do tutor, a qualidade da orientação ou resultados de aprendizagem. 
            Permanecem aplicáveis os direitos dos usuários e as responsabilidades da plataforma previstas em lei.
            Ao compartilhar um mapa mental, o estudante permite que os tutores com acesso ativo ao canal consultem 
            o mapa e as anotações vinculadas aos seus blocos. Os materiais compartilhados ficam disponíveis para leitura. 
            Os comentários são registrados no canal, sem alterar o material original.
        </p>

        <h2>6. Serviços de terceiros</h2>
        <p>
          Algumas funcionalidades dependem de serviços externos, como Google reCAPTCHA
          para proteção do acesso, Crossref para busca de referências e um provedor de
          e-mail para confirmação de conta e recuperação de senha. A utilização desses
          recursos pode envolver o envio dos dados estritamente necessários para a
          execução da funcionalidade.
        </p>

        <h2>7. Disponibilidade e alterações</h2>
        <p>
          O Locus pode passar por manutenções, atualizações ou indisponibilidades
          temporárias. Funcionalidades podem ser corrigidas ou alteradas para melhorar
          segurança, desempenho e funcionamento. Alterações relevantes nestes Termos
          serão apresentadas de forma destacada e uma nova versão poderá exigir nova
          manifestação do usuário.
        </p>

        <h2>8. Suspensão e encerramento</h2>
        <p>
          Contas que violem estes Termos ou sejam utilizadas de forma a comprometer a
          segurança da plataforma poderão ser suspensas ou encerradas, observadas as
          circunstâncias do caso. O tratamento de dados associado ao encerramento da
          conta seguirá a Política de Privacidade e as obrigações legais aplicáveis.
        </p>

        <h2>9. Privacidade</h2>
        <p>
          O tratamento de dados pessoais realizado pelo Locus é descrito na Política de
          Privacidade. A aceitação destes Termos não constitui autorização genérica para
          qualquer tratamento de dados pessoais além das finalidades e bases legais
          informadas naquela política.
        </p>

        <div className="legal-document__footer">
          <strong>Termos de Uso — versão 1.0</strong>
        </div>
      </article>
    </div>
  );
}
