'use client';

import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef } from 'react';

/**
 * Mapa con un pin arrastrable para marcar dónde queda el local.
 *
 * Usa Leaflet con mosaicos de OpenStreetMap: gratis y sin llave. Se importa
 * solo en el navegador (ver formulario-perfil.tsx), porque Leaflet toca
 * `window` apenas se carga.
 *
 * Lo que se guarda es la posición del pin, no el resultado de un buscador: el
 * dueño sabe mejor que nadie dónde queda su puerta.
 */

type Props = {
  latitud: number | null;
  longitud: number | null;
  onCambio: (latitud: number, longitud: number) => void;
};

/** Centro de Bogotá, para cuando todavía no hay ubicación. */
const CENTRO_POR_DEFECTO: L.LatLngTuple = [4.711, -74.0721];
const ZOOM_CIUDAD = 12;
const ZOOM_CALLE = 17;

// Pin dibujado con CSS. El ícono por defecto de Leaflet busca imágenes con
// rutas relativas que el empaquetador de Next no resuelve.
const ICONO_PIN = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#171717;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

export default function MapaUbicacion({ latitud, longitud, onCambio }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const colocarPin = useRef<((posicion: L.LatLng) => void) | null>(null);

  // onCambio cambia en cada render del padre; se guarda en una ref para no
  // tener que reconstruir el mapa por eso.
  const onCambioRef = useRef(onCambio);
  useEffect(() => {
    onCambioRef.current = onCambio;
  }, [onCambio]);

  // Crear el mapa una sola vez.
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;

    const m = L.map(contenedor.current, { scrollWheelZoom: false }).setView(
      CENTRO_POR_DEFECTO,
      ZOOM_CIUDAD,
    );

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);

    colocarPin.current = (posicion: L.LatLng) => {
      if (pin.current) {
        pin.current.setLatLng(posicion);
      } else {
        pin.current = L.marker(posicion, { draggable: true, icon: ICONO_PIN }).addTo(m);
        pin.current.on('dragend', () => {
          const p = pin.current!.getLatLng();
          onCambioRef.current(p.lat, p.lng);
        });
      }
    };

    m.on('click', (e: L.LeafletMouseEvent) => {
      colocarPin.current?.(e.latlng);
      onCambioRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapa.current = m;

    return () => {
      m.remove();
      mapa.current = null;
      pin.current = null;
      colocarPin.current = null;
    };
  }, []);

  // Seguir la ubicación que llega de afuera: búsqueda, GPS o la guardada.
  useEffect(() => {
    const m = mapa.current;
    if (!m || latitud === null || longitud === null) return;

    const posicion = L.latLng(latitud, longitud);
    const actual = pin.current?.getLatLng();
    if (actual && actual.equals(posicion)) return;

    colocarPin.current?.(posicion);
    m.setView(posicion, Math.max(m.getZoom(), ZOOM_CALLE));
  }, [latitud, longitud]);

  return (
    <div
      ref={contenedor}
      className="h-64 w-full overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700"
      role="application"
      aria-label="Mapa: toca o arrastra el pin hasta la puerta de tu local"
    />
  );
}
