export interface Ticket {
  id: string
  user_id: string
  assigned_it_id?: string
  status: 'open' | 'closed'
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
}

export interface UpdateTicketInput {
  status?: 'open' | 'closed'
  assigned_it_id?: string | null
}
