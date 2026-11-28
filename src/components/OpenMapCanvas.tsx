import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from '../types/smartTransport';

export interface OpenMapCanvasProps {
  center: LatLng;
  onReady: (map: maplibregl.Map | null) => void;
  onPick: (point: LatLng) => void;
  pickerMode: boolean;
}

/** Base map only. Existing station and route UI is integrated separately. */
export function OpenMapCanvas({ center, onReady, onPick, pickerMode }: OpenMapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const latest = useRef({ onReady, onPick, pickerMode });
  const initialCenter = useRef(center);
  const [failed, setFailed] = useState(false);
  useEffect(() => { latest.current = { onReady, onPick, pickerMode }; }, [onReady, onPick, pickerMode]);
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [initialCenter.current.lng, initialCenter.current.lat],
        zoom: 11,
        maxZoom: 19,
      });
    } catch {
      setFailed(true);
      return;
    }
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl(), 'top-right');
    instance.addControl(new maplibregl.FullscreenControl(), 'top-right');
    instance.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    const ready = () => { setFailed(false); latest.current.onReady(instance); };
    const error = () => { if (!instance.isStyleLoaded()) setFailed(true); };
    const click = (event: maplibregl.MapMouseEvent) => {
      if (latest.current.pickerMode) latest.current.onPick({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    };
    instance.on('load', ready);
    instance.on('error', error);
    instance.on('click', click);
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.off('load', ready);
      instance.off('error', error);
      instance.off('click', click);
      latest.current.onReady(null);
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (map.current) map.current.getCanvas().style.cursor = pickerMode ? 'crosshair' : '';
  }, [pickerMode]);
  return (
    <div className="relative w-full h-[420px] sm:h-[500px] bg-slate-100 dark:bg-slate-900">
      <div ref={container} className="absolute inset-0" style={{ position: 'absolute' }} />
      {failed && <div role="alert" className="absolute top-3 left-3 right-12 rounded-lg bg-white p-3 text-sm text-slate-800 shadow">Map unavailable. Please retry or use address search.</div>}
    </div>
  );
}
