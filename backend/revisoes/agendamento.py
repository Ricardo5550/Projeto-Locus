"""Adaptação do SM-2 para a autoavaliação de um questionário completo."""

from decimal import Decimal, ROUND_CEILING


def calcular_revisao(
    acertos, parciais, total, facilidade, sucessos, intervalo, limite=None
):
    if total <= 0 or min(acertos, parciais) < 0 or acertos + parciais > total:
        raise ValueError('Resultado inválido.')

    qualidade = 5 * (2 * acertos + parciais) // (2 * total)
    facilidade_anterior = Decimal(facilidade)

    if qualidade < 3:
        sucessos = 0
        dias = 1
    else:
        sucessos += 1
        if sucessos == 1:
            dias = 1
        elif sucessos == 2:
            dias = 6
        else:
            dias = int(
                (Decimal(intervalo) * facilidade_anterior).to_integral_value(
                    rounding=ROUND_CEILING
                )
            )

    distancia_da_nota_maxima = 5 - qualidade
    ajuste = Decimal('0.1') - distancia_da_nota_maxima * (
        Decimal('0.08') + distancia_da_nota_maxima * Decimal('0.02')
    )
    facilidade = max(Decimal('1.3'), facilidade_anterior + ajuste)
    if limite is not None:
        dias = min(dias, limite)
    return qualidade, facilidade, sucessos, dias
