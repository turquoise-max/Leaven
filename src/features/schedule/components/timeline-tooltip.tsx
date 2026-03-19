import React from 'react'
import { STATUS_INFO } from './schedule-detail-panel'

interface TimelineTooltipProps {
  tooltipData: any
  tooltipPos: { x: number; y: number }
  tooltipRef: React.RefObject<HTMLDivElement | null>
}

export function TimelineTooltip({
  tooltipData,
  tooltipPos,
  tooltipRef
}: TimelineTooltipProps) {
  if (!tooltipData) return null

  return (
    <div 
      ref={tooltipRef as React.RefObject<HTMLDivElement>}
      className="fixed z-[9999] bg-white border border-black/30 rounded-xl p-2.5 pointer-events-none min-w-[160px] max-w-[240px] shadow-[0_2px_12px_rgba(0,0,0,0.1)] transition-opacity"
      style={{ left: tooltipPos.x, top: tooltipPos.y }}
    >
      {tooltipData.isTaskSpecific ? (
        <>
          <div className="text-[12px] font-medium text-[#1a1a1a] mb-1">{tooltipData.name}</div>
          <div className="text-[10px] text-primary flex items-center gap-1 font-medium mb-1">
            🕒 {tooltipData.time}
          </div>
          <div className="text-[9px] font-medium mb-2" style={{ color: STATUS_INFO[tooltipData.status || 'todo']?.color || '#6b6b6b' }}>
            상태: {STATUS_INFO[tooltipData.status || 'todo']?.label || '대기'}
          </div>
          {tooltipData.checklist && tooltipData.checklist.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-black/10 pt-1.5">
              <div className="text-[9px] text-[#6b6b6b] tracking-wide mb-0.5">체크리스트</div>
              {tooltipData.checklist.map((c: any, ci: number) => (
                <div key={ci} className="text-[9px] text-[#6b6b6b] flex items-start gap-1">
                  <span className="shrink-0 text-muted-foreground mt-[1px]">-</span>
                  <span className={`${c.is_completed ? 'line-through opacity-60' : 'text-[#1a1a1a]'}`}>{c.text}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-[12px] font-medium text-[#1a1a1a] mb-0.5">{tooltipData.name}</div>
          <div className="text-[10px] text-[#6b6b6b] mb-1.5">{tooltipData.role}</div>
          <div className="text-[10px] text-[#1a1a1a] flex items-center gap-1 mb-1.5 pb-1.5 border-b border-black/10">
            🕐 {tooltipData.shift}
          </div>
          
          <div className="text-[9px] text-[#6b6b6b] mb-1 tracking-wide">상시 업무</div>
          <div className="flex flex-col gap-[3px] mb-2">
            {tooltipData.anytimeTasks?.length > 0 ? (
              tooltipData.anytimeTasks.map((t: any, i: number) => (
                <div key={i} className="flex flex-col gap-0.5 mb-1.5 last:mb-0">
                  <div className="text-[10px] text-[#1a1a1a] flex items-start gap-1">
                    <span className="shrink-0">·</span><span className="font-medium">{t.title}</span>
                  </div>
                  {t.checklist && t.checklist.length > 0 && (
                    <div className="pl-2.5 flex flex-col gap-0.5">
                      {t.checklist.map((c: any, ci: number) => (
                        <div key={ci} className="text-[9px] text-[#6b6b6b] flex items-start gap-1">
                          <span className="shrink-0 text-muted-foreground mt-[1px]">-</span>
                          <span className={`${c.is_completed ? 'line-through opacity-60' : ''}`}>{c.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-[10px] text-[#6b6b6b] italic">등록된 상시 업무 없음</div>
            )}
          </div>
          
          {tooltipData.timeSpecificTasks?.length > 0 && (
            <>
              <div className="text-[9px] text-[#6b6b6b] mb-1 tracking-wide border-t border-black/10 pt-1.5">시간 지정 업무</div>
              <div className="flex flex-col gap-[3px]">
                {tooltipData.timeSpecificTasks.map((t: any, i: number) => (
                  <div key={i} className="flex flex-col gap-0.5 mb-1.5 last:mb-0">
                    <div className="text-[10px] text-[#1a1a1a] flex items-start gap-1 justify-between">
                      <span className="flex items-start gap-1"><span className="shrink-0">·</span><span className="font-medium">{t.title}</span></span>
                      <span className="text-[9px] text-primary/80 shrink-0 font-medium">{t.time}</span>
                    </div>
                    {t.checklist && t.checklist.length > 0 && (
                      <div className="pl-2.5 flex flex-col gap-0.5">
                        {t.checklist.map((c: any, ci: number) => (
                          <div key={ci} className="text-[9px] text-[#6b6b6b] flex items-start gap-1">
                            <span className="shrink-0 text-muted-foreground mt-[1px]">-</span>
                            <span className={`${c.is_completed ? 'line-through opacity-60' : ''}`}>{c.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}