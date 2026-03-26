import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return ''
  
  // 숫자만 추출
  const digits = phone.replace(/[^0-9]/g, '')
  
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  } else if (digits.length === 10) {
    // 02-xxx-xxxx 또는 010-xxx-xxxx 대응
    if (digits.startsWith('02')) {
      return digits.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3')
    }
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  } else if (digits.length > 7) {
    return digits.replace(/(\d{3})(\d{3,4})(\d+)/, '$1-$2-$3')
  }
  
  return phone
}
