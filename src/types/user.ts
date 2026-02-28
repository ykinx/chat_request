export interface User {
  id: string
  name: string
  email: string
  work_id?: string
  role: 'super_admin' | 'admin' | 'it' | 'user'
  department?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateUserInput {
  name: string
  email: string
  work_id: string
  password: string
  role: 'super_admin' | 'admin' | 'it' | 'user'
  department?: string
}

export interface UpdateUserInput {
  name?: string
  email?: string
  role?: 'super_admin' | 'admin' | 'it' | 'user'
  department?: string
  is_active?: boolean
}
