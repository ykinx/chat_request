export interface Message {
  id: string
  ticket_id: string
  sender_id: string
  message: string
  created_at: string
  sender?: {
    id: string
    name: string
    role: string
  }
}

export interface CreateMessageInput {
  ticket_id: string
  message: string
}
