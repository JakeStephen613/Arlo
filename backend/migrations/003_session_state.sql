-- Migration 003: Server-side session state persistence
-- Replaces localStorage-based session persistence with server-side storage

-- Active session state (replaces localStorage SESSION_STORAGE_KEY)
CREATE TABLE IF NOT EXISTS active_session_state (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    session_data    JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_active_session_user ON active_session_state (user_id);

ALTER TABLE active_session_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own active session"
    ON active_session_state FOR ALL USING (auth.uid() = user_id);
