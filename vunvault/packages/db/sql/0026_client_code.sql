-- Human client codes: `VV-CL-48210`.
--
-- The sequence starts at 48211 because 48210 was the last code issued before the
-- platform moved onto this schema. Codes are allocated at signup, inside the same
-- transaction as the organisation row, so two organisations can never share one.

CREATE SEQUENCE IF NOT EXISTS client_code_seq START 48211;

CREATE OR REPLACE FUNCTION next_client_code() RETURNS text
LANGUAGE sql
AS $fn$
  SELECT 'VV-CL-' || lpad(nextval('client_code_seq')::text, 5, '0');
$fn$;
