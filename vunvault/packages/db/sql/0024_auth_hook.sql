-- KEEP IN SYNC with packages/contracts/src/permissions.ts; a test compares them.
--
-- Supabase Auth Hook (Custom Access Token).
--
-- Enabled in the Supabase dashboard: Authentication -> Hooks -> Custom Access
-- Token -> `public.vv_custom_access_token_hook`. Supabase calls it while minting
-- an access token and merges the returned claims into the JWT, which is how
-- `role`, `org_id` and `permissions[]` reach the API without a database read per
-- request.
--
-- Fail-safe direction: a missing profile, a non-active account or a soft-deleted
-- profile all yield `role = 'client'` and `permissions = []` — the least privilege
-- the platform has. The function is SECURITY DEFINER because `supabase_auth_admin`
-- must read `profiles`, which RLS otherwise hides from it.

CREATE OR REPLACE FUNCTION public.vv_custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user_id     uuid;
  v_role        public.user_role;
  v_org_id      uuid;
  v_status      public.account_status;
  v_deleted_at  timestamptz;
  v_permissions jsonb;
BEGIN
  v_user_id := NULLIF(event ->> 'user_id', '')::uuid;

  -- No user id (anonymous or service token): least privilege.
  IF v_user_id IS NULL THEN
    RETURN jsonb_set(
      jsonb_set(event, '{role}', to_jsonb('client'::text), true),
      '{permissions}', '[]'::jsonb, true
    );
  END IF;

  SELECT p.role, p.org_id, p.account_status, p.deleted_at
    INTO v_role, v_org_id, v_status, v_deleted_at
    FROM public.profiles p
   WHERE p.id = v_user_id;

  -- No profile, a suspended/dormant/pending account, or a soft-deleted profile:
  -- the caller keeps an authenticated token but no authority at all.
  IF NOT FOUND OR v_status <> 'active' OR v_deleted_at IS NOT NULL THEN
    RETURN jsonb_set(
      jsonb_set(event, '{role}', to_jsonb('client'::text), true),
      '{permissions}', '[]'::jsonb, true
    );
  END IF;

  v_permissions := CASE v_role
    WHEN 'super_admin' THEN '["dashboard:read", "scans:read", "scans:create", "scans:execute", "scans:review", "scans:release", "intel:read", "intel:write", "intel:broadcast", "users:read", "users:manage", "content:author", "content:moderate", "audit:read", "audit:verify", "billing:read", "billing:manage", "support:handle", "profile:read", "profile:write"]'::jsonb
    WHEN 'admin' THEN '["dashboard:read", "scans:read", "scans:create", "scans:execute", "scans:review", "scans:release", "intel:read", "intel:write", "intel:broadcast", "users:read", "content:author", "content:moderate", "audit:read", "audit:verify", "billing:read", "billing:manage", "support:handle", "profile:read", "profile:write"]'::jsonb
    WHEN 'security_analyst' THEN '["dashboard:read", "scans:read", "scans:create", "scans:execute", "intel:read", "intel:write", "content:author", "profile:read", "profile:write"]'::jsonb
    WHEN 'soc_operator' THEN '["dashboard:read", "scans:read", "scans:execute", "intel:read", "profile:read", "profile:write"]'::jsonb
    WHEN 'compliance_auditor' THEN '["dashboard:read", "scans:read", "audit:read", "profile:read", "profile:write"]'::jsonb
    WHEN 'support_engineer' THEN '["support:handle", "profile:read", "profile:write"]'::jsonb
    WHEN 'client' THEN '["scans:read", "scans:create", "billing:read", "billing:manage", "profile:read", "profile:write"]'::jsonb
    ELSE '[]'::jsonb
  END;

  RETURN jsonb_set(
    jsonb_set(
      jsonb_set(event, '{role}', to_jsonb(v_role::text), true),
      '{org_id}',
      CASE WHEN v_org_id IS NULL THEN 'null'::jsonb ELSE to_jsonb(v_org_id::text) END,
      true
    ),
    '{permissions}', v_permissions, true
  );
END;
$fn$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.vv_custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.vv_custom_access_token_hook(jsonb) FROM authenticated, anon, public;
