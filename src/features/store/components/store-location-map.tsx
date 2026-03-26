'use client'

import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'

interface StoreLocationMapProps {
  latitude: number | null
  longitude: number | null
  radius: number
}

declare global {
  interface Window {
    kakao: any
  }
}

export function StoreLocationMap({ latitude, longitude, radius }: StoreLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const circleInstance = useRef<any>(null)
  const markerInstance = useRef<any>(null)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY;
    console.log('[StoreLocationMap] Checking API Key:', apiKey ? 'Present (Starts with ' + apiKey.substring(0, 4) + ')' : 'Missing');

    if (!apiKey || apiKey === 'YOUR_KAKAO_MAP_API_KEY') {
      return;
    }

    // 이미 스크립트가 로드되어 있는지 확인
    if (window.kakao && window.kakao.maps) {
      console.log('[StoreLocationMap] Kakao SDK already exists, initializing...');
      initMap();
      return;
    }

    const scriptId = 'kakao-maps-sdk';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      console.log('[StoreLocationMap] Creating new SDK script tag');
      script = document.createElement('script');
      script.id = scriptId;
      // Use explicit https protocol to avoid protocol-relative URL issues
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services`;
      script.async = true;
      document.head.appendChild(script);
    }

    const onLoad = () => {
      console.log('[StoreLocationMap] SDK Script loaded successfully');
      // Wait a bit for kakao maps to be fully ready in global scope
      const interval = setInterval(() => {
        if (window.kakao && window.kakao.maps && window.kakao.maps.LatLng) {
          console.log('[StoreLocationMap] Kakao maps ready, initializing...');
          clearInterval(interval);
          initMap();
        }
      }, 100);
    };

    const onError = (e: any) => {
      console.error('[StoreLocationMap] SDK Script load failed:', e);
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    return () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };

    function initMap() {
      if (!mapRef.current || !window.kakao || !window.kakao.maps) return;
      
      console.log('[StoreLocationMap] Initializing map instance');
      const options = {
        center: new window.kakao.maps.LatLng(latitude || 37.5665, longitude || 126.9780),
        level: 4,
      };

      mapInstance.current = new window.kakao.maps.Map(mapRef.current, options);
      
      if (latitude && longitude) {
        updateMap(latitude, longitude, radius);
      }
    }
  }, []);

  const updateMap = (lat: number, lng: number, rad: number) => {
    if (!mapInstance.current) return

    const moveLatLon = new window.kakao.maps.LatLng(lat, lng)
    
    // Update Marker
    if (markerInstance.current) {
      markerInstance.current.setPosition(moveLatLon)
    } else {
      markerInstance.current = new window.kakao.maps.Marker({
        position: moveLatLon,
        map: mapInstance.current
      })
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

  const isKeyMissing = !process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY || process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY === 'YOUR_KAKAO_MAP_API_KEY'

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
