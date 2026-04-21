import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gklojtjrbeksfwsfkrlp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrbG9qdGpyYmVrc2Z3c2ZrcmxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzAzMzAsImV4cCI6MjA5MjMwNjMzMH0.95zT3gAhvmVZxshiEHoj_alKu7vUNA0Ea3j2w-GvBEA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const players = [
  {id: '94486324-1322-4bcf-b408-2a31e9baaab1', full_name: 'Gonzalo hermosilla', dni: '51366384', password_hash: '0e6cf9c106c0ae7c9a33167c72c27849d81757ba548de3c169aecde5d7ff6aa6', rating: 576, created_at: '2026-04-16 20:02:47.005003+00', avatar_url: 'https://icjwwxaibvpfsuurkosp.supabase.co/storage/v1/object/public/avatars/94486324-1322-4bcf-b408-2a31e9baaab1.jpeg?t=1776370542629'},
  {id: 'dfb91579-ded2-4144-b956-c4c37686393f', full_name: 'Hernán Ariel Duarte', dni: '39720570', password_hash: '7af7cbce3cec15842500219d7ef3938cbad79f486419da82a9c6ea4d525fbf31', rating: 602, created_at: '2026-04-10 02:39:34.14698+00', avatar_url: 'https://icjwwxaibvpfsuurkosp.supabase.co/storage/v1/object/public/avatars/dfb91579-ded2-4144-b956-c4c37686393f.jpg?t=1776112052020'},
  {id: 'dac30794-105e-4d89-9077-a23c757a9008', full_name: 'Leandro Benjamin Alvarenga', dni: '49944761', password_hash: '6c44f5d8ac2c90e8906efc39e8431785da9f66784a9d62f7fb1a76cdb63eb903', rating: 610, created_at: '2026-04-10 12:00:48.843777+00', avatar_url: null},
  {id: '2af6a50e-70b4-41ab-a925-a8ec9371396d', full_name: 'leivdev', dni: '23723828', password_hash: 'bcabc17d3fc19966c444495315bb050b09a12ec516857d6f35fcdda6837cf701', rating: 603, created_at: '2026-04-20 20:29:24.345075+00', avatar_url: 'https://icjwwxaibvpfsuurkosp.supabase.co/storage/v1/object/public/avatars/2af6a50e-70b4-41ab-a925-a8ec9371396d.png?t=1776716994908'},
  {id: '86be3493-f382-4df4-90e5-b860d2d20d5d', full_name: 'Leonel Samuel Leiva', dni: '46253510', password_hash: '5f471b6d7bb8e35547ea4342638d530add3a64d5bb350fcf8f0fbcae0043d93e', rating: 700, created_at: '2026-04-09 03:24:49.096356+00', avatar_url: 'https://icjwwxaibvpfsuurkosp.supabase.co/storage/v1/object/public/avatars/86be3493-f382-4df4-90e5-b860d2d20d5d.jpg?t=1775876952599'},
  {id: '6b03f528-c0fe-4eca-9bda-1d133af3f5b4', full_name: 'Florentin Julieta', dni: '50957099', password_hash: '6a1b9af940becce89da8c91517f11450c526d1ac82575df469c20f259da5a3b0', rating: 580, created_at: '2026-04-13 20:16:27.236889+00', avatar_url: null},
  {id: 'f6758fd9-25a5-4f03-b1f6-c25ce1fbbc5c', full_name: 'Gonzalez Octavio', dni: '50957091', password_hash: '5e4b70a2926c0a727b3bd83670db5b08851a841e289403de3e7e8d3ebae19cf8', rating: 633, created_at: '2026-04-10 11:49:20.361549+00', avatar_url: null}
];

async function insert() {
  const { data, error } = await supabase.from('players').upsert(players, { onConflict: 'id' });
  if (error) {
    console.error('Error inserting:', error);
  } else {
    console.log('Successfully inserted players.');
  }
}
insert();
