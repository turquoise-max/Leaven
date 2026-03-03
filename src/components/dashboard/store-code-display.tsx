'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface StoreCodeDisplayProps {
  code: string
  className?: string
}

export function StoreCodeDisplay({ code, className }: StoreCodeDisplayProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success('매장 코드가 복사되었습니다.')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex items-center gap-2 p-2 bg-muted/50 rounded-md border ${className}`}>
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">매장 코드:</span>
      <div className="flex items-center gap-1">
        <code className="text-sm font-mono font-bold bg-background px-2 py-0.5 rounded border">
          {code}
        </code>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="sr-only">코드 복사</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>클릭하여 복사</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}