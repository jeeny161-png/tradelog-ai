-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  TEXT,
  category    TEXT NOT NULL DEFAULT '기타',
  message     TEXT NOT NULL,
  rating      INT  CHECK (rating BETWEEN 1 AND 5),
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: anyone (logged-in) may insert; only service role reads
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can insert feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for admin queries
CREATE INDEX IF NOT EXISTS feedback_created_idx ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_resolved_idx ON feedback (resolved, created_at DESC);
