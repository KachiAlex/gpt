import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Reads {lat,lng} from a project's location JSONB in either field naming.
export const getCoords = (location) => {
  if (!location || typeof location !== 'object') return null;
  const lat = Number(location.lat ?? location.latitude);
  const lng = Number(location.lng ?? location.lon ?? location.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
};

const TILES = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, Maxar, Earthstar Geographics',
  },
};

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12);
      return;
    }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [40, 40] }
    );
  }, [points, map]);
  return null;
}

/**
 * Shared Leaflet map of geocoded projects.
 * items: [{ id, name, coords: {lat,lng}, color?, popup?: ReactNode }]
 * onSelect(item) fires on marker click.
 */
export default function ProjectMap({ items, onSelect, view = 'street', height = 420, className = '' }) {
  const tile = TILES[view] || TILES.street;
  return (
    <div className={`relative ${className}`} style={{ height }}>
      <MapContainer center={[9.0, 7.5]} zoom={5} className="absolute inset-0 h-full w-full z-0" scrollWheelZoom>
        <TileLayer key={view} url={tile.url} attribution={tile.attribution} />
        <FitBounds points={items.map((i) => i.coords)} />
        {items.map((item) => (
          <CircleMarker
            key={item.id}
            center={[item.coords.lat, item.coords.lng]}
            radius={9}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: item.color || '#0284c7', fillOpacity: 0.9 }}
            eventHandlers={{ click: () => onSelect?.(item) }}
          >
            {item.popup && <Popup>{item.popup}</Popup>}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
