import { useEffect, useRef } from 'react';
import type { Map as LibreMap } from 'maplibre-gl';
import type { LatLng, WalkingRouteInfo } from '../types/smartTransport';

interface Props {
  map: LibreMap | null;
  origin: LatLng | null;
  destination: LatLng | null;
  onRouteUpdate: (info: WalkingRouteInfo) => void;
}
const SOURCE = 'ecodrive-walking-route';
const LAYER = 'ecodrive-walking-route-line';

export function OpenWalkingRouteOverlay({map, origin, destination, onRouteUpdate}: Props) {
  const callback = useRef(onRouteUpdate);
  useEffect(()=>{callback.current=onRouteUpdate;},[onRouteUpdate]);
  const lat = origin?.lat, lng = origin?.lng, endLat = destination?.lat, endLng = destination?.lng;
  useEffect(()=>{
    if (!map || lat == null || lng == null || endLat == null || endLng == null) {
      callback.current({status:'idle'}); return;
    }
    const controller = new AbortController();
    const clear = () => {
      if (map.getLayer(LAYER)) map.removeLayer(LAYER);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    };
    clear();
    callback.current({status:'loading'});
    const timer = window.setTimeout(async ()=>{
      try {
        const response = await fetch('/api/maps/walking-route',{
          method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal,
          body:JSON.stringify({origin:{lat,lng},destination:{lat:endLat,lng:endLng}}),
        });
        if (!response.ok) throw new Error('Route unavailable');
        const data = await response.json() as {coordinates:[number,number][];distanceMeters:number;durationMillis:number};
        if (controller.signal.aborted) return;
        if (!Array.isArray(data.coordinates) || data.coordinates.length<2 || !data.coordinates.every(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])) || !Number.isFinite(data.distanceMeters) || !Number.isFinite(data.durationMillis)) throw new Error('Invalid route');
        map.addSource(SOURCE,{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:data.coordinates}}});
        map.addLayer({id:LAYER,type:'line',source:SOURCE,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#059669','line-width':5,'line-opacity':0.9}});
        callback.current({status:'available',distanceMeters:data.distanceMeters,durationMillis:data.durationMillis});
      } catch {
        if (!controller.signal.aborted) { clear(); callback.current({status:'unavailable',reason:'Walking route unavailable; straight-line distance is shown.'}); }
      }
    },400);
    return ()=>{controller.abort();window.clearTimeout(timer);clear();};
  },[map,lat,lng,endLat,endLng]);
  return null;
}
