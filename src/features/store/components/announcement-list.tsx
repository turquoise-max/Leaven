'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { AnnouncementDialog } from './announcement-dialog'
import { deleteAnnouncement } from '../announcement-actions'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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

interface AnnouncementListProps {
  storeId: string
  announcements: Announcement[]
  isManager: boolean
}

export function AnnouncementList({ storeId, announcements, isManager }: AnnouncementListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingData, setEditingData] = useState<Announcement | null>(null)
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleCreate = () => {
    setEditingData(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingData(announcement)
    setIsDialogOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setDeletingId(id)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    
    setIsDeleting(true)
    try {
      const result = await deleteAnnouncement(deletingId, storeId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('공지사항이 삭제되었습니다.')
        setIsDeleteDialogOpen(false)
      }
    } catch (error) {
      console.error(error)
      toast.error('오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  return (
    <Card className="border shadow-sm overflow-hidden bg-white dark:bg-slate-900 flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          매장 공지사항
        </CardTitle>
        {isManager && (
          <Button size="sm" onClick={handleCreate} className="h-8">
            <Plus className="h-4 w-4 mr-1" /> 작성
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {announcements.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center border-dashed border-2 rounded-lg mt-2">
            <Megaphone className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm">등록된 공지사항이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-4 pr-2">
            {announcements.map((announcement) => (
              <div 
                key={announcement.id} 
                className={`p-3 md:p-4 rounded-lg border relative group transition-colors hover:bg-muted/50 ${
                  announcement.is_important ? 'bg-primary/5 border-primary/20' : 'bg-card'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {announcement.is_important && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">중요</Badge>
                    )}
                    <h4 className="font-semibold text-sm leading-none">{announcement.title}</h4>
                  </div>
                  
                  {isManager && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 -mt-1 -mr-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(announcement)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteClick(announcement.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3 mb-2 md:mb-3">
                  {announcement.content}
                </p>
                
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{announcement.author?.full_name || '관리자'}</span>
                  <span>{format(new Date(announcement.created_at), 'yyyy.MM.dd', { locale: ko })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AnnouncementDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        storeId={storeId} 
        initialData={editingData} 
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>공지사항 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말 이 공지사항을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}