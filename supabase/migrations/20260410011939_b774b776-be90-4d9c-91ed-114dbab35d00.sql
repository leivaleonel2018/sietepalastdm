
-- News table
CREATE TABLE public.news (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read news" ON public.news FOR SELECT USING (true);

-- Storage bucket for news images
INSERT INTO storage.buckets (id, name, public) VALUES ('news-images', 'news-images', true);

CREATE POLICY "Anyone can view news images" ON storage.objects FOR SELECT USING (bucket_id = 'news-images');

CREATE POLICY "Service role can upload news images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'news-images');
