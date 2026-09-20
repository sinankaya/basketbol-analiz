// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// Supabase panelindeki Project Settings -> API sayfasındaki değerlerle değiştirin
const supabaseUrl = 'https://lovefiutdjizefpictqy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvdmVmaXV0ZGppemVmcGljdHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MjIyNzQsImV4cCI6MjEwNTM5ODI3NH0.HEWZ3Af5pyrqkVt3oyf7mkYxapmDRf1__HKRkH_mkXs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)