'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getStoreAnnouncements(storeId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('store_announcements')
    .select(`
      *,
      author:author_id (
        id,
        full_name
      )
    `)
    .eq('store_id', storeId)
    .order('is_important', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching announcements:', JSON.stringify(error, null, 2))
    return []
  }

  if (!data || data.length === 0) return []

  // Extract unique author IDs to fetch their store member details
  const authorIds = Array.from(new Set(data.map((item) => item.author_id).filter(Boolean)))

  // Fetch store members data for these authors in the current store
  const { data: memberData, error: memberError } = await supabase
    .from('store_members')
    .select('user_id, name')
    .eq('store_id', storeId)
    .in('user_id', authorIds)

  if (memberError) {
    console.error('Error fetching store members for announcements:', memberError)
    // If error occurs, gracefully fallback to the original query data
    return data
  }

  // Create a map of user_id to store member name for quick lookup
  const memberNameMap = new Map(memberData?.map(m => [m.user_id, m.name]) || [])

  // Map the announcements to include the correct author name
  return data.map((item) => {
    const storeMemberName = memberNameMap.get(item.author_id)
    const displayName = storeMemberName || item.author?.full_name || '이름 없음'

    return {
      ...item,
      author: {
        id: item.author?.id,
        full_name: displayName
      }
    }
  })
}

export async function createAnnouncement(storeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const title = formData.get('title') as string
  const content = formData.get('content') as string
  const isImportant = formData.get('is_important') === 'true'

  if (!title) {
    return { error: 'Title is required' }
  }

  const { error } = await supabase
    .from('store_announcements')
    .insert({
      store_id: storeId,
      title,
      content,
      is_important: isImportant,
      author_id: user.id
    })

  if (error) {
    console.error('Error creating announcement:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/my-tasks')
  return { success: true }
}

export async function updateAnnouncement(id: string, storeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const title = formData.get('title') as string
  const content = formData.get('content') as string
  const isImportant = formData.get('is_important') === 'true'

  if (!title) {
    return { error: 'Title is required' }
  }

  const { error } = await supabase
    .from('store_announcements')
    .update({
      title,
      content,
      is_important: isImportant,
    })
    .eq('id', id)
    .eq('store_id', storeId) // Security check

  if (error) {
    console.error('Error updating announcement:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/my-tasks')
  return { success: true }
}

export async function deleteAnnouncement(id: string, storeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('store_announcements')
    .delete()
    .eq('id', id)
    .eq('store_id', storeId) // Security check

  if (error) {
    console.error('Error deleting announcement:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/my-tasks')
  return { success: true }
}