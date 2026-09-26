import { useEffect, useRef, useState } from 'react'
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { api } from '../api'

export function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const targetIcon = L.divIcon({
  className: 'delivery-target-marker',
  html: '<span aria-hidden="true">⊕</span>',
  iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18],
})

function DragTarget({ onSelect, disabled }) {
  const map = useMap()
  const element = useRef(null)
  const drag = useRef(null)
  const [offset, setOffset] = useState(null)
  const [armed, setArmed] = useState(false)
  useMapEvents({ click(event) {
    if (armed && !disabled) {
      setArmed(false)
      onSelect(event.latlng.wrap())
    }
  } })
  useEffect(() => {
    const node = element.current
    L.DomEvent.disableClickPropagation(node)
    L.DomEvent.disableScrollPropagation(node)
    return () => {
      if (drag.current?.wasEnabled) map.dragging.enable()
    }
  }, [map])

  function finish(event, cancelled = false) {
    const current = drag.current
    if (!current) return
    drag.current = null
    if (current.wasEnabled) map.dragging.enable()
    setOffset(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (cancelled) return
    const distance = Math.hypot(event.clientX - current.x, event.clientY - current.y)
    if (distance < 8) { setArmed(true); return }
    const bounds = map.getContainer().getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return
    setArmed(false)
    onSelect(map.containerPointToLatLng([event.clientX - bounds.left, event.clientY - bounds.top]).wrap())
  }

  return <div className="map-target-control" ref={element}>
    {armed && <div className="map-target-hint" role="status">Clique no mapa para escolher o ponto. <button type="button" onClick={() => setArmed(false)}>Cancelar</button></div>}
    <button type="button" className={`map-target-button${offset ? ' dragging' : ''}`} disabled={disabled}
      aria-label="Arrastar alvo para inserir entrega avulsa" title="Arraste o alvo até o local da entrega. Ou clique e escolha um ponto."
      style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
      onPointerDown={event => {
        if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return
        event.preventDefault(); event.stopPropagation()
        drag.current = { x: event.clientX, y: event.clientY, wasEnabled: map.dragging.enabled() }
        map.dragging.disable()
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (drag.current) setOffset({x: event.clientX - drag.current.x, y: event.clientY - drag.current.y})
      }}
      onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}
      onLostPointerCapture={event => { if (drag.current) finish(event, true) }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setArmed(true) }
        if (event.key === 'Escape') setArmed(false)
      }}>
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
        <circle cx="16" cy="16" r="9" /><circle cx="16" cy="16" r="3" />
        <path d="M16 1v8M16 23v8M1 16h8M23 16h8" />
      </svg>
    </button>
    <span className="map-target-label">Entrega avulsa</span>
  </div>
}

