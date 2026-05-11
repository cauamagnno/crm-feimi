CREATE TYPE public.test_role AS ENUM ('admin', 'agent');
CREATE TABLE test_tab (role test_role);
INSERT INTO test_tab VALUES ('owner');
