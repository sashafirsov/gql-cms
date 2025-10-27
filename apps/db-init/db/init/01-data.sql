/*Create some dummy users*/
INSERT INTO gql_cms.user (username) VALUES
('Benjie'),
('Singingwolfboy'),
('Lexius');

/*Create some dummy posts*/
INSERT INTO gql_cms.post (title, body, author_id) VALUES
('First post example', 'Lorem ipsum dolor sit amet', 1),
('Second post example', 'Consectetur adipiscing elit', 2),
('Third post example', 'Aenean blandit felis sodales', 3);
