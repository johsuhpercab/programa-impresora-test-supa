// Supabase Configuration
const SUPABASE_URL = 'https://reyrhwvhlezqujidswer.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJleXJod3ZobGV6cXVqaWRzd2VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NTEzMzIsImV4cCI6MjA5MjMyNzMzMn0.mny5WDM79wIlCD-Sdrfd1-P956VLT9V8sAi_cnX4_jk';

console.log("Initializing Supabase Client...");

if (!window.supabase) {
  console.error("Supabase SDK not found! Check your internet connection or script tags.");
} else {
  try {
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = supabaseClient;
    console.log("✅ Supabase Client initialized successfully.");
  } catch (err) {
    console.error("❌ Error initializing Supabase:", err);
  }
}
