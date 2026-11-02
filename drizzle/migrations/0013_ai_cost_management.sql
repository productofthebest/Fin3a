DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Singleton AI settings. Budgets in USD; NULL = no budget set.
CREATE TABLE public.ai_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ai_enabled boolean NOT NULL DEFAULT true,
  daily_budget_usd numeric(12,4) CHECK (daily_budget_usd IS NULL OR daily_budget_usd >= 0),
  monthly_budget_usd numeric(12,4) CHECK (monthly_budget_usd IS NULL OR monthly_budget_usd >= 0),
  user_daily_requests integer NOT NULL DEFAULT 100 CHECK (user_daily_requests BETWEEN 0 AND 10000),
  user_daily_scans integer NOT NULL DEFAULT 20 CHECK (user_daily_scans BETWEEN 0 AND 1000),
  user_monthly_scans integer NOT NULL DEFAULT 200 CHECK (user_monthly_scans BETWEEN 0 AND 20000),
  warn_percent integer NOT NULL DEFAULT 80 CHECK (warn_percent BETWEEN 1 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.ai_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- Prices per 1M tokens, entered by an admin from OpenAI's official pricing page. No price = cost unknown.
CREATE TABLE public.ai_model_prices (
  model text PRIMARY KEY CHECK (char_length(model) BETWEEN 1 AND 100),
  input_per_mtok numeric(12,6) NOT NULL CHECK (input_per_mtok >= 0),
  cached_input_per_mtok numeric(12,6) CHECK (cached_input_per_mtok IS NULL OR cached_input_per_mtok >= 0),
  output_per_mtok numeric(12,6) NOT NULL CHECK (output_per_mtok >= 0),
  source_note text CHECK (source_note IS NULL OR char_length(source_note) <= 300),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_model_prices TO service_role;
ALTER TABLE public.ai_model_prices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_user_limits (
  user_id uuid PRIMARY KEY,
  daily_requests integer CHECK (daily_requests IS NULL OR daily_requests BETWEEN 0 AND 10000),
  daily_scans integer CHECK (daily_scans IS NULL OR daily_scans BETWEEN 0 AND 1000),
  monthly_scans integer CHECK (monthly_scans IS NULL OR monthly_scans BETWEEN 0 AND 20000),
  blocked boolean NOT NULL DEFAULT false,
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_user_limits TO service_role;
ALTER TABLE public.ai_user_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL CHECK (feature IN ('assistant','landing_chat','transcribe','scan')),
  request_key text CHECK (request_key IS NULL OR char_length(request_key) <= 200),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ok','failed')),
  model text,
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  cached_input_tokens integer CHECK (cached_input_tokens IS NULL OR cached_input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  units integer NOT NULL DEFAULT 1 CHECK (units >= 0),
  est_cost_usd numeric(14,8),
  error_code text CHECK (error_code IS NULL OR char_length(error_code) <= 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE UNIQUE INDEX ai_usage_log_request_key_idx ON public.ai_usage_log (user_id, request_key) WHERE request_key IS NOT NULL;
CREATE INDEX ai_usage_log_user_time_idx ON public.ai_usage_log (user_id, created_at DESC);
CREATE INDEX ai_usage_log_time_idx ON public.ai_usage_log (created_at DESC);
GRANT ALL ON public.ai_usage_log TO service_role;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ai_price_estimate(_model text, _in integer, _cached integer, _out integer)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p.model IS NULL OR _in IS NULL OR _out IS NULL THEN NULL ELSE
    ((greatest(_in - coalesce(_cached,0),0) * p.input_per_mtok)
     + (coalesce(_cached,0) * coalesce(p.cached_input_per_mtok, p.input_per_mtok))
     + (_out * p.output_per_mtok)) / 1000000.0 END
  FROM (SELECT 1) x LEFT JOIN public.ai_model_prices p ON p.model = _model
$$;
REVOKE ALL ON FUNCTION public.ai_price_estimate(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;

-- Atomic preflight: kill switch, user block, per-user limits, global budgets, duplicate requests.
CREATE OR REPLACE FUNCTION public.ai_begin(_feature text, _request_key text, _units integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  s public.ai_settings;
  l public.ai_user_limits;
  _day timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  _month timestamptz := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  _limit integer; _used integer; _mlimit integer; _mused integer;
  _day_cost numeric; _month_cost numeric; _id uuid; _warn text := NULL;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'auth'); END IF;
  IF _feature NOT IN ('assistant','landing_chat','transcribe','scan') OR _units < 1 OR _units > 100 THEN RAISE EXCEPTION 'invalid ai request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ai:' || _uid::text, 0));
  SELECT * INTO s FROM public.ai_settings WHERE id;
  IF NOT coalesce(s.ai_enabled, false) THEN RETURN jsonb_build_object('allowed', false, 'reason', 'disabled'); END IF;
  SELECT * INTO l FROM public.ai_user_limits WHERE user_id = _uid;
  IF coalesce(l.blocked, false) THEN RETURN jsonb_build_object('allowed', false, 'reason', 'blocked'); END IF;

  IF _request_key IS NOT NULL AND EXISTS (SELECT 1 FROM public.ai_usage_log WHERE user_id = _uid AND request_key = _request_key) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'duplicate');
  END IF;

  SELECT coalesce(sum(est_cost_usd),0) INTO _day_cost FROM public.ai_usage_log WHERE created_at >= _day;
  SELECT coalesce(sum(est_cost_usd),0) INTO _month_cost FROM public.ai_usage_log WHERE created_at >= _month;
  IF s.daily_budget_usd IS NOT NULL AND _day_cost >= s.daily_budget_usd THEN RETURN jsonb_build_object('allowed', false, 'reason', 'budget'); END IF;
  IF s.monthly_budget_usd IS NOT NULL AND _month_cost >= s.monthly_budget_usd THEN RETURN jsonb_build_object('allowed', false, 'reason', 'budget'); END IF;

  IF _feature = 'scan' THEN
    _limit := coalesce(l.daily_scans, s.user_daily_scans);
    _mlimit := coalesce(l.monthly_scans, s.user_monthly_scans);
    SELECT coalesce(sum(units),0) INTO _used FROM public.ai_usage_log WHERE user_id = _uid AND feature = 'scan' AND status <> 'failed' AND created_at >= _day;
    SELECT coalesce(sum(units),0) INTO _mused FROM public.ai_usage_log WHERE user_id = _uid AND feature = 'scan' AND status <> 'failed' AND created_at >= _month;
    IF _mused + _units > _mlimit THEN RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_scan_limit'); END IF;
  ELSE
    _limit := coalesce(l.daily_requests, s.user_daily_requests);
    SELECT coalesce(sum(units),0) INTO _used FROM public.ai_usage_log WHERE user_id = _uid AND feature <> 'scan' AND created_at >= _day;
  END IF;
  IF _used + _units > _limit THEN RETURN jsonb_build_object('allowed', false, 'reason', CASE WHEN _feature = 'scan' THEN 'daily_scan_limit' ELSE 'daily_limit' END); END IF;
  IF (_used + _units) * 100 >= _limit * s.warn_percent THEN
    _warn := format('You have used %s of %s %s today.', _used + _units, _limit, CASE WHEN _feature = 'scan' THEN 'document scans' ELSE 'AI requests' END);
  END IF;

  INSERT INTO public.ai_usage_log (user_id, feature, request_key, units) VALUES (_uid, _feature, _request_key, _units) RETURNING id INTO _id;
  RETURN jsonb_build_object('allowed', true, 'usage_id', _id, 'warning', _warn);
END;
$$;
REVOKE ALL ON FUNCTION public.ai_begin(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_begin(text, text, integer) TO authenticated;

-- Records the outcome. Failed scans no longer count toward scan limits.
CREATE OR REPLACE FUNCTION public.ai_finish(_usage_id uuid, _status text, _model text, _in integer, _cached integer, _out integer, _error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status NOT IN ('ok','failed') THEN RAISE EXCEPTION 'invalid status'; END IF;
  UPDATE public.ai_usage_log SET
    status = _status, model = left(_model, 100), input_tokens = _in, cached_input_tokens = _cached, output_tokens = _out,
    est_cost_usd = public.ai_price_estimate(_model, _in, _cached, _out), error_code = left(_error, 80), finished_at = now()
  WHERE id = _usage_id AND user_id = auth.uid() AND status = 'pending';
END;
$$;
REVOKE ALL ON FUNCTION public.ai_finish(uuid, text, text, integer, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_finish(uuid, text, text, integer, integer, integer, text) TO authenticated;

-- Admin-only reads and writes. No financial data is exposed.
CREATE OR REPLACE FUNCTION public.ai_admin_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _day timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  _month timestamptz := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'settings', (SELECT to_jsonb(s) - 'id' FROM public.ai_settings s WHERE id),
    'prices', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.model) FROM public.ai_model_prices p), '[]'::jsonb),
    'today', (SELECT jsonb_build_object('requests', count(*), 'failed', count(*) FILTER (WHERE status='failed'),
        'input_tokens', coalesce(sum(input_tokens),0), 'output_tokens', coalesce(sum(output_tokens),0),
        'est_cost_usd', sum(est_cost_usd), 'unpriced', count(*) FILTER (WHERE status <> 'pending' AND est_cost_usd IS NULL))
      FROM public.ai_usage_log WHERE created_at >= _day),
    'month', (SELECT jsonb_build_object('requests', count(*), 'failed', count(*) FILTER (WHERE status='failed'),
        'input_tokens', coalesce(sum(input_tokens),0), 'output_tokens', coalesce(sum(output_tokens),0),
        'est_cost_usd', sum(est_cost_usd), 'failed_cost_usd', sum(est_cost_usd) FILTER (WHERE status='failed'),
        'unpriced', count(*) FILTER (WHERE status <> 'pending' AND est_cost_usd IS NULL))
      FROM public.ai_usage_log WHERE created_at >= _month),
    'by_feature', coalesce((SELECT jsonb_agg(f) FROM (SELECT feature, count(*) AS requests, count(*) FILTER (WHERE status='failed') AS failed,
        coalesce(sum(input_tokens),0) AS input_tokens, coalesce(sum(output_tokens),0) AS output_tokens, sum(est_cost_usd) AS est_cost_usd
      FROM public.ai_usage_log WHERE created_at >= _month GROUP BY feature ORDER BY feature) f), '[]'::jsonb),
    'daily', coalesce((SELECT jsonb_agg(d ORDER BY d.day) FROM (SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*) AS requests, sum(est_cost_usd) AS est_cost_usd
      FROM public.ai_usage_log WHERE created_at >= now() - interval '30 days' GROUP BY 1) d), '[]'::jsonb),
    'users', coalesce((SELECT jsonb_agg(u ORDER BY u.requests DESC) FROM (
      SELECT g.user_id, au.email, g.requests, g.scans, g.failed, g.tokens, g.est_cost_usd, g.today,
        lim.daily_requests, lim.daily_scans, lim.monthly_scans, coalesce(lim.blocked,false) AS blocked
      FROM (SELECT user_id, count(*) AS requests, coalesce(sum(units) FILTER (WHERE feature='scan'),0) AS scans,
          count(*) FILTER (WHERE status='failed') AS failed,
          coalesce(sum(coalesce(input_tokens,0)+coalesce(output_tokens,0)),0) AS tokens, sum(est_cost_usd) AS est_cost_usd,
          count(*) FILTER (WHERE created_at >= _day) AS today
        FROM public.ai_usage_log WHERE created_at >= _month GROUP BY user_id) g
      LEFT JOIN auth.users au ON au.id = g.user_id
      LEFT JOIN public.ai_user_limits lim ON lim.user_id = g.user_id
      LIMIT 200) u), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.ai_admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_admin_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.ai_admin_update_settings(_enabled boolean, _daily numeric, _monthly numeric, _user_daily integer, _scans_daily integer, _scans_monthly integer, _warn integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.ai_settings SET ai_enabled = _enabled, daily_budget_usd = _daily, monthly_budget_usd = _monthly,
    user_daily_requests = _user_daily, user_daily_scans = _scans_daily, user_monthly_scans = _scans_monthly,
    warn_percent = _warn, updated_at = now(), updated_by = auth.uid() WHERE id;
END;
$$;
REVOKE ALL ON FUNCTION public.ai_admin_update_settings(boolean, numeric, numeric, integer, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_admin_update_settings(boolean, numeric, numeric, integer, integer, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.ai_admin_set_price(_model text, _input numeric, _cached numeric, _output numeric, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.ai_model_prices (model, input_per_mtok, cached_input_per_mtok, output_per_mtok, source_note, updated_at)
  VALUES (_model, _input, _cached, _output, _note, now())
  ON CONFLICT (model) DO UPDATE SET input_per_mtok = EXCLUDED.input_per_mtok, cached_input_per_mtok = EXCLUDED.cached_input_per_mtok,
    output_per_mtok = EXCLUDED.output_per_mtok, source_note = EXCLUDED.source_note, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.ai_admin_set_price(text, numeric, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_admin_set_price(text, numeric, numeric, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ai_admin_set_user_limit(_user_id uuid, _daily integer, _scans_daily integer, _scans_monthly integer, _blocked boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.ai_user_limits (user_id, daily_requests, daily_scans, monthly_scans, blocked, note, updated_at)
  VALUES (_user_id, _daily, _scans_daily, _scans_monthly, _blocked, _note, now())
  ON CONFLICT (user_id) DO UPDATE SET daily_requests = EXCLUDED.daily_requests, daily_scans = EXCLUDED.daily_scans,
    monthly_scans = EXCLUDED.monthly_scans, blocked = EXCLUDED.blocked, note = EXCLUDED.note, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.ai_admin_set_user_limit(uuid, integer, integer, integer, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_admin_set_user_limit(uuid, integer, integer, integer, boolean, text) TO authenticated;