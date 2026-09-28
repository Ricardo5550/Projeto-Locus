import './UserLegal.css';
import './UserTerms.css';

type UserTermsProps = {
  onBack: () => void;
  backLabel?: string;
};

export default function UserTerms({
  onBack,
  backLabel = 'Voltar',
}: UserTermsProps) {
  return (
    <div className="legal-page">
      <article className="terms-container">
        <div className="legal-document__header">
          <span className="legal-document__brand">Locus</span>
          <h1>Termos de Uso</h1>
          <p>Versão 1.0 — vigente a partir de 27 de setembro de 2026.</p>
        </div>

        <h2>1. Sobre o Locus</h2>
        <p>
          O Locus é uma plataforma web de apoio aos estudos que permite criar,
          organizar e relacionar anotações, mapas mentais e conteúdos de revisão.
          Ao criar uma conta e utilizar a plataforma, o usuário concorda com estes
          Termos de Uso.
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

        <h2>5. Serviços de terceiros</h2>
        <p>
          Algumas funcionalidades dependem de serviços externos, como Google reCAPTCHA
          para proteção do acesso, Crossref para busca de referências e um provedor de
          e-mail para confirmação de conta e recuperação de senha. A utilização desses
          recursos pode envolver o envio dos dados estritamente necessários para a
          execução da funcionalidade.
        </p>

        <h2>6. Disponibilidade e alterações</h2>
        <p>
          O Locus pode passar por manutenções, atualizações ou indisponibilidades
          temporárias. Funcionalidades podem ser corrigidas ou alteradas para melhorar
          segurança, desempenho e funcionamento. Alterações relevantes nestes Termos
          serão apresentadas de forma destacada e uma nova versão poderá exigir nova
          manifestação do usuário.
        </p>

        <h2>7. Suspensão e encerramento</h2>
        <p>
          Contas que violem estes Termos ou sejam utilizadas de forma a comprometer a
          segurança da plataforma poderão ser suspensas ou encerradas, observadas as
          circunstâncias do caso. O tratamento de dados associado ao encerramento da
          conta seguirá a Política de Privacidade e as obrigações legais aplicáveis.
        </p>

        <h2>8. Privacidade</h2>
        <p>
          O tratamento de dados pessoais realizado pelo Locus é descrito na Política de
          Privacidade. A aceitação destes Termos não constitui autorização genérica para
          qualquer tratamento de dados pessoais além das finalidades e bases legais
          informadas naquela política.
        </p>

        <div className="legal-document__footer">
          <strong>Termos de Uso — versão 1.0</strong>
          <button type="button" className="legal-back-button" onClick={onBack}>
            {backLabel}
          </button>
        </div>
      </article>
    </div>
  );
}
