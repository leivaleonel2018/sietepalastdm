-- Insertar o actualizar noticia desde el CSV exportado
INSERT INTO news (id, title, content, image_url, created_at)
VALUES (
  '5341b282-acb9-41ba-b344-758e93a0f86a',
  'TMT ANIVERSARIO FORMOSA',
  'TDM Siete Palmas fue participe en el TMT FORMOSA',
  'https://icjwwxaibvpfsuurkosp.supabase.co/storage/v1/object/public/news-images/1775787318222.jpg',
  '2026-04-10 02:15:29.465188+00'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  image_url = EXCLUDED.image_url,
  created_at = EXCLUDED.created_at;
