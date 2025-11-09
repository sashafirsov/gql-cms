# Slug
* is a `short_url` field in `gql_cms.documents` table 
* slug can be any short string, except of the one of keys in apps/admin-ui/src/i18n.ts which is used as `/[lang]`

## slug processing by [lang](../apps/admin-ui/src/app/[lang]/page.tsx)
* `lang` url part is treated as slug if it is not a key in `i18n` object 
* when `lang` is detected, the page is rendered
* otherwise a slug is detected, 

1. graphql query to get `full_url`, `id`  by `short_url` equals slug name
2. graphql adds the entry in `gql_cms.slug` with `slug`, `url`, `user_agent`, `document.id`
* if `document` is found, JS will set browser page url to `full_url`
* otherwise forward to 404 not found page
