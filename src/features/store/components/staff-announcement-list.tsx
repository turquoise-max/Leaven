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
      <div className="w-full mb-6">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">매장 공지사항</h2>
          {announcements.length > displayAnnouncements.length && (
            <span className="text-xs text-muted-foreground cursor-pointer hover:underline ml-auto"
                  onClick={() => setSelectedAnnouncement(announcements[0])}>
              전체보기 ({announcements.length})
            </span>
          )}
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x scrollbar-hide">
          {displayAnnouncements.map((announcement) => (
            <div 
              key={announcement.id} 
              onClick={() => setSelectedAnnouncement(announcement)}
              className={`flex-none w-[280px] md:w-[320px] p-3 rounded-lg border cursor-pointer snap-start transition-colors hover:bg-muted/50 ${
                announcement.is_important ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-card shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {announcement.is_important && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">중요</Badge>
                )}
                <h4 className="font-semibold text-sm truncate flex-1">{announcement.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
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

      <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              {selectedAnnouncement?.is_important && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">중요</Badge>
              )}
              <DialogTitle className="text-lg leading-tight">{selectedAnnouncement?.title}</DialogTitle>
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