
-- Add avatar_url to players
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create messages table for global chat
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read messages" ON public.messages FOR SELECT USING (true);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Create badges table
CREATE TABLE public.badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon_url text,
  type text NOT NULL DEFAULT 'automatic',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read badges" ON public.badges FOR SELECT USING (true);

-- Create player_badges table
CREATE TABLE public.player_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL,
  badge_id uuid NOT NULL,
  tournament_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(player_id, badge_id, tournament_id)
);
ALTER TABLE public.player_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read player badges" ON public.player_badges FOR SELECT USING (true);

-- Add badge_id to tournaments for champion badge
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS badge_id uuid;

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Service role can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Service role can update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');

-- Storage bucket for badge icons
INSERT INTO storage.buckets (id, name, public) VALUES ('badge-icons', 'badge-icons', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Anyone can view badge icons" ON storage.objects FOR SELECT USING (bucket_id = 'badge-icons');
CREATE POLICY "Service role can upload badge icons" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'badge-icons');

-- Insert default automatic badges
INSERT INTO public.badges (name, description, icon_url, type) VALUES
  ('Primer partido', 'Jugó su primer partido', '🏓', 'automatic'),
  ('Primera victoria', 'Ganó su primer partido', '🥇', 'automatic'),
  ('Primer torneo', 'Participó en su primer torneo', '🏆', 'automatic'),
  ('Racha x3', 'Ganó 3 partidos consecutivos', '🔥', 'automatic'),
  ('Racha x5', 'Ganó 5 partidos consecutivos', '🔥', 'automatic'),
  ('10 victorias', 'Acumuló 10 victorias totales', '💯', 'automatic'),
  ('Campeón de torneo', 'Ganó un torneo', '👑', 'tournament');
