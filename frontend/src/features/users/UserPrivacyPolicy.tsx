import './UserPrivacyPolicy.css';

export default function UserPrivacyPolicy() {
  return (
    <div className="page-background">
        <div className="policy-container">
            <h1>Política de Privacidade</h1>
            <p>
                Uma das principais prioridades do Locus é a Privacidade. O objetivo desta Política de Privacidade é explicar, de forma transparente, quais dados pessoais são coletados, por que eles são necessários para que a plataforma funcione e como são protegidos. O Locus adota o princípio de coletar apenas o mínimo de dados necessário para o funcionamento, garantindo que o estudante tenha controle total sobre o próprio perfil.
            </p>

            <h2>Responsáveis pelo tratamento</h2>
            <p>
                O controlador da plataforma é Seliel Elias Nunes Filho. E-mail para contato: 11251402172@alunos.umc.br

                O operador da plataforma é Ricardo dos Santos Ribeiro Filho. E-mail para contato: 11232400596@alunos.umc.br
                
                Em uma implantação real no Mercado, a instituição de ensino, escola, universidade ou organização educacional que contratar os serviços da plataforma assumirá o papel legal de Controladora.
            </p>

            <h2>Dados pessoais tratados</h2>
            <p>
                O Locus adota o princípio da minimização de dados, coletando apenas as informações necessárias para a criação da conta. As categorias tratadas são:
            </p>
            <ul>
                <li>Dado de Identificação: nome de usuário.</li>
                <li>Dado de contato: e-mail.</li>
            </ul>

            <h2>Finalidades e hipóteses legais</h2>
            <p>
                O Locus utiliza o nome de usuário para registrar a conta, criar o perfil e garantir o direito à edição, correção e exclusão. A plataforma também utiliza o endereço de e-mail para autenticar a conta, verificar a conta, enviar mensagens de recuperação de senha e comunicar alterações importantes. A hipótese legal para estas finalidades é a Execução de Contrato, pois o fornecimento do endereço de e-mail e do nome de usuário é um requisito técnico de suma importância, ou seja, sem estas informações, o sistema não consegue prestar os serviços solicitados pelo estudante.
            </p>

            <h2>Compartilhamento e serviços externos</h2>
            <p>
                O Locus não vende, não aluga e não compartilha dados com terceiros para nenhuma finalidade comercial, de publicidade ou de marketing. Para garantir o funcionamento, o armazenamento seguro e a disponibilidade do sistema na internet, os dados são processados e hospedados utilizando os serviços de infraestrutura, em nuvem, do provedor Render, atuando com o Banco de Dados em nuvem PostgreSQL.
            </p>

            <h2>Transferência internacional e cookies</h2>
            <p>
                O Locus utiliza os serviços de hospedagem em nuvem do provedor Render. Devido a esta infraestrutura, os dados podem ser transferidos e armazenados em servidores localizados fora do Brasil. Esta transferência é resguardada pelas políticas de segurança e proteção de dados do provedor. O Locus não utiliza cookies opcionais, de marketing ou de rastreamento. O sistema emprega apenas o armazenamento necessário exclusivamente para gerenciar as sessões de autenticação e manter a segurança do estudante enquanto ele navega. Portanto, a plataforma não requer a exibição de banners de consentimento.
            </p>

            <h2>Retenção e descarte</h2>
            <p>
                Os dados são retidos no Banco de Dados pelo período de um dia, configurando uma Política para evitar o acúmulo desnecessário de registros. Independentemente deste prazo, o descarte imediato dos dados do estudante ocorrerá a qualquer instante caso o mesmo acione voluntariamente a função de excluir sua conta nas configurações do seu perfil. O Locus mantém os arquivos do estudante por uma semana, até a exclusão definitiva dos mesmos.
            </p>

            <h2>Direitos dos titulares</h2>
            <p>
                O Locus garante aos estudantes o controle total sobre seus dados, permitindo o exercício dos direitos previstos na LGPD de forma autônoma pela interface do sistema. Através do seu painel de perfil, o usuário pode realizar a qualquer momento:
            </p>
            <ul>
                <li><strong>Acesso e Confirmação:</strong> visualizar seus dados registrados.</li>
                <li><strong>Correção:</strong> atualizar, editar e corrigir seu nome de usuário ou e-mail caso estejam incompletos ou desatualizados.</li>
                <li><strong>Anonimização, Bloqueio ou Eliminação:</strong> o Locus assegura este direito através da funcionalidade de exclusão da conta, que elimina os dados pessoais, de forma imediata, do Banco de Dados, não realizando a retenção de dados anonimizados para fins estatísticos ou comerciais.</li>
            </ul>
            <p>
                Para solicitações adicionais ou dúvidas sobre privacidade, o titular pode entrar em contato através do e-mail oficial do controlador da plataforma: 11251402172@alunos.umc.br
            </p>

            <h2>Segurança contra incidentes e versões</h2>
            <p>
                O Locus adota boas práticas de segurança da informação, utilizando algoritmos de hash para a proteção de senhas e protocolos de tráfego seguro para proteger os dados contra acessos não autorizados. Em caso de qualquer incidente de segurança que gere risco ou dano relevante aos titulares, a equipe do Locus se compromete a avaliar a extensão do vazamento e a comunicar formalmente a Autoridade Nacional de Proteção de Dados (ANPD) e os estudantes afetados, em conformidade com os prazos e exigências da LGPD. A presente Política de Privacidade poderá passar por atualizações. Caso ocorram mudanças significativas na forma de tratamento dos dados, os estudantes serão notificados de forma destacada através da plataforma ou pelo e-mail registrado antes que as novas regras entrem em vigor.
            </p>
            
            <br />
            <p><strong>Versão 1.0 - Atualizada em 27 de setembro de 2026</strong></p>
        </div>
    </div>
    
  );
}