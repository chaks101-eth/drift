-- Waitlist table for driftntravel.com
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- RLS: anon can insert, service_role can do everything
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON public.waitlist
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow service role full access" ON public.waitlist
  FOR ALL TO service_role USING (true);
