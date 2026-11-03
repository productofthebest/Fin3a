CREATE TABLE public.ai_guest_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 network_hash text NOT NULL CHECK (length(network_hash)=64),
 created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ok','failed')),
 reserved_usd numeric(14,8) NOT NULL DEFAULT 0.01,
 est_cost_usd numeric(14,8),
 input_tokens integer,
 output_tokens integer
);
GRANT ALL ON public.ai_guest_usage TO service_role;
ALTER TABLE public.ai_guest_usage ENABLE ROW LEVEL SECURITY;
CREATE INDEX ai_guest_usage_network_time ON public.ai_guest_usage(network_hash,created_at);
CREATE INDEX ai_guest_usage_time ON public.ai_guest_usage(created_at);
COMMENT ON TABLE public.ai_guest_usage IS 'Guest homepage admission only: no accounts, messages or financial data; network identifiers HMAC-hashed by server. Reservations retained on unknown outcomes.';
CREATE FUNCTION public.ai_guest_begin(_network_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.ai_settings; d timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; m timestamptz := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; nd integer; gd integer; gm integer; dc numeric; mc numeric; ident uuid;
BEGIN
 IF _network_hash IS NULL OR _network_hash !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('allowed',false,'reason','invalid'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('guest-ai-global',0));
 SELECT * INTO s FROM public.ai_settings WHERE id;
 IF NOT coalesce(s.ai_enabled,false) THEN RETURN jsonb_build_object('allowed',false,'reason','disabled'); END IF;
 SELECT count(*) INTO nd FROM public.ai_guest_usage WHERE network_hash=_network_hash AND created_at>=d;
 SELECT count(*) INTO gd FROM public.ai_guest_usage WHERE created_at>=d;
 SELECT count(*) INTO gm FROM public.ai_guest_usage WHERE created_at>=m;
 IF nd>=10 OR gd>=100 OR gm>=1000 THEN RETURN jsonb_build_object('allowed',false,'reason','limit'); END IF;
 SELECT coalesce(sum(coalesce(est_cost_usd,reserved_usd)),0) INTO dc FROM public.ai_guest_usage WHERE created_at>=d;
 SELECT coalesce(sum(coalesce(est_cost_usd,reserved_usd)),0) INTO mc FROM public.ai_guest_usage WHERE created_at>=m;
 IF dc+0.01>1 OR mc+0.01>10 THEN RETURN jsonb_build_object('allowed',false,'reason','budget'); END IF;
 IF (s.daily_budget_usd IS NOT NULL OR s.monthly_budget_usd IS NOT NULL) AND EXISTS(SELECT 1 FROM public.ai_usage_log WHERE created_at>=m AND est_cost_usd IS NULL) THEN RETURN jsonb_build_object('allowed',false,'reason','budget'); END IF;
 IF s.daily_budget_usd IS NOT NULL AND dc+0.01+(SELECT coalesce(sum(est_cost_usd),0) FROM public.ai_usage_log WHERE created_at>=d)>s.daily_budget_usd THEN RETURN jsonb_build_object('allowed',false,'reason','budget'); END IF;
 IF s.monthly_budget_usd IS NOT NULL AND mc+0.01+(SELECT coalesce(sum(est_cost_usd),0) FROM public.ai_usage_log WHERE created_at>=m)>s.monthly_budget_usd THEN RETURN jsonb_build_object('allowed',false,'reason','budget'); END IF;
 INSERT INTO public.ai_guest_usage(network_hash) VALUES(_network_hash) RETURNING id INTO ident;
 RETURN jsonb_build_object('allowed',true,'usage_id',ident,'warning',CASE WHEN nd+1>=8 THEN format('You have used %s of 10 guest questions today. Sign in for personal answers.',nd+1) ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.ai_guest_begin(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_guest_begin(text) TO service_role;
CREATE FUNCTION public.ai_guest_finish(_id uuid,_ok boolean,_input integer,_output integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.ai_guest_usage SET status=CASE WHEN _ok THEN 'ok' ELSE 'failed' END,input_tokens=_input,output_tokens=_output,est_cost_usd=CASE WHEN _input>=0 AND _output>=0 THEN (_input*0.25+_output*2)/1000000.0 ELSE NULL END WHERE id=_id AND status='pending';
END $$;
REVOKE ALL ON FUNCTION public.ai_guest_finish(uuid,boolean,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_guest_finish(uuid,boolean,integer,integer) TO service_role;
COMMENT ON FUNCTION public.ai_guest_finish(uuid,boolean,integer,integer) IS 'gpt-5-mini standard text prices verified at https://developers.openai.com/api/docs/models/gpt-5-mini on 2026-11-03: input $0.25/M output $2/M. Cached input charged conservatively as fresh; guest endpoint has no paid tools.';