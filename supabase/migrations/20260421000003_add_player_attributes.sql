-- Agregar columna de atributos al perfil de jugadores
ALTER TABLE players ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{"attack":70,"defense":70,"serve":70,"control":70,"speed":70,"mental":70}';
