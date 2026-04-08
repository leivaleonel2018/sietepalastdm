
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Service role manages tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Service role manages matches" ON public.matches;
DROP POLICY IF EXISTS "Anyone can register as player" ON public.players;
DROP POLICY IF EXISTS "Anyone can register for tournaments" ON public.tournament_registrations;
