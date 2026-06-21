-- Step 1: Learner model & schema
-- Replaces the flat context_state blob with a principled, per-concept learner model.

-- Concepts / skills tracked by the system
CREATE TABLE IF NOT EXISTS concepts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    topic       TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (name, topic)
);

-- Lightweight prerequisite graph (concept A requires concept B)
CREATE TABLE IF NOT EXISTS concept_prerequisites (
    concept_id      UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    prerequisite_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    PRIMARY KEY (concept_id, prerequisite_id),
    CHECK (concept_id <> prerequisite_id)
);

-- Per user × concept state: mastery, scheduling, attempt stats
CREATE TABLE IF NOT EXISTS learner_concept_state (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    concept_id      UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    mastery         DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    uncertainty     DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    correct_count   INTEGER NOT NULL DEFAULT 0,
    last_seen       TIMESTAMPTZ,
    next_review     TIMESTAMPTZ,
    streak          INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, concept_id)
);

-- Immutable log of every graded interaction
CREATE TABLE IF NOT EXISTS attempts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    concept_id  UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    session_id  UUID,
    mode        TEXT NOT NULL,
    score       DOUBLE PRECISION NOT NULL,
    latency_ms  INTEGER,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Study sessions
CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    intent      TEXT,
    plan        JSONB DEFAULT '{}',
    outcomes    JSONB DEFAULT '{}',
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at    TIMESTAMPTZ
);

-- Indexes for query patterns
CREATE INDEX IF NOT EXISTS idx_learner_state_user       ON learner_concept_state (user_id);
CREATE INDEX IF NOT EXISTS idx_learner_state_concept    ON learner_concept_state (concept_id);
CREATE INDEX IF NOT EXISTS idx_learner_state_review     ON learner_concept_state (next_review);
CREATE INDEX IF NOT EXISTS idx_attempts_user            ON attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_concept         ON attempts (concept_id);
CREATE INDEX IF NOT EXISTS idx_attempts_session         ON attempts (session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user            ON sessions (user_id);
