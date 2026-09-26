import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { apiErrorMessage } from '../apiErrors'

export default function DistanceMatrix({ entregaIds }) {
  const [matrix, setMatrix] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  useEffect(() => () => { requestId.current += 1 }, [])

  async function compare() {
    const current = ++requestId.current
    setLoading(true)
    setError('')
    setMatrix(null)
    try {
      const { data } = await api.post('/api/rotas/matriz', { entrega_ids: entregaIds })
      if (current === requestId.current) setMatrix(data)
    } catch (err) {
      if (current === requestId.current) {
        setError(apiErrorMessage(err, 'Não foi possível comparar as paradas.'))
      }
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }

  const label = (point) => point.entrega_id == null ? 'Empresa' : `${point.nome} (#${point.entrega_id})`
  return (
    <section className="panel matrix-panel" aria-busy={loading}>
      <h2>Distâncias e tempos entre paradas</h2>
      <p>Compare os trajetos entre a empresa e até 24 entregas selecionadas. A comparação não altera a ordem das paradas.</p>
      <button type="button" onClick={compare} disabled={loading || !entregaIds.length || entregaIds.length > 24}>
        {loading ? 'Comparando...' : 'Comparar paradas'}
      </button>
      {!entregaIds.length && <p>Selecione pelo menos uma entrega.</p>}
      {entregaIds.length > 24 && <p>Selecione no máximo 24 entregas para comparar.</p>}
      {error && <p role="alert">{error}</p>}
      {matrix && <div className="matrix-scroll">
        <table className="distance-matrix">
          <caption>Linhas: origem. Colunas: destino. Distância em km e tempo em minutos.</caption>
          <thead><tr><th scope="col">De / Para</th>{matrix.pontos.map((p, j) => <th scope="col" key={j}>{label(p)}</th>)}</tr></thead>
          <tbody>{matrix.pontos.map((point, i) => <tr key={i}>
            <th scope="row">{label(point)}</th>
            {matrix.pontos.map((_, j) => <td key={j}>
              {matrix.distancias_km[i][j] == null || matrix.duracoes_minutos[i][j] == null
                ? 'Sem trajeto'
                : <><span>{matrix.distancias_km[i][j].toLocaleString('pt-BR')} km</span><span>{matrix.duracoes_minutos[i][j].toLocaleString('pt-BR')} min</span></>}
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  )
}
