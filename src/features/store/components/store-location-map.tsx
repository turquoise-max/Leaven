'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
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
    } catch (err) {
      console.error('[StoreLocationMap] Failed to initialize map:', err);
    }
  }

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

  return (
    <Card className="w-full h-[300px] overflow-hidden relative border-dashed bg-slate-50 flex items-center justify-center">
      {!isKeyMissing && (
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services&autoload=false`}
          strategy="afterInteractive"
          onLoad={() => {
            console.log('[StoreLocationMap] SDK Script loaded via next/script');
            // Check if kakao and kakao.maps exist before calling load
            const checkKakao = () => {
              if (window.kakao && window.kakao.maps) {
                window.kakao.maps.load(() => {
                  console.log('[StoreLocationMap] Kakao maps engine loaded');
                  setIsSdkLoaded(true);
                });
              } else {
                console.log('[StoreLocationMap] Waiting for kakao.maps object...');
                setTimeout(checkKakao, 100);
              }
            };
            checkKakao();
          }}
          onError={(e) => {
            console.error('[StoreLocationMap] SDK Script load failed:', e);
          }}
        />
      )}
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
