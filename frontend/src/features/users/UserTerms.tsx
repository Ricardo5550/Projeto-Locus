import './UserTerms.css';

export default function UserTerms() {
  return (
    <div className="page-background">
      <div className="terms-container">
        <h1>Termos de Uso</h1>
        
        <h2>O que é a plataforma e suas limitações</h2>
        <p>
          O Locus é uma plataforma web de apoio educacional para a criação e organização de anotações, assim como para a revisão de estudos. Por ser um projeto acadêmico em desenvolvimento, o sistema não garante uma disponibilidade totalmente ininterrupta, podendo passar por instabilidades.
        </p>

        <h2>A Conta e a Responsabilidade da Senha</h2>
        <p>
          O sistema é voltado para o público estudantil. A senha de cada estudante é pessoal, criptografada e intransferível, sendo o próprio estudante o único responsável por não compartilhar o seu acesso com terceiros.
        </p>

        <h2>Regras de Conduta e Proibições</h2>
        <p>
          É expressamente proibido usar o Locus para fins ilegais, tentar invadir a plataforma, sobrecarregar o Banco de Dados de propósito ou criar anotações com conteúdos criminosos ou ofensivos.
        </p>

        <h2>O Conteúdo do Estudante</h2>
        <p>
          As anotações pertencem inteiramente ao estudante. O Locus não é dono das anotações do estudante e não vai usar os conteúdos dele para nenhuma outra finalidade. O sistema apenas armazena o que o estudante cria.
        </p>

        <h2>Manutenção e Encerramento da Conta</h2>
        <p>
          Como o Locus estará hospedado em nuvem através do provedor Render, a plataforma pode passar por manutenções técnicas, eventualmente. Se o estudante violar as regras de conduta, como tentar hackear o sistema, a conta dele será banida e excluída imediatamente.
        </p>

        <br />
        <p><strong>Versão 1.0 - Atualizada em 27 de setembro de 2026</strong></p>
      </div>
    </div>
  );
}

