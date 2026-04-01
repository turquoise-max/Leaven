'use client'

import { FileText, Store } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface ActionButtonsProps {
  currentStoreId?: string
  hasContract: boolean
}

export function ActionButtons({ currentStoreId, hasContract }: ActionButtonsProps) {
  const handleContractClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!currentStoreId) {
      e.preventDefault()
      toast.error('선택된 매장 정보가 없습니다. 매장을 먼저 선택해주세요.')
      return
    }

    if (!hasContract) {
      e.preventDefault()
      toast.error('아직 체결된 근로계약서가 없습니다.')
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Link 
        href={hasContract && currentStoreId ? `/api/contracts/download?storeId=${currentStoreId}` : '#'} 
        target={hasContract && currentStoreId ? "_blank" : undefined}
        rel="noopener noreferrer"
        onClick={handleContractClick}
        className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 active:bg-slate-50 transition-colors"
      >
        <div className="bg-indigo-50 p-2.5 rounded-full text-indigo-600">
          <FileText className="w-5 h-5" />
        </div>
        <span className="text-xs font-medium text-slate-700">내 근로계약서</span>
      </Link>
      
      <Link href="/home" className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 active:bg-slate-50 transition-colors">
        <div className="bg-emerald-50 p-2.5 rounded-full text-emerald-600">
          <Store className="w-5 h-5" />
        </div>
        <span className="text-xs font-medium text-slate-700">매장 전환/관리</span>
      </Link>
    </div>
  )
}