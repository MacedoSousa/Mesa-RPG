import type { QueryInterface } from 'sequelize';

/**
 * Esquema inicial do Mesa RPG.
 * Soft Delete: users, campaigns, characters, character_sheets, items, game_maps e save_games têm deleted_at.
 * Índices únicos são PARCIAIS (WHERE deleted_at IS NULL): um registro removido não bloqueia o reuso.
 */
export const name = '0001_initial';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE users (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username       VARCHAR(32)  NOT NULL,
      email          VARCHAR(255) NOT NULL,
      password_hash  TEXT         NOT NULL,
      display_name   VARCHAR(60),
      role           VARCHAR(10)  NOT NULL DEFAULT 'PLAYER' CHECK (role IN ('MASTER', 'PLAYER')),
      token_version  INTEGER      NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      deleted_at     TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX users_email_active_uq    ON users (LOWER(email))    WHERE deleted_at IS NULL;
    CREATE UNIQUE INDEX users_username_active_uq ON users (LOWER(username)) WHERE deleted_at IS NULL;

    CREATE TABLE campaigns (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      master_id    UUID NOT NULL REFERENCES users(id),
      name         VARCHAR(80) NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      join_code    VARCHAR(8) NOT NULL,
      settings     JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at   TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX campaigns_join_code_active_uq ON campaigns (join_code) WHERE deleted_at IS NULL;
    CREATE INDEX campaigns_master_idx ON campaigns (master_id) WHERE deleted_at IS NULL;

    CREATE TABLE characters (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID NOT NULL REFERENCES users(id),
      campaign_id     UUID REFERENCES campaigns(id),
      name            VARCHAR(60) NOT NULL,
      race            VARCHAR(32) NOT NULL,
      divinity        VARCHAR(32) NOT NULL,
      class_key       VARCHAR(32) NOT NULL,
      level           SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 20),
      experience      INTEGER  NOT NULL DEFAULT 0 CHECK (experience >= 0),
      affinity        SMALLINT NOT NULL DEFAULT 0 CHECK (affinity BETWEEN 0 AND 100),
      base_abilities  JSONB NOT NULL,
      skills          JSONB NOT NULL DEFAULT '[]'::jsonb,
      equipment       JSONB NOT NULL DEFAULT '{}'::jsonb,
      hp              INTEGER NOT NULL CHECK (hp >= 0),
      stamina         INTEGER NOT NULL CHECK (stamina >= 0),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      CONSTRAINT characters_equipment_obj CHECK (jsonb_typeof(equipment) = 'object'),
      CONSTRAINT characters_abilities_obj CHECK (jsonb_typeof(base_abilities) = 'object')
    );
    CREATE INDEX characters_user_active_idx ON characters (user_id) WHERE deleted_at IS NULL;

    CREATE TABLE character_sheets (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      character_id  UUID NOT NULL REFERENCES characters(id),
      backstory     TEXT NOT NULL DEFAULT '',
      personality   TEXT NOT NULL DEFAULT '',
      appearance    TEXT NOT NULL DEFAULT '',
      notes         TEXT NOT NULL DEFAULT '',
      languages     JSONB NOT NULL DEFAULT '[]'::jsonb,
      extra         JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at    TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX character_sheets_character_active_uq ON character_sheets (character_id) WHERE deleted_at IS NULL;

    CREATE TABLE inventory_items (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      character_id  UUID NOT NULL REFERENCES characters(id),
      item_key      VARCHAR(60) NOT NULL,
      quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (character_id, item_key)
    );

    CREATE TABLE items (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key          VARCHAR(60) NOT NULL,
      campaign_id  UUID REFERENCES campaigns(id),
      kind         VARCHAR(20) NOT NULL,
      name         VARCHAR(80) NOT NULL,
      definition   JSONB NOT NULL,
      is_custom    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at   TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX items_base_key_active_uq     ON items (key)              WHERE campaign_id IS NULL     AND deleted_at IS NULL;
    CREATE UNIQUE INDEX items_campaign_key_active_uq ON items (campaign_id, key) WHERE campaign_id IS NOT NULL AND deleted_at IS NULL;

    CREATE TABLE campaign_members (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id   UUID NOT NULL REFERENCES campaigns(id),
      user_id       UUID NOT NULL REFERENCES users(id),
      character_id  UUID REFERENCES characters(id),
      status        VARCHAR(10) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'banido')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (campaign_id, user_id)
    );

    CREATE TABLE game_maps (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id  UUID NOT NULL REFERENCES campaigns(id),
      name         VARCHAR(80) NOT NULL,
      preset       VARCHAR(40),
      width        SMALLINT NOT NULL CHECK (width BETWEEN 4 AND 64),
      height       SMALLINT NOT NULL CHECK (height BETWEEN 4 AND 64),
      tiles        JSONB NOT NULL,
      created_by   UUID REFERENCES users(id),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at   TIMESTAMPTZ
    );
    CREATE INDEX game_maps_campaign_idx ON game_maps (campaign_id) WHERE deleted_at IS NULL;

    CREATE TABLE save_games (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id     UUID NOT NULL REFERENCES campaigns(id),
      name            VARCHAR(80) NOT NULL,
      kind            VARCHAR(10) NOT NULL CHECK (kind IN ('manual', 'auto')),
      schema_version  INTEGER NOT NULL,
      seq             INTEGER NOT NULL DEFAULT 0,
      state           JSONB NOT NULL,
      created_by      UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ
    );
    CREATE INDEX save_games_campaign_idx ON save_games (campaign_id, created_at DESC) WHERE deleted_at IS NULL;

    CREATE TABLE game_events (
      id             BIGSERIAL PRIMARY KEY,
      campaign_id    UUID NOT NULL REFERENCES campaigns(id),
      log_id         INTEGER NOT NULL,
      type           VARCHAR(20) NOT NULL,
      visibility     VARCHAR(10) NOT NULL,
      actor_user_id  UUID,
      text           TEXT NOT NULL,
      data           JSONB,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX game_events_campaign_idx ON game_events (campaign_id, id DESC);
  `);
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.query(`
    DROP TABLE IF EXISTS game_events, save_games, game_maps, campaign_members, items,
      inventory_items, character_sheets, characters, campaigns, users CASCADE;
  `);
}
