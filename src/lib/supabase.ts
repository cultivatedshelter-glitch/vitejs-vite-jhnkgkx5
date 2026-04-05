import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserType = 'agent' | 'contractor'

export interface Profile {
  id: string
  email: string
  full_name: string
  user_type: UserType
  created_at: string
}

export interface Agent {
  id: string
  user_id: string
  company_name: string
  phone: string
  created_at: string
}

export interface Contractor {
  id: string
  user_id: string
  company_name: string
  services: string[]
  zip_code: string
  service_radius: number
  phone: string
  email: string
  bio: string
  portfolio_images: string[]
  created_at: string
}

export interface Lead {
  id: string
  agent_id: string
  property_address: string
  property_zip_code: string
  job_type: string
  budget: string
  timeline: string
  description: string
  status: 'open' | 'matched' | 'closed'
  created_at: string
}

export interface Match {
  id: string
  lead_id: string
  contractor_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}
