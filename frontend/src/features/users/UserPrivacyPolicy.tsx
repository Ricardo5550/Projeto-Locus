import './UserLegal.css';
import './UserPrivacyPolicy.css';

type UserPrivacyPolicyProps = {
  onBack: () => void;
  backLabel?: string;
  requireReadConfirmation?: boolean;
  readConfirmed?: boolean;
  onReadConfirmedChange?: (checked: boolean) => void;
};

export default function UserPrivacyPolicy({
  onBack,
  backLabel = 'Voltar',
  requireReadConfirmation = false,
  readConfirmed = false,
  onReadConfirmedChange,
}: UserPrivacyPolicyProps) {
  return (
    <div className="legal-page privacy-legal-page">
      <article className="policy-container">
        <div className="legal-document__header">
          <span className="legal-document__brand">Locus</span>
          <h1>Política de Privacidade</h1>
          <p>Versão 1.0 — vigente a partir de 27 de setembro de 2026.</p>
        </div>

        <p>
          Esta Política de Privacidade explica, de forma clara, quais dados pessoais
          são tratados pelo Locus, para quais finalidades eles são utilizados, com
          quem podem ser compartilhados e como o titular pode exercer seus direitos.
        </p>

        <h2>1. Controlador e contato de privacidade</h2>
        <p>
          O controlador indicado para esta versão do Locus é <strong>Seliel Elias Nunes Filho</strong>,
          responsável pelas decisões referentes às finalidades e aos meios essenciais do
          tratamento de dados pessoais. Para dúvidas, solicitações ou exercício de direitos
          relacionados à privacidade, utilize o e-mail:
          {' '}<strong>11251402172@alunos.umc.br</strong>.
        </p>

        <h2>2. Encarregado pelo Tratamento de Dados Pessoais (DPO)</h2>
        <p>
          O Locus designou <strong>Ricardo dos Santos Ribeiro Filho</strong> como
          Encarregado pelo Tratamento de Dados Pessoais (DPO), responsável por atuar
          como canal de comunicação entre os titulares de dados, o controlador e a
          Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
        <p>
          Para dúvidas, solicitações ou assuntos relacionados à privacidade e à proteção
          de dados pessoais, entre em contato pelo e-mail:{' '}
          <a href="mailto:11232400596@alunos.umc.br">
            11232400596@alunos.umc.br
          </a>.
        </p>

        <h2>3. Dados pessoais e informações tratadas</h2>
        <p>O Locus pode tratar as seguintes categorias de dados e informações:</p>
        <ul>
          <li>nome de usuário e endereço de e-mail;</li>
          <li>
            credenciais e dados de autenticação, incluindo senha protegida por hash,
            status de confirmação do e-mail e informações técnicas de sessão;
          </li>
          <li>
            conteúdos criados pelo usuário, como anotações, mapas mentais, perguntas,
            respostas e tentativas de revisão;
          </li>
          <li>
            registros de auditoria necessários para segurança e rastreabilidade de
            ações relevantes realizadas na plataforma;
          </li>
          <li>
            registros da manifestação sobre documentos legais, incluindo versão do
            documento, data e hora, endereço IP e identificação do navegador
            (user-agent);
          </li>
          <li>
            dados técnicos necessários ao Google reCAPTCHA e termos de busca enviados
            à Crossref quando o usuário utiliza a busca de referências.
          </li>
        </ul>

        <h2>4. Finalidades do tratamento</h2>
        <p>Os dados são tratados para:</p>
        <ul>
          <li>criar, autenticar e administrar a conta;</li>
          <li>confirmar o endereço de e-mail e recuperar a senha;</li>
          <li>armazenar e disponibilizar os conteúdos de estudo criados pelo usuário;</li>
          <li>executar questionários e registrar o histórico de revisão;</li>
          <li>proteger a plataforma contra fraude, abuso e acesso não autorizado;</li>
          <li>registrar ações relevantes para auditoria e rastreabilidade;</li>
          <li>comprovar a versão dos documentos legais apresentada ao usuário;</li>
          <li>fornecer a busca de referências solicitada pelo usuário.</li>
        </ul>
        <p>
          O tratamento necessário à criação da conta e ao fornecimento das
          funcionalidades solicitadas é realizado para viabilizar a prestação do
          serviço. Atividades de segurança, auditoria e defesa de direitos são
          realizadas de acordo com a base legal aplicável a cada situação. Esta
          Política não utiliza um consentimento genérico como autorização para todo e
          qualquer tratamento de dados.
        </p>

        <h2>5. Compartilhamento e serviços externos</h2>
        <p>
          O Locus não vende dados pessoais para publicidade ou marketing. Alguns dados
          podem ser processados por prestadores necessários ao funcionamento do serviço,
          incluindo infraestrutura de hospedagem e banco de dados, Google reCAPTCHA,
          Crossref e o provedor utilizado para envio de e-mails. Cada integração recebe
          somente as informações necessárias à funcionalidade correspondente.
        </p>

        <h2>6. Armazenamento local, cookies e transferência internacional</h2>
        <p>
          O frontend utiliza armazenamento local do navegador para manter informações
          de autenticação necessárias à sessão. O Locus não utiliza cookies de marketing
          ou publicidade. Alguns provedores externos podem processar dados fora do Brasil;
          quando houver transferência internacional de dados pessoais, a implantação do
          serviço deverá observar os mecanismos aplicáveis previstos na LGPD e na
          regulamentação da Autoridade Nacional de Proteção de Dados.
        </p>

        <h2>7. Retenção e eliminação</h2>
        <p>
          Os dados são mantidos apenas pelo período necessário às finalidades descritas,
          à prestação do serviço, à segurança e ao cumprimento de obrigações ou exercício
          regular de direitos. Não é adotado um prazo fictício único para todos os tipos
          de informação. Solicitações de eliminação podem ser realizadas pelo canal de
          contato informado nesta Política e, quando a funcionalidade correspondente
          estiver disponível no perfil, também pela própria interface. Determinados
          registros podem ser preservados pelo período estritamente necessário quando
          houver fundamento legal ou necessidade legítima de segurança e auditoria.
        </p>

        <h2>8. Direitos do titular</h2>
        <p>
          Nos termos da legislação aplicável, o titular pode solicitar, conforme o caso,
          confirmação da existência de tratamento, acesso, correção, anonimização,
          bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade,
          portabilidade quando cabível, informações sobre compartilhamento, bem como
          revogação de consentimento quando essa for a base legal utilizada.
        </p>

        <h2>9. Segurança da informação</h2>
        <p>
          O Locus utiliza controles de autenticação e autorização, isolamento de dados
          por usuário, hash seguro de senhas e registros de auditoria. Na implantação
          publicada, a comunicação deve utilizar HTTPS. Nenhuma medida de segurança é
          absoluta; incidentes relevantes serão avaliados e tratados conforme a LGPD e
          a regulamentação aplicável.
        </p>

        <h2>10. Atualizações desta Política</h2>
        <p>
          Esta Política poderá ser atualizada para refletir mudanças no sistema ou no
          tratamento de dados. Alterações relevantes serão apresentadas de forma
          destacada. Quando necessário, o Locus solicitará nova manifestação sobre a
          versão atualizada.
        </p>

        {requireReadConfirmation && (
          <label className="privacy-read-confirmation">
            <input
              type="checkbox"
              checked={readConfirmed}
              onChange={(event) => onReadConfirmedChange?.(event.target.checked)}
            />
            <span>
              Confirmo que li esta Política de Privacidade até o final e estou ciente
              das informações apresentadas.
            </span>
          </label>
        )}

        <div className="legal-document__footer">
          <strong>Política de Privacidade — versão 1.0</strong>
          <button
            type="button"
            className="legal-back-button"
            onClick={onBack}
          >
            {backLabel}
          </button>
        </div>
      </article>
    </div>
  );
}
