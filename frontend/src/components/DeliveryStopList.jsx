import { useEffect, useRef, useState } from 'react'

export default function DeliveryStopList({ entregas, selecionadas, disabled, excluindo, onToggle, onReorder, onDelete }) {
  const list = useRef(null)
  const gesture = useRef(null)
  const [dragging, setDragging] = useState(null)
  const [over, setOver] = useState(null)
  const [announcement, setAnnouncement] = useState('')

  function reset() {
    gesture.current = null
    setDragging(null)
    setOver(null)
  }

  useEffect(() => {
    if (disabled) reset()
  }, [disabled])

  useEffect(() => {
    if (dragging === null) return
    let frame
    function tick() {
      const drag = gesture.current
      const container = list.current
      if (drag && container) {
        const rect = container.getBoundingClientRect()
        const inside = drag.x >= rect.left && drag.x <= rect.right && drag.y >= rect.top && drag.y <= rect.bottom
        if (inside) {
          if (drag.y < rect.top + 35) container.scrollTop -= 7
          if (drag.y > rect.bottom - 35) container.scrollTop += 7
        }
        const card = inside ? document.elementFromPoint(drag.x, drag.y)?.closest('[data-delivery-id]') : null
        drag.target = card && container.contains(card) ? Number(card.dataset.deliveryId) : null
        setOver(drag.target)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [dragging])

  function move(from, to) {
    if (from === to || to === null) return
    onReorder(from, to)
    setAnnouncement(`Entrega #${from} movida para a posição ${entregas.findIndex(e => e.id === to) + 1}.`)
  }

  return <>
    {entregas.length > 0 && <p className="stop-instructions">Arraste pela alça para ordenar as paradas.</p>}
    <div className="stop-list" ref={list} role="list" aria-label="Ordem das entregas de hoje">
      {entregas.map((entrega, index) => {
        const selected = selecionadas.includes(entrega.id)
        return <div key={entrega.id} data-delivery-id={entrega.id} role="listitem"
          className={`stop-card ${selected ? 'selected' : ''} ${dragging === entrega.id ? 'dragging' : ''} ${over === entrega.id && dragging !== entrega.id ? 'drop-target' : ''}`}>
          <button type="button" className="stop-handle" disabled={disabled}
            aria-label={`Mover entrega #${entrega.id}, posição ${index + 1} de ${entregas.length}`}
            title="Arraste para ordenar ou use as setas para cima e para baixo"
            onKeyDown={event => {
              if (event.key === 'Escape') return reset()
              if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
              event.preventDefault()
              const destination = entregas[index + (event.key === 'ArrowUp' ? -1 : 1)]
              if (destination && !disabled) move(entrega.id, destination.id)
            }}
            onPointerDown={event => {
              if (disabled || !event.isPrimary || event.button !== 0) return
              event.preventDefault()
              event.currentTarget.focus()
              event.currentTarget.setPointerCapture(event.pointerId)
              gesture.current = { id: entrega.id, pointer: event.pointerId, x: event.clientX, y: event.clientY, target: entrega.id }
              setDragging(entrega.id)
            }}
            onPointerMove={event => {
              if (gesture.current?.pointer !== event.pointerId) return
              gesture.current.x = event.clientX
              gesture.current.y = event.clientY
            }}
            onPointerUp={event => {
              const drag = gesture.current
              if (!drag || drag.pointer !== event.pointerId) return
              const card = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-delivery-id]')
              if (!disabled && card && list.current.contains(card)) move(drag.id, Number(card.dataset.deliveryId))
              reset()
            }}
            onPointerCancel={reset} onLostPointerCapture={reset}>
            <svg width="18" height="24" viewBox="0 0 18 24" fill="currentColor" aria-hidden="true">
              {[6, 12, 18].map(y => <g key={y}><circle cx="6" cy={y} r="1.5" /><circle cx="12" cy={y} r="1.5" /></g>)}
            </svg>
          </button>
          <label className="stop-content">
            <input type="checkbox" checked={selected} disabled={disabled} onChange={() => onToggle(entrega.id)}
              aria-label={`Selecionar entrega #${entrega.id} de ${entrega.cliente_nome}`} />
            <span className="stop-number">{selecionadas.indexOf(entrega.id) + 1 || '•'}</span>
            <span className="stop-address">
              <strong>{entrega.cliente_nome}{entrega.avulsa && <span className="avulsa-badge">Avulsa</span>}</strong>
              <small>{entrega.endereco_resumo}</small>
            </span>
          </label>
          <button type="button" className="stop-delete" disabled={disabled} onClick={() => onDelete(entrega)}
            aria-label={`Excluir entrega #${entrega.id}`} title="Excluir entrega" aria-busy={excluindo === entrega.id}>
            <svg width="18" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
            </svg>
          </button>
        </div>
      })}
    </div>
    <span className="stop-announcement" role="status" aria-live="polite">{announcement}</span>
  </>
}
