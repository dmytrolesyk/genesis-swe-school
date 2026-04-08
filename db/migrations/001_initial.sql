CREATE TABLE IF NOT EXISTS repositories (
  repo_full_name text PRIMARY KEY,
  last_seen_tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  repo_full_name text NOT NULL REFERENCES repositories(repo_full_name),
  confirm_token uuid NOT NULL,
  unsubscribe_token uuid NOT NULL,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_email_repo_active_idx
  ON subscriptions(email, repo_full_name)
  WHERE unsubscribed_at IS NULL;
