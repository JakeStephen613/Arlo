-- Migration 002: Subject folders + resources
-- Run in Supabase SQL editor

-- Subject folders
CREATE TABLE IF NOT EXISTS subjects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT NOT NULL DEFAULT 'blue',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects (user_id);

-- Resources attached to subjects (stored in Supabase Storage bucket: subject-resources)
CREATE TABLE IF NOT EXISTS subject_resources (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,
    file_name   TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    file_type   TEXT,
    size_bytes  BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subject_resources_subject ON subject_resources (subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_resources_user    ON subject_resources (user_id);

-- Add subject_id to completed sessions
ALTER TABLE study_session_data
    ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;

-- Add subject_id to paused sessions
ALTER TABLE paused_sessions
    ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;

-- RLS policies (enable RLS on these tables in the Supabase dashboard)
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own subjects"
    ON subjects FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own subject resources"
    ON subject_resources FOR ALL USING (auth.uid() = user_id);

-- NOTE: After running this migration, create a Supabase Storage bucket
-- named "subject-resources" with the following settings:
--   - Public: false (private)
--   - Add RLS policy: allow authenticated users to upload/download their own files
--   Policy example:
--     bucket_id = 'subject-resources' AND auth.uid()::text = (storage.foldername(name))[1]
