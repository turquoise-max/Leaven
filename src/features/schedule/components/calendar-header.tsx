import React, { useState, useEffect } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Search, Sparkles, Plus, CalendarPlus, ChevronDown, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface CalendarHeaderProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  isSearchFocused: boolean
  setIsSearchFocused: (focused: boolean) => void
  filteredStaff: any[]
  getStaffRoleInfo: (staff: any) => any
  hexToRgba: (hex: string, alpha: number) => string
  
  viewMode: 'day' | 'week'
  setViewMode: (mode: 'day' | 'week') => void
  selectedDate: Date
  setSelectedDate: (date: Date) => void
  weekStart: Date
  setWeekStart: (date: Date) => void
  
  roles: any[]
  activeRoleIds: string[]
  toggleRole: (roleId: string) => void
  
  onAddSchedule: () => void
  onAutoSchedule: () => void
  onBulkDelete: () => void
}

export function CalendarHeader({
  searchQuery,
  setSearchQuery,
  isSearchFocused,
  setIsSearchFocused,
  filteredStaff,
  getStaffRoleInfo,
  hexToRgba,
  
  viewMode,
  setViewMode,
  selectedDate,
  setSelectedDate,
  weekStart,
  setWeekStart,
  
  roles,
  activeRoleIds,
  toggleRole,
  
  onAddSchedule,
  onAutoSchedule,
  onBulkDelete
}: CalendarHeaderProps) {
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-[#fbfbfb] border-b border-black/5 min-h-[72px]" />
  }

  return (
    <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-[#fbfbfb] border-b border-black/5">
      
      {/* 왼쪽: 뷰 토글 및 날짜 이동 */}
      <div className="flex items-center gap-4">
        {/* 뷰 토글 */}
        <div className="flex bg-[#f3f2ef] rounded-md p-0.5 shrink-0 shadow-inner border border-black/5">
          <button 
            className={`text-[12px] px-4 py-1.5 rounded-md transition-all ${viewMode === 'day' ? 'bg-white font-semibold text-[#1a1a1a] shadow-sm' : 'text-[#6b6b6b] hover:text-[#1a1a1a]'}`}
            onClick={() => setViewMode('day')}
          >
            일간
          </button>
          <button 
            className={`text-[12px] px-4 py-1.5 rounded-md transition-all ${viewMode === 'week' ? 'bg-white font-semibold text-[#1a1a1a] shadow-sm' : 'text-[#6b6b6b] hover:text-[#1a1a1a]'}`}
            onClick={() => {
              setViewMode('week')
              setWeekStart(startOfWeek(selectedDate, { weekStartsOn: 0 }))
            }}
          >
            주간
          </button>
        </div>

        {/* 날짜 이동 */}
        <div className="flex items-center gap-3">
          {viewMode === 'day' ? (
            <>
              <div className="flex gap-1">
                <button className="flex items-center justify-center w-7 h-7 border border-black/15 rounded-md bg-white text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-black/5 transition-colors shadow-sm" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>‹</button>
                <button className="flex items-center justify-center w-7 h-7 border border-black/15 rounded-md bg-white text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-black/5 transition-colors shadow-sm" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>›</button>
              </div>
              <div className="text-[14px] font-semibold text-[#1a1a1a]">
                {format(selectedDate, 'M월 d일 (E)', { locale: ko })}
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-1">
                <button className="flex items-center justify-center w-7 h-7 border border-black/15 rounded-md bg-white text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-black/5 transition-colors shadow-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
                <button className="flex items-center justify-center w-7 h-7 border border-black/15 rounded-md bg-white text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-black/5 transition-colors shadow-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
              </div>
              <div className="text-[14px] font-semibold text-[#1a1a1a]">
                {format(weekStart, 'M월 d일')} - {format(addDays(weekStart, 6), 'M월 d일', { locale: ko })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 오른쪽: 필터 칩, 검색창, 액션 버튼 */}
      <div className="flex items-center gap-3 ml-auto flex-wrap justify-end">
        
        {/* 역할(Role) 필터 토글 칩 */}
        <div className="flex gap-1.5 flex-wrap">
          {roles.slice(0, 4).map(r => {
            const isActive = activeRoleIds.includes(r.id)
            return (
              <button
                key={r.id}
                onClick={() => toggleRole(r.id)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all border ${
                  isActive 
                    ? 'bg-white shadow-sm' 
                    : 'bg-black/5 opacity-50 grayscale hover:grayscale-0 hover:opacity-80'
                }`}
                style={{
                  borderColor: isActive ? hexToRgba(r.color, 0.3) : 'transparent',
                  color: isActive ? '#1a1a1a' : '#6b6b6b'
                }}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-[3px] transition-colors" 
                  style={{ 
                    backgroundColor: isActive ? hexToRgba(r.color, 0.2) : '#ccc', 
                    border: `1px solid ${isActive ? r.color : '#999'}` 
                  }} 
                />
                {r.name}
              </button>
            )
          })}
        </div>

        {/* 직원 검색창 */}
        <div className="relative w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b6b6b]" />
          <Input 
            placeholder="직원 검색..." 
            className="h-8 pl-8 text-[11px] bg-white border-black/10 focus-visible:ring-1 focus-visible:ring-[#1a1a1a] focus-visible:ring-offset-0 shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
          />
          
          {isSearchFocused && searchQuery.trim() !== '' && filteredStaff.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-md shadow-lg z-50 overflow-hidden max-h-[200px] overflow-y-auto">
              {filteredStaff.map(staff => {
                const roleInfo = getStaffRoleInfo(staff)
                const rColor = roleInfo?.color || '#534AB7'
                return (
                  <div 
                    key={staff.id} 
                    className="px-3 py-2 text-[11px] text-[#1a1a1a] hover:bg-[#f3f2ef] cursor-pointer flex items-center gap-2"
                    onClick={() => {
                      setSearchQuery(staff.name || '알 수 없음')
                      setIsSearchFocused(false)
                    }}
                  >
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] shrink-0"
                         style={{ backgroundColor: hexToRgba(rColor, 0.2), color: rColor }}>
                      {(staff.name || '직').substring(0, 1)}
                    </div>
                    <span>{staff.name || '알 수 없음'}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{roleInfo?.name || '역할 없음'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-stretch shadow-sm rounded-md ml-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="bg-[#1a1a1a] text-white text-[11px] font-medium px-3 py-1.5 rounded-l-md hover:bg-black/80 flex items-center gap-1.5 transition-colors outline-none border-r border-white/20">
                <Plus className="w-3.5 h-3.5" /> 스케줄 추가 <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuItem 
                className="flex items-center gap-2 cursor-pointer text-[12px] py-2"
                onClick={onAddSchedule}
              >
                <CalendarPlus className="w-4 h-4 text-muted-foreground" />
                단일 스케줄 직접 추가
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2 cursor-pointer text-[12px] py-2"
                onClick={onAutoSchedule}
              >
                <Sparkles className="w-4 h-4 text-yellow-500 fill-yellow-500/20" />
                스케줄 자동 생성
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <button 
            className="bg-[#1a1a1a] text-white/70 px-2.5 py-1.5 rounded-r-md hover:bg-destructive hover:text-white flex items-center transition-colors outline-none"
            onClick={onBulkDelete}
            title="스케줄 일괄 초기화"
          >
            <Trash2 className="w-[14px] h-[14px]" />
          </button>
        </div>

      </div>
    </div>
  )
}
