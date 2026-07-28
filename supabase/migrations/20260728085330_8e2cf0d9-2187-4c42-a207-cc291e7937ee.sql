
-- Create/refresh vault secret with a random 48-byte hex value (only if missing)
DO $$
DECLARE
  existing uuid;
BEGIN
  SELECT id INTO existing FROM vault.secrets WHERE name = 'OVERDUE_SCAN_SECRET' LIMIT 1;
  IF existing IS NULL THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(48), 'hex'),
      'OVERDUE_SCAN_SECRET',
      'Bearer token for /api/public/hooks/overdue-scan'
    );
  END IF;
END$$;

-- Verify function: compares provided token to vault secret using constant-time-ish check
CREATE OR REPLACE FUNCTION public.verify_overdue_scan_secret(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  s text;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN RETURN false; END IF;
  SELECT decrypted_secret INTO s
  FROM vault.decrypted_secrets
  WHERE name = 'OVERDUE_SCAN_SECRET'
  LIMIT 1;
  IF s IS NULL THEN RETURN false; END IF;
  -- constant-time compare
  RETURN (length(s) = length(_token))
     AND (hashtextextended(s, 0) = hashtextextended(_token, 0))
     AND (s = _token);
END$$;

REVOKE ALL ON FUNCTION public.verify_overdue_scan_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_overdue_scan_secret(text) TO service_role;
