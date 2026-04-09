
-- Add set_scores to matches
ALTER TABLE public.matches ADD COLUMN set_scores jsonb;

-- Create challenges table
CREATE TABLE public.challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  challenged_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  set_scores jsonb,
  challenger_sets_won integer,
  challenged_sets_won integer,
  winner_id uuid REFERENCES public.players(id),
  rating_change_challenger integer DEFAULT 0,
  rating_change_challenged integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read challenges" ON public.challenges FOR SELECT USING (true);
