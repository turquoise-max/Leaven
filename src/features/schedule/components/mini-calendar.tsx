import React from 'react'
import { format, subMonths, addMonths, isSameDay, isSameMonth } from 'date-fns'
import { ko } from 'date-fns/locale'

interface MiniCalendarProps {
  currentDate: Date
  setCurrentDate: (date: Date) => void
  selectedDate: Date
  setSelectedDate: (date: Date) => void
  calendarDays: Date[]
  hasScheduleOnDate: (date: Date) => boolean
}

export function MiniCalendar({
  currentDate,
  setCurrentDate,
  selectedDate,
  setSelectedDate,
  calendarDays,
  hasScheduleOnDate
}: MiniCalendarProps) {
  return (
    <div className="w-[230px] shrink-0 flex flex-col">
      <div className="bg-white border border-black/5 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button 
            className="w-6 h-6 flex items-center justify-center rounded-md bg-transparent text-[#6b6b6b] text-[14px] cursor-pointer hover:bg-black/5 hover:text-[#1a1a1a] transition-colors" 
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            &#8249;
          </button>
          <div className="text-[13px] font-semibold text-[#1a1a1a]">
            {format(currentDate, 'yyyy년 M월')}
          </div>
          <button 
            className="w-6 h-6 flex items-center justify-center rounded-md bg-transparent text-[#6b6b6b] text-[14px] cursor-pointer hover:bg-black/5 hover:text-[#1a1a1a] transition-colors" 
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            &#8250;
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-y-1 mb-1">
          {['일','월','화','수','목','금','토'].map((d, i) => (
            <div key={d} className={`text-[10px] font-medium text-center py-1 ${i === 0 ? 'text-red-500/70' : i === 6 ? 'text-blue-500/70' : 'text-[#8b8b8b]'}`}>{d}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-y-1 gap-x-0.5">
          {calendarDays.map((d, i) => {
            const isCurMonth = isSameMonth(d, currentDate)
            const isSelected = isSameDay(d, selectedDate)
            const isTodayDate = isSameDay(d, new Date())
            const hasSch = hasScheduleOnDate(d)

            if (!isCurMonth) {
              return <div key={i} className="aspect-square flex items-center justify-center text-[11px] text-[#d1d1d1] cursor-default">{d.getDate()}</div>
            }

            return (
              <div 
                key={i} 
                onClick={() => setSelectedDate(d)}
                className="aspect-square flex items-center justify-center relative cursor-pointer"
              >
                <div className={`flex flex-col items-center justify-center w-[26px] h-[26px] rounded-full transition-all
                  ${isSelected ? 'bg-[#1a1a1a] text-white shadow-md' : 'hover:bg-[#f3f2ef] text-[#4a4a4a]'}
                  ${isTodayDate && !isSelected ? 'bg-primary/10 text-primary font-bold ring-1 ring-primary/20' : ''}
                `}>
                  <span className="text-[11px] leading-none mt-0.5">{d.getDate()}</span>
                  {hasSch && (
                    <div className={`mt-[2px] w-1 h-1 rounded-full ${isSelected ? 'bg-white/80' : 'bg-primary/60'}`} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
