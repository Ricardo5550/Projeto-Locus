from django.db import migrations


def publicar_politica(apps, schema_editor):
    politica = apps.get_model('usuarios', 'PoliticaPrivacidade')
    politica.objects.using(schema_editor.connection.alias).get_or_create(
        versao='1.4',
        defaults={
            'conteudo': """Esta Política de Privacidade explica, de forma clara, quais dados pessoais são tratados pelo Locus, para quais finalidades eles são utilizados, com quem podem ser compartilhados e como o titular pode exercer seus direitos.

## 1. Controlador e contato de privacidade

O controlador indicado para esta versão do Locus é Seliel Elias Nunes Filho, responsável pelas decisões referentes às finalidades e aos meios essenciais do tratamento de dados pessoais. Para dúvidas, solicitações ou exercício de direitos relacionados à privacidade, utilize o e-mail: 11251402172@alunos.umc.br.

## 2. Encarregado pelo Tratamento de Dados Pessoais (DPO)

O Locus designou Ricardo dos Santos Ribeiro Filho como Encarregado pelo Tratamento de Dados Pessoais (DPO), responsável por atuar como canal de comunicação entre os titulares de dados, o controlador e a Autoridade Nacional de Proteção de Dados (ANPD).

Para dúvidas, solicitações ou assuntos relacionados à privacidade e à proteção de dados pessoais, entre em contato pelo e-mail: 11232400596@alunos.umc.br.

## 3. Dados pessoais e informações tratadas

O Locus pode tratar as seguintes categorias de dados e informações:

• nome de usuário e endereço de e-mail;

• credenciais e dados de autenticação, incluindo senha protegida por hash, status de confirmação do e-mail e informações técnicas de sessão;

• conteúdos criados pelo usuário, como anotações, mapas mentais, perguntas, respostas e tentativas de revisão;

• dados do perfil de tutor, incluindo as informações de apresentação, formação e links de comprovantes fornecidos pelo usuário para análise da solicitação;

• registros de auditoria necessários para segurança e rastreabilidade de ações relevantes realizadas na plataforma;

• registros da manifestação sobre documentos legais, incluindo versão do documento, data e hora, endereço IP e identificação do navegador (user-agent);

• dados técnicos necessários ao Google reCAPTCHA e termos de busca enviados à Crossref quando o usuário utiliza a busca de referências.

## 4. Finalidades do tratamento

Os dados são tratados para:

• criar, autenticar e administrar a conta;

• analisar solicitações de tutoria e disponibilizar o acompanhamento aos perfis aprovados;

• confirmar o endereço de e-mail e recuperar a senha;

• armazenar e disponibilizar os conteúdos de estudo criados pelo usuário;

• executar questionários e registrar o histórico de revisão;

• proteger a plataforma contra fraude, abuso e acesso não autorizado;

• registrar ações relevantes para auditoria e rastreabilidade;

• comprovar a versão dos documentos legais apresentada ao usuário;

• fornecer a busca de referências solicitada pelo usuário.

O tratamento necessário à criação da conta e ao fornecimento das funcionalidades solicitadas é realizado para viabilizar a prestação do serviço. Atividades de segurança, auditoria e defesa de direitos são realizadas de acordo com a base legal aplicável a cada situação. Esta Política não utiliza um consentimento genérico como autorização para todo e qualquer tratamento de dados.

## 5. Compartilhamento e serviços externos

O Locus não vende dados pessoais para publicidade ou marketing. Alguns dados podem ser processados por prestadores necessários ao funcionamento do serviço, incluindo infraestrutura de hospedagem e banco de dados, Google reCAPTCHA, Crossref e o provedor utilizado para envio de e-mails. Cada integração recebe somente as informações necessárias à funcionalidade correspondente.

## 6. Cookies e transferência internacional

O Locus usa cookies HttpOnly para manter a sessão de autenticação. O Locus não usa cookies próprios para publicidade ou marketing. Alguns prestadores externos podem processar dados fora do Brasil. Quando houver transferência internacional, aplicam-se os mecanismos previstos na LGPD e na regulamentação da ANPD.

## 7. Retenção e eliminação

A retenção considera a finalidade do tratamento. Quando você exclui um conteúdo no Locus, a aplicação remove seus campos de texto, imagens incorporadas e estruturas de conteúdo da base ativa, de acordo com o tipo de material. O sistema pode manter o identificador, a data da exclusão e os vínculos técnicos necessários para registrar a operação.

A devolutiva usa os enunciados, as respostas e as classificações registrados ao finalizar a revisão. A exclusão de uma pergunta ou anotação de origem preserva a devolutiva mais recente do questionário. Ao finalizar uma nova sessão, inclusive um treino, o sistema remove os enunciados, textos de respostas e referências de anotação da devolutiva anterior. O histórico mantém dados da sessão, como data e totais, para o acompanhamento do desempenho. O agendamento da revisão utiliza somente as revisões programadas. Ao excluir o questionário, as sessões correspondentes deixam de ser exibidas e o conteúdo das respostas é removido.

Ao encerrar sua conta na interface, o Locus desativa o acesso, substitui os dados de identificação da conta e remove o conteúdo dos materiais de estudo, das revisões e do perfil de tutor. Também esvazia o nome dos seus canais de acompanhamento e apaga o texto das mensagens que você escreveu. Os registros de auditoria e das manifestações sobre documentos legais são preservados para rastreabilidade. As solicitações relativas a esses dados podem ser encaminhadas ao contato desta Política.

O tratamento de dados pessoais termina nas hipóteses previstas na LGPD. Após o término, a conservação observa as hipóteses admitidas pela legislação. Pedidos de eliminação de dados pessoais podem ser encaminhados pelo canal de privacidade informado nesta Política.

## 8. Direitos do titular

Nos termos da legislação aplicável, o titular pode solicitar, conforme o caso, confirmação da existência de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade, portabilidade quando cabível, informações sobre compartilhamento, bem como revogação de consentimento quando essa for a base legal utilizada.

## 9. Segurança da informação

O Locus utiliza controles de autenticação e autorização, isolamento de dados por usuário, hash seguro de senhas e registros de auditoria. Na implantação publicada, a comunicação deve utilizar HTTPS. Nenhuma medida de segurança é absoluta; incidentes relevantes serão avaliados e tratados conforme a LGPD e a regulamentação aplicável.

## 10. Atualizações desta Política

Esta Política poderá ser atualizada para refletir mudanças no sistema ou no tratamento de dados. Alterações relevantes serão apresentadas de forma destacada. O Locus solicitará a confirmação de leitura da versão vigente antes de concluir o login."""
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ('usuarios', '0003_politica_exclusao_de_conteudo'),
        ('revisoes', '0003_limitar_detalhes_devolutivas'),
    ]
    operations = [migrations.RunPython(publicar_politica, migrations.RunPython.noop)]
