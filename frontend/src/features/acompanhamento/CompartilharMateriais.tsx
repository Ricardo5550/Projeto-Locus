import { useEffect, useState, type SubmitEvent } from 'react';
import {
  listarAnotacoes,
} from '../anotacoes/apiAnotacoes';
import {
  listarMapasMentais,
} from '../mapas/apiMapas';
import {
  compartilharAnotacao,
  compartilharMapa,
} from './apiAcompanhamento';

type Material = {
  id: number;
  titulo: string;
};

type TipoMaterial = 'anotacao' | 'mapa';

type Props = {
  espacoId: number;
  onCompartilhado: () => void;
};

export default function CompartilharMateriais({
  espacoId,
  onCompartilhado,
}: Props) {
  const [anotacoes, setAnotacoes] = useState<Material[]>([]);
  const [mapas, setMapas] = useState<Material[]>([]);

  const [tipo, setTipo] = useState<TipoMaterial>('anotacao');
  const [materialId, setMaterialId] = useState('');

  const [carregando, setCarregando] = useState(true);
  const [compartilhando, setCompartilhando] = useState(false);

  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    let ativo = true;

    setCarregando(true);
    setErro('');
    setMensagem('');
    setMaterialId('');

    Promise.all([
      listarAnotacoes(),
      listarMapasMentais(),
    ])
      .then(([anotacoesRecebidas, mapasRecebidos]) => {
        if (!ativo) return;

        setAnotacoes(anotacoesRecebidas);
        setMapas(mapasRecebidos);
      })
      .catch((error) => {
        if (ativo) {
          setErro(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar os materiais.'
          );
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [espacoId]);

  const materiaisDisponiveis =
    tipo === 'anotacao' ? anotacoes : mapas;

  async function handleCompartilhar(
    event: SubmitEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (compartilhando || carregando || !materialId) return;

    const id = Number(materialId);

    if (!Number.isInteger(id) || id <= 0) return;

    setCompartilhando(true);
    setErro('');
    setMensagem('');

    try {
      if (tipo === 'anotacao') {
        await compartilharAnotacao(espacoId, id);
      } else {
        await compartilharMapa(espacoId, id);
      }

      setMensagem('Material compartilhado com sucesso.');
      setMaterialId('');
      onCompartilhado();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível compartilhar o material.'
      );
    } finally {
      setCompartilhando(false);
    }
  }

  return (
    <section>
      <h2>Compartilhar materiais</h2>

      {carregando ? (
        <p>Carregando seus materiais...</p>
      ) : (
        <form onSubmit={handleCompartilhar}>
          <label htmlFor="tipo-material">
            Tipo de material
          </label>

          <select
            id="tipo-material"
            value={tipo}
            disabled={compartilhando}
            onChange={(event) => {
              setTipo(event.target.value as TipoMaterial);
              setMaterialId('');
              setErro('');
              setMensagem('');
            }}
          >
            <option value="anotacao">Anotação</option>
            <option value="mapa">Mapa mental</option>
          </select>

          <label htmlFor="material-compartilhar">
            Selecione o material
          </label>

          <select
            id="material-compartilhar"
            value={materialId}
            disabled={compartilhando}
            onChange={(event) => {
              setMaterialId(event.target.value);
              setErro('');
              setMensagem('');
            }}
            required
          >
            <option value="">Escolha um material</option>

            {materiaisDisponiveis.map((material) => (
              <option key={material.id} value={material.id}>
                {material.titulo}
              </option>
            ))}
          </select>

          {materiaisDisponiveis.length === 0 && (
            <p>
              Nenhum material desse tipo disponível.
            </p>
          )}

          <button
            type="submit"
            disabled={
              compartilhando ||
              !materialId ||
              materiaisDisponiveis.length === 0
            }
          >
            {compartilhando
              ? 'Compartilhando...'
              : 'Compartilhar material'}
          </button>
        </form>
      )}

      {erro && <p role="alert">{erro}</p>}
      {mensagem && <p role="status">{mensagem}</p>}
    </section>
  );
}