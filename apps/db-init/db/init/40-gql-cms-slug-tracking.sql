-- Slug Access Tracking Table
-- Tracks when shortened URLs are accessed

CREATE TABLE IF NOT EXISTS gql_cms.slug (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    user_agent TEXT,
    document_id UUID NOT NULL REFERENCES gql_cms.documents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_slug_document_id ON gql_cms.slug(document_id);
CREATE INDEX IF NOT EXISTS idx_slug_created_at ON gql_cms.slug(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slug_slug ON gql_cms.slug(slug);

-- Enable RLS
ALTER TABLE gql_cms.slug ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT, INSERT ON gql_cms.slug TO anonymous;
GRANT SELECT, INSERT ON gql_cms.slug TO app_user;
GRANT ALL ON gql_cms.slug TO admin;
GRANT ALL ON gql_cms.slug TO manager;

-- RLS Policies

-- Allow anonymous users to INSERT slug tracking records
CREATE POLICY slug_insert_anonymous ON gql_cms.slug FOR INSERT
TO anonymous
WITH CHECK (true);

-- Allow anonymous users to INSERT slug tracking records (for authenticated users too)
CREATE POLICY slug_insert_authenticated ON gql_cms.slug FOR INSERT
TO app_user
WITH CHECK (true);

-- Allow everyone to SELECT slug tracking records
-- (Admins and managers need visibility, regular users might need analytics)
CREATE POLICY slug_select ON gql_cms.slug FOR SELECT
USING (
  gql_cms.has_global_role('admin')
  OR gql_cms.has_global_role('manager')
  OR gql_cms.has_global_role('bot')
);

-- No UPDATE or DELETE policies - slug tracking is append-only for audit purposes

-- Add comment to table
COMMENT ON TABLE gql_cms.slug IS 'Tracks accesses to shortened URLs for analytics and auditing';
COMMENT ON COLUMN gql_cms.slug.slug IS 'The short URL slug that was accessed';
COMMENT ON COLUMN gql_cms.slug.url IS 'The full URL that the user was redirected to';
COMMENT ON COLUMN gql_cms.slug.user_agent IS 'The User-Agent header of the request';
COMMENT ON COLUMN gql_cms.slug.document_id IS 'Reference to the document that was accessed';
COMMENT ON COLUMN gql_cms.slug.created_at IS 'When the slug was accessed';
