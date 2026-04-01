'use client'

import { useState } from 'react'
import { Megaphone, ChevronRight, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Announcement {
  id: string
  title: string
  content: string
  is_important: boolean
  created_at: string
  author?: {
    id: string
    full_name?: string
  }
}

interface StaffAnnouncementListProps {
  announcements: Announcement[]
}

export function StaffAnnouncementList({ announcements }: StaffAnnouncementListProps) {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [showAllList, setShowAllList] = useState(false)

  if (!announcements || announcements.length === 0) {
    return null
  }

  // 최상단 노출용: 중요 공지가 있으면 그것들 우선, 없으면 가장 최근 공지 1개
  const importantAnnouncements = announcements.filter(a => a.is_important)
  const displayAnnouncements = importantAnnouncements.length > 0 
    ? importantAnnouncements 
    : [announcements[0]]

  return (
    <>
      {/* 모바일 뷰: 컴팩트한 확성기 버튼 */}
      <div className="md:hidden flex justify-end h-full">
        <button 
          onClick={() => setShowAllList(true)}
          className="flex flex-col items-center justify-center gap-1 bg-white border shadow-sm px-3 rounded-xl h-full w-[72px] text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
        >
          <div className="relative">
            <Megaphone className="h-5 w-5 text-primary" />
            <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white border-2 border-white shadow-sm">
              {announcements.length}
            </span>
          </div>
          <span className="text-[10px]">공지사항</span>
        </button>
      </div>

      {/* 데스크탑 뷰: 기존 리스트 형태 */}
      <div className="hidden md:block w-full h-full">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">매장 공지사항</h2>
          {announcements.length > displayAnnouncements.length && (
            <span className="text-xs text-muted-foreground cursor-pointer hover:underline ml-auto"
                  onClick={() => setShowAllList(true)}>
              전체보기 ({announcements.length})
            </span>
          )}
        </div>
        
        <div className="flex flex-row gap-3 overflow-x-auto pb-2 snap-x scrollbar-hide">
          {displayAnnouncements.map((announcement) => (
            <div 
              key={announcement.id} 
              onClick={() => setSelectedAnnouncement(announcement)}
              className={`flex-none w-[320px] p-3 rounded-md border cursor-pointer snap-start transition-colors hover:bg-muted/50 flex flex-col justify-center ${
                announcement.is_important ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-card shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {announcement.is_important && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">중요</Badge>
                )}
                <h4 className="font-semibold text-sm truncate flex-1 text-slate-800">{announcement.title}</h4>
              </div>
              <p className="block text-xs text-muted-foreground line-clamp-1 mb-2">
                {announcement.content}
              </p>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                <span>{format(new Date(announcement.created_at), 'yyyy.MM.dd', { locale: ko })}</span>
                <span className="flex items-center">자세히 보기 <ChevronRight className="h-3 w-3 ml-0.5" /></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showAllList} onOpenChange={setShowAllList}>
        <DialogContent className="w-[95%] sm:max-w-[500px] p-4 md:p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg text-center md:text-left w-full">전체 공지사항</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-2 md:mt-4 pr-0 md:pr-4">
            <div className="flex flex-col gap-2 md:gap-3">
              {announcements.map((announcement) => (
                <div 
                  key={announcement.id} 
                  onClick={() => {
                    setShowAllList(false)
                    setSelectedAnnouncement(announcement)
                  }}
                  className={`p-2.5 md:p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                    announcement.is_important ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-card shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 md:mb-1.5">
                    {announcement.is_important && (
                      <Badge variant="destructive" className="text-[9px] md:text-[10px] px-1.5 py-0 h-3.5 md:h-4">중요</Badge>
                    )}
                    <h4 className="font-semibold text-xs md:text-sm md:truncate flex-1 break-all whitespace-normal">{announcement.title}</h4>
                  </div>
                  <p className="text-[11px] md:text-xs text-muted-foreground line-clamp-1 mb-1 md:mb-2">
                    {announcement.content}
                  </p>
                  <div className="flex justify-between items-center text-[9px] md:text-[10px] text-muted-foreground">
                    <span>{format(new Date(announcement.created_at), 'yyyy.MM.dd', { locale: ko })}</span>
                    <span>{announcement.author?.full_name || '관리자'}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <button
            onClick={() => {
              setSelectedAnnouncement(null)
              setShowAllList(true)
            }}
            className="absolute right-10 top-4 text-[11px] md:text-xs text-muted-foreground hover:text-primary transition-colors whitespace-nowrap underline underline-offset-2"
          >
            목록으로 돌아가기
          </button>
          <DialogHeader className="pt-6">
            <div className="flex flex-col gap-2 mb-1">
              <div className="flex items-center gap-2">
                {selectedAnnouncement?.is_important && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">중요</Badge>
                )}
                <DialogTitle className="text-lg leading-tight text-left break-words pr-2">{selectedAnnouncement?.title}</DialogTitle>
              </div>
            </div>
            <DialogDescription className="flex justify-between items-center text-xs">
              <span>작성자: {selectedAnnouncement?.author?.full_name || '관리자'}</span>
              <span>
                {selectedAnnouncement && format(new Date(selectedAnnouncement.created_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <ScrollArea className="max-h-[60vh]">
              <div className="text-sm whitespace-pre-wrap leading-relaxed pr-4">
                {selectedAnnouncement?.content}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}