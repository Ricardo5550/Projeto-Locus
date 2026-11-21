"""Validação compartilhada entre o painel React e as páginas administrativas."""
from django import forms
from .atendimento import ACOES
from .equipe import ACOES_EQUIPE


class AtendimentoForm(forms.Form):
    senha_atual = forms.CharField(required=False, max_length=1024, strip=False, widget=forms.PasswordInput)
    acao = forms.ChoiceField(choices=[('revelar_email', 'Revelar e-mail'), *ACOES.items(), *ACOES_EQUIPE.items()])
    motivo = forms.CharField(
        min_length=5, max_length=300, widget=forms.Textarea(attrs={'rows': 2}),
        help_text='Descreva o motivo sem incluir dados pessoais, senhas ou códigos.',
    )


class AprovacaoForm(forms.Form):
    aprovado = forms.TypedChoiceField(
        choices=[('sim', 'Aprovar'), ('nao', 'Rejeitar')],
        coerce=lambda valor: valor == 'sim',
    )
    motivo = forms.CharField(
        min_length=5, max_length=300, widget=forms.Textarea(attrs={'rows': 2}),
        help_text='Descreva o motivo sem incluir dados pessoais, senhas ou códigos.',
    )
