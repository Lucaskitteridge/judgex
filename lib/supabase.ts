import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Public client — for frontend and read operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Service client — for server side write operations, bypasses RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
