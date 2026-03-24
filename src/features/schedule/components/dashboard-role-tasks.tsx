'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ChevronRight, ChevronLeft, ShieldCheck, ListTodo, LogIn, LogOut, CalendarPlus, Plane } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

interface DashboardRoleTasksProps {
  storeId: string
  memberId: string
  roleId: string | null
}

export function DashboardRoleTasks({ storeId, memberId, roleId }: DashboardRoleTasksProps) {
  const [isOpen, setIsOpen] = useState(true) // 기본으로 열려있음
  const [showPlaybook, setShowPlaybook] = useState(true) // 플레이북 표시 여부
  const [roleTasks, setRoleTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [roleName, setRoleName] = useState<string>('역할')
  
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    async function fetchRoleTasks() {
      if (!roleId) {
        setLoading(false)
        return
      }

      const supabase = createClient()
      
      // 역할 이름 가져오기
      const { data: roleData } = await supabase
        .from('store_roles')
        .select('name')
        .eq('id', roleId)
        .single()
        
      if (roleData) setRoleName(roleData.name)

      // 해당 역할에 할당된 템플릿(기본 업무) 가져오기
      // Supabase JS 배열 필터링 문제(빈 객체 반환 에러) 우회를 위해 템플릿을 전체 가져온 뒤 클라이언트에서 필터링
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_template', true)
        
      if (!error && tasksData) {
        const filtered = tasksData.filter(task => {
          return task.assigned_role_ids && task.assigned_role_ids.includes(roleId)
        })
        setRoleTasks(filtered)
      } else if (error) {
        console.error('기본 업무 불러오기 에러:', error)
      }
      
      setLoading(false)
    }

    fetchRoleTasks()
  }, [storeId, roleId])

  return (
    <div 
      className={cn(
        "h-full transition-all duration-300 ease-in-out flex flex-col relative",
        isOpen ? "w-[320px]" : "w-[48px]"
      )}
    >
      {/* 1. Toggle Button (전체 패널) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "absolute -left-3 top-6 w-6 h-6 bg-white border shadow-sm rounded-full flex items-center justify-center z-10 text-muted-foreground hover:text-foreground transition-colors"
        )}
      >
        {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <Card className="h-full border shadow-sm overflow-hidden flex flex-col bg-[#fbfbfb]">
        {!isOpen ? (
          <div className="flex flex-col items-center gap-4 pt-6 text-muted-foreground h-full">
            <span className="text-sm font-medium whitespace-nowrap writing-vertical-rl rotate-180 mb-2">퀵 액션 및 가이드</span>
            <ShieldCheck className="w-5 h-5" />
          </div>
        ) : (
          <>
            {/* 2. 상단: 퀵 액션 영역 */}
            <div className="p-4 border-b bg-white flex flex-col gap-4 shrink-0">
              <div className="flex flex-col items-center justify-center py-2">
                <div className="text-[28px] font-bold tracking-tight text-[#1a1a1a] tabular-nums">
                  {format(currentTime, 'HH:mm:ss')}
                </div>
                <div className="text-xs text-muted-foreground font-medium mt-0.5">
                  현재 시각
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button className="bg-[#1a1a1a] hover:bg-black/80 text-white font-semibold h-11" variant="default">
                  <LogIn className="w-4 h-4 mr-2" />
                  출근하기
                </Button>
                <Button className="bg-white hover:bg-muted text-[#1a1a1a] border border-black/10 font-semibold h-11 shadow-sm" variant="outline">
                  <LogOut className="w-4 h-4 mr-2" />
                  퇴근하기
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button variant="outline" className="h-9 text-[12px] text-muted-foreground font-medium shadow-sm" onClick={() => alert('단일 할 일 추가 다이얼로그 (준비 중)')}>
                  <CalendarPlus className="w-3.5 h-3.5 mr-1.5" />
                  스케줄 추가
                </Button>
                <Button variant="outline" className="h-9 text-[12px] text-muted-foreground font-medium shadow-sm" onClick={() => alert('휴가 신청 모달 (준비 중)')}>
                  <Plane className="w-3.5 h-3.5 mr-1.5" />
                  휴가 신청
                </Button>
              </div>
            </div>

            {/* 3. 하단: 역할별 플레이북 영역 */}
            <div className="p-4 border-b bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1a1a1a]" />
                <Label htmlFor="show-playbook" className="font-semibold text-[13px] cursor-pointer">업무 플레이북 가이드</Label>
              </div>
              <Switch 
                id="show-playbook" 
                checked={showPlaybook} 
                onCheckedChange={setShowPlaybook}
              />
            </div>

            {showPlaybook && (
              <ScrollArea className="flex-1 p-4 bg-slate-50/50">
                {!roleId ? (
                  <div className="text-sm text-center text-muted-foreground py-8">
                    부여된 역할이 없습니다.
                  </div>
                ) : loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : roleTasks.length === 0 ? (
                  <div className="text-sm text-center text-muted-foreground py-8 flex flex-col items-center gap-2">
                    <ShieldCheck className="w-8 h-8 opacity-20" />
                    <p>현재 역할({roleName})에<br/>등록된 플레이북이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-3 pb-8">
                    <div className="flex items-center justify-between mb-1 px-1">
                      <Badge variant="secondary" className="text-[10px] font-medium bg-[#534AB7]/10 text-[#534AB7] border-none">
                        {roleName} 기본 업무
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{roleTasks.length}개 항목</span>
                    </div>
                    {roleTasks.map(task => (
                      <div key={task.id} className="bg-white p-3.5 rounded-lg border border-black/10 shadow-sm flex flex-col gap-2 transition-all hover:shadow">
                        <div className="flex items-start gap-2">
                          <ListTodo className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                          <h4 className="font-bold text-[13px] leading-tight text-[#1a1a1a]">
                            {task.title}
                          </h4>
                        </div>
                        
                        {task.description && (
                          <p className="text-[11px] text-[#6b6b6b] pl-6 whitespace-pre-wrap leading-snug">
                            {task.description}
                          </p>
                        )}
                        
                        {task.checklist && task.checklist.length > 0 && (
                          <div className="pl-6 space-y-1.5 pt-1.5">
                            {task.checklist.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-1.5">
                                 <div className="w-[3px] h-[3px] rounded-full bg-[#1a1a1a]/40 mt-[5px] shrink-0" />
                                 <span className="text-[11px] font-medium text-[#1a1a1a]">
                                   {item.text}
                                 </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
