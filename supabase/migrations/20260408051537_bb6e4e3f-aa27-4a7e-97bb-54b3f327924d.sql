
-- Players table
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL UNIQUE,
  dni TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 600,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tournaments table
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  format TEXT NOT NULL DEFAULT 'single_elimination',
  type TEXT NOT NULL DEFAULT 'singles',
  status TEXT NOT NULL DEFAULT 'registration',
  max_players INTEGER,
  groups_count INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tournament registrations
CREATE TABLE public.tournament_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, player_id)
);

-- Matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player1_id UUID REFERENCES public.players(id),
  player2_id UUID REFERENCES public.players(id),
  player1_score INTEGER,
  player2_score INTEGER,
  winner_id UUID REFERENCES public.players(id),
  round TEXT,
  group_name TEXT,
  match_order INTEGER,
  placement TEXT,
  rating_change_p1 INTEGER DEFAULT 0,
  rating_change_p2 INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Anyone can read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Anyone can read tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Anyone can read registrations" ON public.tournament_registrations FOR SELECT USING (true);
CREATE POLICY "Anyone can read matches" ON public.matches FOR SELECT USING (true);

-- Service role will handle all writes via edge functions
-- Allow anon insert for player registration
CREATE POLICY "Anyone can register as player" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can register for tournaments" ON public.tournament_registrations FOR INSERT WITH CHECK (true);

-- Admin operations (tournaments and matches managed via service role in edge functions)
CREATE POLICY "Service role manages tournaments" ON public.tournaments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages matches" ON public.matches FOR ALL USING (true) WITH CHECK (true);
