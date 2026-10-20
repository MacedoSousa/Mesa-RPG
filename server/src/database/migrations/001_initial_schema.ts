/**
 * Migração inicial: usuários e personagens com Soft Delete.
 *
 * As listas de CHECK espelham src/models/gameData.ts. Migrações já aplicadas
 * nunca devem ser editadas: para adicionar uma raça/classe/deus, crie uma nova
 * migração que recrie a constraint correspondente.
 */
export const name = '001_initial_schema';

export const up = /* sql */ `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────── USERS ───────────────────────────
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       VARCHAR(32)  NOT NULL,
  email          VARCHAR(255) NOT NULL,
  password_hash  TEXT         NOT NULL,
  display_name   VARCHAR(60),
  role           VARCHAR(16)  NOT NULL DEFAULT 'jogador'
                 CHECK (role IN ('jogador', 'mestre')),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ           -- Soft Delete: NULL = ativo
);

-- Unicidade só entre usuários ativos: um e-mail/username de conta excluída pode ser reutilizado
CREATE UNIQUE INDEX users_email_active_uq    ON users (LOWER(email))    WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_username_active_uq ON users (LOWER(username)) WHERE deleted_at IS NULL;
CREATE INDEX users_deleted_at_idx ON users (deleted_at);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────── CHARACTERS ───────────────────────────
CREATE TABLE characters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name            VARCHAR(60) NOT NULL,

  race            VARCHAR(32) NOT NULL CHECK (race IN (
                    'humano','elfo','meio_elfo','anao','halfling','gnomo','tiefling',
                    'draconato','meio_orc','githyanki','satiro','ninfa')),
  class           VARCHAR(32) NOT NULL CHECK (class IN (
                    'barbaro','bardo','clerigo','druida','guerreiro','monge','paladino',
                    'patrulheiro','ladino','feiticeiro','bruxo','mago')),
  subclass        VARCHAR(60),
  level           SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 20),
  experience      INTEGER  NOT NULL DEFAULT 0 CHECK (experience >= 0),

  -- Pai/Mãe Olímpico e afinidade (0–100)
  godly_parent    VARCHAR(32) NOT NULL DEFAULT 'nao_reclamado' CHECK (godly_parent IN (
                    'nao_reclamado','zeus','poseidon','hades','atena','ares','apolo','artemis',
                    'hefesto','afrodite','hermes','dionisio','demeter','hecate','nemesis','hipnos')),
  godly_affinity  SMALLINT NOT NULL DEFAULT 0 CHECK (godly_affinity BETWEEN 0 AND 100),

  -- Atributos
  forca           SMALLINT NOT NULL CHECK (forca        BETWEEN 1 AND 30),
  destreza        SMALLINT NOT NULL CHECK (destreza     BETWEEN 1 AND 30),
  constituicao    SMALLINT NOT NULL CHECK (constituicao BETWEEN 1 AND 30),
  inteligencia    SMALLINT NOT NULL CHECK (inteligencia BETWEEN 1 AND 30),
  sabedoria       SMALLINT NOT NULL CHECK (sabedoria    BETWEEN 1 AND 30),
  carisma         SMALLINT NOT NULL CHECK (carisma      BETWEEN 1 AND 30),

  -- Combate
  max_hp          INTEGER  NOT NULL CHECK (max_hp >= 1),
  current_hp      INTEGER  NOT NULL CHECK (current_hp >= 0),
  temp_hp         INTEGER  NOT NULL DEFAULT 0 CHECK (temp_hp >= 0),
  armor_class     SMALLINT NOT NULL DEFAULT 10,

  -- Ficha (equipamento validado por classe na camada de modelo)
  equipment       JSONB NOT NULL DEFAULT '{}'::jsonb,
  inventory       JSONB NOT NULL DEFAULT '[]'::jsonb,
  sheet           JSONB NOT NULL DEFAULT '{}'::jsonb,
  backstory       TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,          -- Soft Delete: NULL = ativo

  CONSTRAINT characters_hp_cap CHECK (current_hp <= max_hp),
  CONSTRAINT characters_equipment_obj CHECK (jsonb_typeof(equipment) = 'object'),
  CONSTRAINT characters_inventory_arr CHECK (jsonb_typeof(inventory) = 'array')
);

CREATE INDEX characters_user_active_idx ON characters (user_id) WHERE deleted_at IS NULL;
CREATE INDEX characters_deleted_at_idx  ON characters (deleted_at);

CREATE TRIGGER characters_updated_at BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Views de conveniência que já filtram o Soft Delete
CREATE VIEW active_users      AS SELECT * FROM users      WHERE deleted_at IS NULL;
CREATE VIEW active_characters AS SELECT * FROM characters WHERE deleted_at IS NULL;
`;
