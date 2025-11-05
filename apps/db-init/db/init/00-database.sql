\connect gql_cms;

-- Create gql_cms schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS gql_cms;

/*Create forum_users table in gql-cms schema*/
CREATE TABLE gql_cms.forum_users (
    id SERIAL PRIMARY KEY,
    username TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE gql_cms.forum_users IS
'Forum users.';

/*Create post table in gql-cms schema*/
CREATE TABLE gql_cms.post (
    id SERIAL PRIMARY KEY,
    title TEXT,
    body TEXT,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    author_id INTEGER NOT NULL REFERENCES gql_cms.forum_users(id)
);

COMMENT ON TABLE gql_cms.post IS
'Forum posts written by a user.';
