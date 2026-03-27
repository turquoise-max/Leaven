'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'

interface StoreLocationMapProps {
  latitude: number | null
  longitude: number | null
  radius: number
  onLocationChange?: (lat: number, lng: number) => void
}

declare global {
  interface Window {
    kakao: any
  }
}

export function StoreLocationMap({ latitude, longitude, radius, onLocationChange }: StoreLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const circleInstance = useRef<any>(null)
  const markerInstance = useRef<any>(null)
  const [isSdkLoaded, setIsSdkLoaded] = useState(false)

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY;
  const isKeyMissing = !apiKey || apiKey === 'YOUR_KAKAO_MAP_API_KEY';

  const initMap = () => {
    if (!mapRef.current || !window.kakao || !window.kakao.maps) {
      console.error('[StoreLocationMap] Kakao SDK or map container not ready');
      return;
    }
    
    console.log('[StoreLocationMap] Initializing map instance');
    try {
      const options = {
        center: new window.kakao.maps.LatLng(latitude || 37.5665, longitude || 126.9780),
        level: 4,
      };

      mapInstance.current = new window.kakao.maps.Map(mapRef.current, options);
      
      if (latitude && longitude) {
        updateMap(latitude, longitude, radius);
      }

      // Add click event listener to map
      window.kakao.maps.event.addListener(mapInstance.current, 'click', function(mouseEvent: any) {
        const latlng = mouseEvent.latLng;
        const newLat = latlng.getLat();
        const newLng = latlng.getLng();
        
        // Notify parent
        if (onLocationChange) {
          onLocationChange(newLat, newLng);
        } else {
          // If no parent handler, just update the map locally
          updateMap(newLat, newLng, radius);
        }
      });

    } catch (err) {
      console.error('[StoreLocationMap] Failed to initialize map:', err);
    }
  }

  useEffect(() => {
    if (isKeyMissing) return;

    if (window.kakao && window.kakao.maps && window.kakao.maps.load) {
      window.kakao.maps.load(() => {
        setIsSdkLoaded(true);
      });
      return;
    }

    const scriptId = 'kakao-map-sdk';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services&autoload=false`;
      document.head.appendChild(script);
    }

    const handleLoad = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          setIsSdkLoaded(true);
        });
      }
    };

    const handleError = (e: Event | string) => {
      console.error('[StoreLocationMap] SDK Script load failed:', e);
    };

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    // If script was already loaded but the event fired, try handling it
    if (window.kakao && window.kakao.maps) {
      handleLoad();
    }

    return () => {
      if (script) {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      }
    };
  }, [apiKey, isKeyMissing]);

  useEffect(() => {
    if (isSdkLoaded && !mapInstance.current && latitude !== null && longitude !== null) {
      console.log('[StoreLocationMap] SDK loaded and coordinates present, initializing map');
      const timer = setTimeout(() => {
        if (window.kakao && window.kakao.maps) {
          initMap();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSdkLoaded, latitude, longitude]);

  const updateMap = (lat: number, lng: number, rad: number) => {
    if (!mapInstance.current) return

    const moveLatLon = new window.kakao.maps.LatLng(lat, lng)
    
    // Update Marker
    if (markerInstance.current) {
      markerInstance.current.setPosition(moveLatLon)
    } else {
      markerInstance.current = new window.kakao.maps.Marker({
        position: moveLatLon,
        map: mapInstance.current,
        draggable: true
      })
      
      // Add dragend event listener to marker
      window.kakao.maps.event.addListener(markerInstance.current, 'dragend', function() {
        const markerPos = markerInstance.current.getPosition();
        const newLat = markerPos.getLat();
        const newLng = markerPos.getLng();
        
        if (onLocationChange) {
          onLocationChange(newLat, newLng);
        } else {
          updateMap(newLat, newLng, radius);
        }
      });
    }

    // Update Circle
    if (circleInstance.current) {
      circleInstance.current.setMap(null)
    }

    circleInstance.current = new window.kakao.maps.Circle({
      center: moveLatLon,
      radius: rad,
      strokeWeight: 2,
      strokeColor: '#0066ff',
      strokeOpacity: 0.8,
      strokeStyle: 'solid',
      fillColor: '#0066ff',
      fillOpacity: 0.2
    })
    
    circleInstance.current.setMap(mapInstance.current)
    mapInstance.current.panTo(moveLatLon)
  }

  useEffect(() => {
    if (latitude && longitude && mapInstance.current) {
      updateMap(latitude, longitude, radius)
    }
  }, [latitude, longitude, radius])

  return (
    <Card className="w-full h-[300px] overflow-hidden relative border-dashed bg-slate-50 flex items-center justify-center">
      {isKeyMissing ? (
        <div className="flex flex-col items-center justify-center p-6 text-center gap-2">
          <p className="text-sm font-medium text-destructive text-balance">
            카카오 맵 API 키 설정이 필요합니다.
          </p>
          <p className="text-xs text-muted-foreground">
            .env.local 파일에 NEXT_PUBLIC_KAKAO_MAP_API_KEY를 등록해주세요.
          </p>
        </div>
      ) : (
        <>
          <div ref={mapRef} className="w-full h-full" />
          {(!latitude || !longitude) && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 z-10 text-sm text-muted-foreground p-4 text-center">
              좌표가 설정되면 이곳에 지도와 인증 반경이 표시됩니다.
            </div>
          )}
        </>
      )}
    </Card>
  )
}
