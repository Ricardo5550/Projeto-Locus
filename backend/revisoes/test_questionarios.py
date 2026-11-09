from datetime import timedelta
from decimal import Decimal
from uuid import uuid4
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from anotacoes.models import Anotacao
from notificacoes.models import Notificacao
from .models import Materia, Questionario, Pergunta, SessaoRevisao
from .agendamento import calcular_revisao


class AgendamentoTests(TestCase):
    def test_faixas_e_parciais_sem_arredondamento(self):
        for a,p,q in [(0,0,0),(2,0,1),(4,0,2),(6,0,3),(8,0,4),(10,0,5),(6,2,3),(0,10,2)]:
            self.assertEqual(calcular_revisao(a,p,10,Decimal('2.5'),0,0)[0],q)

    def test_intervalos_ordem_e_limite(self):
        self.assertEqual(calcular_revisao(8,0,10,Decimal('2.5'),0,0)[3],1)
        self.assertEqual(calcular_revisao(8,0,10,Decimal('2.5'),1,1)[3],6)
        self.assertEqual(calcular_revisao(8,0,10,Decimal('2.5'),2,6)[3],15)
        self.assertEqual(calcular_revisao(8,0,10,Decimal('2.5'),3,15)[3],38)
        self.assertEqual(calcular_revisao(8,0,10,Decimal('2.5'),3,15,20)[3],20)

    def test_falha_e_minimo(self):
        _,ef,n,d=calcular_revisao(0,0,10,Decimal('1.3'),8,100)
        self.assertEqual((ef,n,d),(Decimal('1.3'),0,1))


class QuestionariosTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user=get_user_model().objects.create_user('aluno','aluno@example.test','Senha123!')
        self.outro=get_user_model().objects.create_user('outro','outro@example.test','Senha123!')
        self.client=APIClient();self.client.force_authenticate(self.user)
        self.m=Materia.objects.create(autor=self.user,nome='Biologia')
        self.q=Questionario.objects.create(autor=self.user,titulo='Células',materia=self.m)
        self.n=Anotacao.objects.create(autor=self.user,titulo='Citologia',conteudo={'type':'doc','content':[]})
        self.p=Pergunta.objects.create(questionario=self.q,anotacao=self.n,enunciado='Pergunta original',resposta='Resposta original')

    def dados(self,resultado='acertei',**kw):
        return {'chave':str(uuid4()),'versao':self.q.versao,'respostas':[{'pergunta':self.p.pk,'resposta_digitada':'Minha resposta','resultado':resultado}],**kw}

    def finalizar(self,data=None):return self.client.post(f'/api/questionarios/{self.q.pk}/finalizar/',data or self.dados(),format='json')

    def test_so_finalizar_contabiliza_e_idempotencia(self):
        self.client.get(f'/api/questionarios/{self.q.pk}/')
        self.assertFalse(SessaoRevisao.objects.exists())
        d=self.dados();r=self.finalizar(d);self.assertEqual(r.status_code,201,r.data)
        self.assertEqual(self.finalizar(d).status_code,200)
        self.assertEqual(SessaoRevisao.objects.count(),1)
        self.q.refresh_from_db();self.assertEqual(self.q.proxima_revisao,timezone.localdate()+timedelta(days=1))

    def test_finalizacao_incompleta_nao_grava(self):
        r=self.finalizar(self.dados(respostas=[]));self.assertEqual(r.status_code,400)
        self.q.refresh_from_db();self.assertIsNone(self.q.ultima_revisao);self.assertFalse(SessaoRevisao.objects.exists())

    def test_parcial_e_treino(self):
        r=self.finalizar(self.dados('parcial',treino=True));self.assertEqual(r.status_code,201,r.data)
        self.q.refresh_from_db();self.assertIsNone(self.q.proxima_revisao)
        self.assertEqual(self.client.get(f'/api/questionarios/{self.q.pk}/devolutiva/').data, {'vazia': True})
        self.assertEqual(self.client.get('/api/resultados/').data['total'],0)

    def test_revisao_antecipada_apenas_treino(self):
        self.finalizar()
        self.assertEqual(self.finalizar().status_code,400)
        self.assertEqual(self.finalizar(self.dados(treino=True)).status_code,201)

    def test_snapshot_edicao_e_nova_sessao(self):
        self.finalizar()
        url=f'/api/perguntas/{self.p.pk}/'
        self.assertEqual(self.client.patch(url,{'enunciado':'Alterada'},format='json').status_code,400)
        r=self.client.patch(url,{'enunciado':'Alterada','confirmar_reinicio':True},format='json');self.assertEqual(r.status_code,200,r.data)
        self.q.refresh_from_db();self.assertEqual(self.q.sucessos,0)
        d=self.client.get(f'/api/questionarios/{self.q.pk}/devolutiva/').data
        self.assertEqual(d['respostas'][0]['enunciado'],'Pergunta original')
        self.q.proxima_revisao=timezone.localdate();self.q.save()
        self.assertEqual(self.finalizar().status_code,201)
        d=self.client.get(f'/api/questionarios/{self.q.pk}/devolutiva/').data
        self.assertEqual(d['respostas'][0]['enunciado'],'Alterada')
        self.assertEqual(SessaoRevisao.objects.count(),2)

    def test_ajuste_texto_preserva_agenda_invalida_sessao_antiga(self):
        self.finalizar();self.q.refresh_from_db();data=self.q.proxima_revisao
        self.client.patch(f'/api/perguntas/{self.p.pk}/',{'enunciado':'Correção','manter_agendamento':True},format='json')
        self.assertEqual(self.finalizar(self.dados(treino=True)).status_code,409)
        self.q.refresh_from_db();self.assertEqual(self.q.proxima_revisao,data)

    def test_isolamento(self):
        self.client.force_authenticate(self.outro)
        self.assertEqual(self.client.get(f'/api/questionarios/{self.q.pk}/').status_code,404)
        self.assertEqual(self.finalizar().status_code,404)
        self.assertEqual(self.client.post('/api/questionarios/',{'titulo':'X','materia':self.m.pk},format='json').status_code,400)
        self.assertEqual(self.client.get('/api/resultados/').data['total'],0)

    def test_notificacao_unica_e_leitura(self):
        self.q.proxima_revisao=timezone.localdate();self.q.save()
        a=self.client.get('/api/notificacoes/').data;self.client.get('/api/notificacoes/')
        self.assertEqual(len(a),1);self.assertEqual(Notificacao.objects.count(),1)
        self.client.post(f"/api/notificacoes/{a[0]['id']}/ler/")
        self.assertTrue(Notificacao.objects.get().lida)
        self.finalizar();self.assertEqual(self.client.get('/api/notificacoes/').data,[])

    def test_resultados_renomear_e_contagens(self):
        self.finalizar(self.dados('parcial'))
        self.m.nome='Ciências';self.m.save()
        d=self.client.get('/api/resultados/').data
        self.assertEqual((d['total'],d['acertos'],d['parciais']),(1,0,1))
        self.assertEqual(d['barras'][0]['nome'],'Ciências')
        self.assertEqual(d['linha'][0]['total'],1)

    def test_deletar_anotacao_preserva_devolutiva(self):
        self.finalizar()
        self.client.delete(f'/api/anotacoes/{self.n.pk}/')
        d=self.client.get(f'/api/questionarios/{self.q.pk}/devolutiva/').data
        self.assertEqual(d['total'],1);self.assertFalse(d['respostas'][0]['anotacao_disponivel'])
        self.q.refresh_from_db();self.assertIsNone(self.q.proxima_revisao)

    def test_materia_ou_pasta_alheia(self):
        from pastas.models import Pasta
        p=Pasta.objects.create(autor=self.outro,nome='Privada')
        r=self.client.post('/api/questionarios/',{'titulo':'X','pasta':p.pk},format='json')
        self.assertEqual(r.status_code,400)

    def test_deletar_pergunta_preserva_snapshot(self):
        self.finalizar()
        self.assertEqual(self.client.delete(f'/api/perguntas/{self.p.pk}/?confirmar_reinicio=true').status_code,204)
        self.assertEqual(self.client.get(f'/api/questionarios/{self.q.pk}/devolutiva/').data['total'],1)

    def test_conteudo_criptografado(self):
        from django.db import connection
        self.finalizar()
        with connection.cursor() as cursor:
            cursor.execute('SELECT respostas FROM revisoes_sessaorevisao')
            valor=cursor.fetchone()[0]
        self.assertNotIn('Resposta original',valor)

    def test_finalizacao_versao_antiga_nao_muda_estado(self):
        d=self.dados();self.q.versao+=1;self.q.save()
        self.assertEqual(self.finalizar(d).status_code,409)
        self.assertFalse(SessaoRevisao.objects.exists())

    def test_limite_invalido(self):
        self.assertEqual(self.client.patch(f'/api/questionarios/{self.q.pk}/',{'limite_dias':0},format='json').status_code,400)

    def test_remocao_conta_oculta_novos_registros(self):
        from usuarios.services import anonimizar_e_desativar_conta
        self.finalizar()
        anonimizar_e_desativar_conta(self.user)
        self.assertFalse(Questionario.objects.filter(autor=self.user).exists())
        self.assertFalse(SessaoRevisao.objects.filter(autor=self.user).exists())

    def test_pasta_nao_excluida_com_questionario(self):
        from pastas.models import Pasta
        pasta = Pasta.objects.create(autor=self.user, nome='Estudos')
        subpasta = Pasta.objects.create(autor=self.user, nome='Biologia', pai=pasta)
        self.q.pasta = subpasta
        self.q.save()
        for destino in (subpasta, pasta):
            with self.subTest(pasta=destino.pk):
                url = f'/api/pastas/{destino.pk}/?confirmar_conteudo=true'
                resposta = self.client.delete(url)
                self.assertEqual(resposta.status_code, 400)
                self.assertIn('questionários', resposta.data['detail'])
        self.assertTrue(Pasta.objects.filter(pk=subpasta.pk).exists())
        self.q.refresh_from_db()
        self.assertEqual(self.q.pasta_id, subpasta.pk)

    def test_remover_questionario_oculta_resultados(self):
        self.finalizar()
        self.assertEqual(self.client.delete(f'/api/questionarios/{self.q.pk}/').status_code,204)
        self.assertEqual(self.client.get('/api/resultados/').data['total'],0)
        self.assertFalse(SessaoRevisao.objects.exists())
        self.assertFalse(Pergunta.objects.filter(pk=self.p.pk).exists())

    def test_notificacao_de_outro_nao_acessivel(self):
        n=Notificacao.objects.create(destinatario=self.outro,tipo='mensagem_tutor',texto='Aviso',destino='acompanhamento',recurso_id=1,chave='mensagem:1')
        self.assertEqual(self.client.post(f'/api/notificacoes/{n.pk}/ler/').status_code,404)

    def test_resultados_somam_respostas_nao_media_das_taxas(self):
        self.finalizar(self.dados('acertei'))
        q2=Questionario.objects.create(autor=self.user,titulo='Outro',materia=self.m)
        p2=Pergunta.objects.create(questionario=q2,anotacao=self.n,enunciado='Outra?',resposta='R')
        p3=Pergunta.objects.create(questionario=q2,anotacao=self.n,enunciado='Terceira?',resposta='R')
        d={'chave':str(uuid4()),'versao':1,'respostas':[{'pergunta':p.pk,'resposta_digitada':'','resultado':'errei'} for p in [p2,p3]]}
        self.assertEqual(self.client.post(f'/api/questionarios/{q2.pk}/finalizar/',d,format='json').status_code,201)
        r=self.client.get('/api/resultados/').data
        self.assertEqual((r['acertos'],r['total']),(1,3))

    def test_sessao_falha_na_auditoria_reverte_agenda(self):
        from unittest.mock import patch
        with patch('revisoes.questionarios.registrar_atividade',side_effect=RuntimeError('Falha simulada')):
            with self.assertRaises(RuntimeError):self.finalizar()
        self.assertFalse(SessaoRevisao.objects.exists())
        self.q.refresh_from_db();self.assertIsNone(self.q.proxima_revisao)
