export const TICKET_CATEGORIES = [
  'hardware',
  'software', 
  'network',
  'access_request',
  'email',
  'printer',
  'other'
] as const

export type TicketCategory = typeof TICKET_CATEGORIES[number]

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  hardware: 'Hardware',
  software: 'Software',
  network: 'Network',
  access_request: 'Access Request',
  email: 'Email',
  printer: 'Printer',
  other: 'Other'
}

export const CATEGORY_COLORS: Record<TicketCategory, string> = {
  hardware: 'bg-orange-100 text-orange-800',
  software: 'bg-blue-100 text-blue-800',
  network: 'bg-purple-100 text-purple-800',
  access_request: 'bg-teal-100 text-teal-800',
  email: 'bg-pink-100 text-pink-800',
  printer: 'bg-amber-100 text-amber-800',
  other: 'bg-gray-100 text-gray-700'
}

export interface Ticket {
  id: string
  user_id: string
  assigned_it_id?: string
  status: 'open' | 'in_progress' | 'closed'
  category: TicketCategory
  title: string
  description: string
  created_at: string
  updated_at: string
  user?: {
    id: string
    name: string
    email: string
  }
  assigned_it?: {
    id: string
    name: string
  } | null
}

export interface CreateTicketInput {
  description: string
  category: TicketCategory
}

export interface UpdateTicketInput {
  status?: 'open' | 'in_progress' | 'closed'
  assigned_it_id?: string | null
  category?: TicketCategory
}
