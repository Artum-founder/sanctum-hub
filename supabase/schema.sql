-- Sanctum hub-oppstart: tabellene i Supabase «sol», schema tantric (ved siden av Sanctum-appens egne tabeller).
-- Allerede kjørt i «sol» 15. oktober 2026. Ligger her så de kan lages på nytt ved behov.
-- Bare serveren når tabellene, med service role-nøkkelen, på samme måte som Sanctum.

CREATE TABLE IF NOT EXISTS tantric.hub_onboarding_profiles (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  pin_hash        TEXT NOT NULL,
  pin_salt        TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  answers         JSONB NOT NULL DEFAULT '{}'::jsonb,
  step            INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft',
  photo           TEXT,
  has_photo       BOOLEAN GENERATED ALWAYS AS (photo IS NOT NULL) STORED,
  consent_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tantric.hub_onboarding_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES tantric.hub_onboarding_profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_onboarding_sessions_user_idx ON tantric.hub_onboarding_sessions (user_id);
CREATE INDEX IF NOT EXISTS hub_onboarding_sessions_expires_idx ON tantric.hub_onboarding_sessions (expires_at);

ALTER TABLE tantric.hub_onboarding_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tantric.hub_onboarding_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tantric.hub_onboarding_profiles, tantric.hub_onboarding_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tantric.hub_onboarding_profiles, tantric.hub_onboarding_sessions TO service_role;
