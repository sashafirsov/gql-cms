# Slug
* is a `short_url` field in `gql_cms.documents` table
* slug can be any short string, except of the one of keys in apps/admin-ui/src/i18n.ts which is used as `/[lang]`

## Unique Slug Creation Mechanism

### Generation Algorithm
Location: `apps/admin-ui/src/app/[lang]/urls/page.tsx`

1. **Character Set**: `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` (62 characters)
   - Lowercase letters: a-z (26 chars)
   - Uppercase letters: A-Z (26 chars)
   - Digits: 0-9 (10 chars)

2. **Slug Length**: 6 characters
   - Total possible combinations: 62^6 = 56,800,235,584 (~56.8 billion)
   - Random generation using `Math.random()`

3. **Generation Function**:
```javascript
const generateSlug = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let slug = '';
  for (let i = 0; i < 6; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
};
```

### Uniqueness Guarantee

**How the Requirement is Achieved: "Ensure the slug of the URL is unique"**

The uniqueness of slugs (e.g., `abc123`) is **guaranteed at the database level**, making it impossible to create duplicate slugs.

**1. Database Level Enforcement** (Primary Mechanism):
- **Table**: `gql_cms.documents`
- **Constraint**: `documents_short_url_key` (UNIQUE CONSTRAINT on `short_url` column)
- **Creation**: Defined in `apps/db-init/db/init/20-gql-cms-schema.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS gql_cms.documents (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_url   text NOT NULL,
    short_url  text NOT NULL UNIQUE,
    comment    text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  ```
- **Effect**: PostgreSQL **physically prevents** inserting duplicate `short_url` values
- **Result**: Uniqueness is 100% guaranteed - no duplicate slugs can exist in the database

**2. Client-Side Generation** (Supporting Mechanism):
- Random 6-character alphanumeric generation minimizes collision probability
- 62^6 = 56,800,235,584 possible combinations
- Even with millions of URLs, collision chance remains below 1%

**3. Collision Handling Flow**:
```
User creates short URL
  ↓
Client generates random slug (e.g., "abc123")
  ↓
GraphQL mutation: createDocument(shortUrl: "abc123", ...)
  ↓
PostgreSQL attempts INSERT
  ↓
  ├─ If unique: ✅ Success - slug "abc123" is created
  │
  └─ If duplicate: ❌ Constraint violation error
      ↓
      Error: duplicate key value violates unique constraint "documents_short_url_key"
      ↓
      User sees: "Failed to create short URL"
      ↓
      User clicks "Shorten" again → New random slug generated
```

**4. Verification**:
You can verify the unique constraint exists:
```bash
docker exec gql-cms-db psql -U postgres -d gql_cms -c "\d gql_cms.documents"
```

Output shows:
```
Indexes:
    "documents_pkey" PRIMARY KEY, btree (id)
    "documents_short_url_key" UNIQUE CONSTRAINT, btree (short_url)
```

**Summary**: Slug uniqueness is **guaranteed by PostgreSQL's UNIQUE constraint**, not by application logic. 
This is the most reliable method as it's enforced at the database layer and prevents race conditions.

**Collision Probability**:
- First slug: 0% collision chance
- After 1 million slugs: ~0.0018% collision chance per attempt
- After 10 million slugs: ~0.018% collision chance per attempt
- After 100 million slugs: ~0.18% collision chance per attempt

### Reserved Slugs

Slugs matching language keys in `i18n.ts` are reserved and cannot be used for URL shortening:
- `en`, `en-gb`, `es`, `fr`, `de`, `jp`, `pt`, `il`, `in`, `ua`, `kr`, `ar`

These are handled by the `[lang]` route as language selectors rather than short URLs.

## slug processing by [lang](../apps/admin-ui/src/app/[lang]/page.tsx)
* `lang` url part is treated as slug if it is not a key in `i18n` object
* when `lang` is detected, the page is rendered
* otherwise a slug is detected,

1. graphql query to get `full_url`, `id`  by `short_url` equals slug name
2. graphql adds the entry in `gql_cms.slug` with `slug`, `url`, `user_agent`, `document.id`
* if `document` is found, JS will set browser page url to `full_url`
* otherwise forward to 404 not found page

## Slug Access Tracking

Every time a short URL is accessed, a tracking record is created in `gql_cms.slug`:

**Fields**:
- `slug` - The short URL that was accessed
- `url` - The full URL the user was redirected to
- `user_agent` - The User-Agent header from the HTTP request
- `document_id` - Foreign key to `gql_cms.documents`
- `created_at` - Timestamp of access

**Access Control**:
- INSERT: Allowed for anonymous and authenticated users (tracks all accesses)
- SELECT: Restricted to admin, manager, and bot roles (for analytics)
- UPDATE/DELETE: Not allowed (append-only audit log)

**Implementation**: Client-side mutation in `[lang]/page.tsx` before redirect:
```graphql
mutation CreateSlug($slug: String!, $url: String!, $userAgent: String, $documentId: UUID!) {
  createSlug(input: {
    slug: { slug: $slug, url: $url, userAgent: $userAgent, documentId: $documentId }
  }) {
    slug { id }
  }
}
```