export default function MapDeliveryTarget({ onCreated }) {
  const map = useMap()
  const [mapSize, setMapSize] = useState(() => map.getSize())
  useMapEvents({ resize(event) { setMapSize(event.newSize) } })
  const popup = useRef(null)
  const [point, setPoint] = useState(null)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const marker = useRef(null)
  const sequence = useRef(0)
  const controller = useRef(null)
  const savingRef = useRef(false)
  useEffect(() => () => { sequence.current++; controller.current?.abort() }, [])
  function fitPopup() {
    requestAnimationFrame(() => {
      const element = popup.current?.getElement()
      if (!element || !popup.current.isOpen()) return
      const bounds = map.getContainer().getBoundingClientRect()
      const box = element.getBoundingClientRect()
      const dx = box.left < bounds.left + 12 ? box.left - bounds.left - 12 : Math.max(0, box.right - bounds.right + 12)
      const dy = box.top < bounds.top + 12 ? box.top - bounds.top - 12 : Math.max(0, box.bottom - bounds.bottom + 12)
      if (dx || dy) map.panBy([dx, dy], {animate: false})
    })
  }
  useEffect(() => { marker.current?.openPopup(); fitPopup() }, [point])
  useEffect(() => { if (popup.current?.isOpen()) { popup.current.update(); fitPopup() } }, [loading, error, created, mapSize])

  async function selectPoint(latlng) {
    if (savingRef.current) return
    const current = ++sequence.current
    controller.current?.abort()
    controller.current = new AbortController()
    const coordinates = { latitude: latlng.lat, longitude: latlng.lng }
    setPoint(coordinates)
    setForm({nome: 'Entrega avulsa', endereco: '', data_prevista: localDate(), observacoes: '', request_id: crypto.randomUUID()})
    setCreated(null); setError(''); setLoading(true)
    try {
      const { data } = await api.post('/api/clientes/geocodificar-reverso', coordinates, {signal: controller.current.signal})
      if (current === sequence.current) setForm(old => ({...old, endereco: data.display_name.slice(0, 500)}))
    } catch (err) {
      if (current === sequence.current && err.code !== 'ERR_CANCELED') {
        setError('Não foi possível localizar o endereço. Informe uma referência abaixo ou arraste o alvo para outro ponto.')
      }
    } finally {
      if (current === sequence.current) setLoading(false)
    }
  }

  async function insert(event) {
    event.preventDefault()
    if (savingRef.current || loading || created) return
    savingRef.current = true; setSaving(true); setError('')
    const current = sequence.current
    try {
      const { data } = await api.post('/api/entregas/avulsas', {...form, ...point})
      onCreated(data)
      if (current === sequence.current) setCreated(data)
    } catch (err) {
      if (current === sequence.current) {
        const detail = err.response?.data?.detail
        setError(typeof detail === 'string' ? detail : 'Não foi possível salvar. Confira os campos e tente novamente.')
      }
    } finally {
      savingRef.current = false
      if (current === sequence.current) setSaving(false)
    }
  }

  function field(name, value) { setForm(old => ({...old, [name]:value})) }
  return <>
    <DragTarget onSelect={selectPoint} disabled={saving} />
    {point && <Marker key={`${point.latitude},${point.longitude}`} ref={marker}
      position={[point.latitude, point.longitude]} icon={targetIcon} draggable={!saving}
      eventHandlers={{dragend: event => selectPoint(event.target.getLatLng().wrap())}}>
      <Popup ref={popup} minWidth={Math.min(240, mapSize.x - 70)} maxWidth={Math.min(310, mapSize.x - 70)} maxHeight={Math.min(480, mapSize.y - 120)} autoPan={false} className="avulsa-popup" closeOnClick={false}>
        <div className="avulsa-popup-body">
          <h3>Entrega avulsa neste ponto</h3>
          <small>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</small>
          {loading && <p role="status">Consultando endereço...</p>}
          {error && <p className="avulsa-error" role="alert">{error}</p>}
          {created ? <p role="status">Entrega #{created.id} inserida. {created.data_prevista === localDate() ? 'Ela já está selecionada na lista de hoje.' : 'Confira a data na aba Entregas.'}</p> : form &&
            <form onSubmit={insert} className="avulsa-form">
              <label>Endereço / referência<textarea aria-label="Endereço / referência" required maxLength={500} rows={3} value={form.endereco} disabled={loading || saving} onChange={event => field('endereco', event.target.value)} /></label>
              <small>Confira o endereço próximo. A entrega será salva na coordenada exata do alvo.</small>
              <details onToggle={() => { popup.current?.update(); fitPopup() }}>
                <summary>Alterar identificação, data ou observações</summary>
              <label>Destinatário / identificação<input required maxLength={150} value={form.nome} disabled={saving} onChange={event => field('nome', event.target.value)} /></label>
              <label>Data da entrega<input type="date" required value={form.data_prevista} disabled={saving} onChange={event => field('data_prevista', event.target.value)} /></label>
              <label>Observações<input maxLength={2000} value={form.observacoes} disabled={saving} onChange={event => field('observacoes', event.target.value)} /></label>
              </details>
              <button className="primary" type="submit" disabled={loading || saving || !form.endereco.trim() || !form.nome.trim()}>{saving ? 'Inserindo...' : 'Inserir entrega avulsa'}</button>
            </form>}
        </div>
      </Popup>
    </Marker>}
  </>
}
