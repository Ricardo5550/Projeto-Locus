"""SM-2 por questionário; a conversão da pontuação é uma adaptação do Locus."""
from decimal import Decimal, ROUND_CEILING


def calcular_revisao(acertos, parciais, total, facilidade, sucessos, intervalo, limite=None):
    if total <= 0 or min(acertos, parciais) < 0 or acertos + parciais > total:
        raise ValueError('Resultado inválido.')
    qualidade = 5 * (2 * acertos + parciais) // (2 * total)
    anterior = Decimal(facilidade)
    if qualidade < 3:
        sucessos, dias = 0, 1
    else:
        sucessos += 1
        dias = 1 if sucessos == 1 else 6 if sucessos == 2 else int((Decimal(intervalo) * anterior).to_integral_value(rounding=ROUND_CEILING))
    facilidade = max(Decimal('1.3'), anterior + Decimal('0.1') - (5-qualidade) * (Decimal('0.08') + (5-qualidade) * Decimal('0.02')))
    return qualidade, facilidade, sucessos, min(dias, limite) if limite else dias
