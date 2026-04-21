-- Insertar o actualizar jugadores desde el CSV exportado
INSERT INTO players (id, full_name, dni, password_hash, rating, created_at, avatar_url)
VALUES
  ('94486324-1322-4bcf-b408-2a31e9baaab1', 'Gonzalo hermosilla', '51366384', '0e6cf9c106c0ae7c9a33167c72c27849d81757ba548de3c169aecde5d7ff6aa6', 576, '2026-04-16 20:02:47.005003+00', 'https://icjwwxaibvpfsuurkosp.supabase.co/storage/v1/object/public/avatars/94486324-1322-4bcf-b408-2a31e9baaab1.jpeg?t=1776370542629'),
  ('dfb91579-ded2-4144-b956-c4c37686393f', 'Hernán Ariel Duarte', '39720570', '7af7cbce3cec15842500219d7ef3938cbad79f486419da82a9c6ea4d525fbf31', 602, '2026-04-10 02:39:34.14698+00', 'https://icjwwxaibvpfsuurkosp.supabase.co/storage/v1/object/public/avatars/dfb91579-ded2-4144-b956-c4c37686393f.jpg?t=1776112052020'),
  ('dac30794-105e-4d89-9077-a23c757a9008', 'Leandro Benjamin Alvarenga', '49944761', '6c44f5d8ac2c90e8906efc39e8431785da9f66784a9d62f7fb1a76cdb63eb903', 610, '2026-04-10 12:00:48.843777+00', NULL),
  ('2af6a50e-70b4-41ab-a925-a8ec9371396d', 'leivdev', '23723828', 'bcabc17d3fc19966c444495315bb050b09a12ec516857d6f35fcdda6837cf701', 603, '2026-04-20 20:29:24.345075+00', 'https://icjwwxaibvpfsuurkosp.supabase.co/storage/v1/object/public/avatars/2af6a50e-70b4-41ab-a925-a8ec9371396d.png?t=1776716994908'),
  ('86be3493-f382-4df4-90e5-b860d2d20d5d', 'Leonel Samuel Leiva', '46253510', '5f471b6d7bb8e35547ea4342638d530add3a64d5bb350fcf8f0fbcae0043d93e', 700, '2026-04-09 03:24:49.096356+00', 'https://icjwwxaibvpfsuurkosp.supabase.co/storage/v1/object/public/avatars/86be3493-f382-4df4-90e5-b860d2d20d5d.jpg?t=1775876952599'),
  ('6b03f528-c0fe-4eca-9bda-1d133af3f5b4', 'Florentin Julieta', '50957099', '6a1b9af940becce89da8c91517f11450c526d1ac82575df469c20f259da5a3b0', 580, '2026-04-13 20:16:27.236889+00', NULL),
  ('f6758fd9-25a5-4f03-b1f6-c25ce1fbbc5c', 'Gonzalez Octavio', '50957091', '5e4b70a2926c0a727b3bd83670db5b08851a841e289403de3e7e8d3ebae19cf8', 633, '2026-04-10 11:49:20.361549+00', NULL)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  dni = EXCLUDED.dni,
  password_hash = EXCLUDED.password_hash,
  rating = EXCLUDED.rating,
  created_at = EXCLUDED.created_at,
  avatar_url = EXCLUDED.avatar_url;
