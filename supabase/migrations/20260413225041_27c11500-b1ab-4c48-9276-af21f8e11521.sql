ALTER TABLE public.player_badges
ADD CONSTRAINT player_badges_badge_id_fkey
FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON DELETE CASCADE;