import { useEffect, useMemo } from 'react'
import MapDeliveryTarget from './MapDeliveryTarget'
import L from 'leaflet'
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function FitBounds({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) return
    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]))
    map.fitBounds(bounds, { padding: [40, 40], animate: false })
  }, [points, map])

  return null
}

export default function RouteMap({ points, route, origin, onAvulsaCreated }) {
  const mapPoints = useMemo(() => origin ? [origin, ...points] : points, [origin, points])
  const center = mapPoints.length
    ? [mapPoints[0].latitude, mapPoints[0].longitude]
    : [-29.886, -50.268]

  const routePositions =
    route?.geometry?.coordinates?.map(([lon, lat]) => [lat, lon]) || []

  return (
    <>
    <MapContainer center={center} zoom={11} className="map">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {origin && (
        <Marker position={[origin.latitude, origin.longitude]}>
          <Popup>
            <strong>Origem: empresa</strong>
            <br />
            {origin.logradouro}, {origin.numero || 's/n'}
          </Popup>
        </Marker>
      )}

      {points.map((p, index) => (
        <Marker key={p.id} position={[p.latitude, p.longitude]}>
          <Popup>
            <strong>{index + 1}. {p.cliente_nome}{p.avulsa ? " · Avulsa" : ""}</strong>
            <br />
            {p.endereco_resumo}
          </Popup>
        </Marker>
      ))}

      {routePositions.length > 0 && (
        <Polyline positions={routePositions} weight={6} />
      )}

      <MapDeliveryTarget onCreated={onAvulsaCreated} />
      <FitBounds points={mapPoints} />
    </MapContainer>
    </>
  )
}

