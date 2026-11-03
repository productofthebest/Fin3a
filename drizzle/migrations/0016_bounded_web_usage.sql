ALTER TABLE public.ai_guest_usage ADD COLUMN web_reserved_usd numeric(14,8) NOT NULL DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN web_reserved_usd numeric(14,8) NOT NULL DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN web_cost_usd numeric(14,8);
CREATE OR REPLACE FUNCTION public.ai_guest_begin(_network_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.ai_settings; d timestamptz := date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; m timestamptz := date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; nd integer; gd integer; gm integer; dc numeric; mc numeric; ident uuid;
BEGIN
 IF _network_hash IS NULL OR _network_hash !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('allowed',false,'reason','invalid'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('guest-ai-global',0));
 SELECT * INTO s FROM public.ai_settings WHERE id;
 IF NOT coalesce(s.ai_enabled,false) THEN RETURN jsonb_build_object('allowed',false,'reason','disabled'); END IF;
 SELECT count(*) INTO nd FROM public.ai_guest_usage WHERE network_hash=_network_hash AND created_at>=d;
 SELECT count(*) INTO gd FROM public.ai_guest_usage WHERE created_at>=d;
 SELECT count(*) INTO gm FROM public.ai_guest_usage WHERE created_at>=m;
 IF nd>=10 OR gd>=100 OR gm>=1000 THEN RETURN jsonb_build_object('allowed',false,'reason','limit'); END IF;
 SELECT coalesce(sum(coalesce(est_cost_usd,reserved_usd)+web_reserved_usd),0) INTO dc FROM public.ai_guest_usage WHERE created_at>=d;
 SELECT coalesce(sum(coalesce(est_cost_usd,reserved_usd)+web_reserved_usd),0) INTO mc FROM public.ai_guest_usage WHERE created_at>=m;
 IF dc+0.01>1 OR mc+0.01>10 THEN RETURN jsonb_build_object('allowed',false,'reason','budget'); END IF;
 IF (s.daily_budget_usd IS NOT NULL OR s.monthly_budget_usd IS NOT NULL) AND EXISTS(SELECT 1 FROM public.ai_usage_log WHERE created_at>=m AND est_cost_usd IS NULL AND web_reserved_usd=0) THEN RETURN jsonb_build_object('allowed',false,'reason','budget'); END IF;
 IF s.daily_budget_usd IS NOT NULL AND dc+0.01+(SELECT coalesce(sum(coalesce(est_cost_usd,0)+web_reserved_usd),0) FROM public.ai_usage_log WHERE created_at>=d)>s.daily_budget_usd THEN RETURN jsonb_build_object('allowed',false,'reason','budget'); END IF;
 IF s.monthly_budget_usd IS NOT NULL AND mc+0.01+(SELECT coalesce(sum(coalesce(est_cost_usd,0)+web_reserved_usd),0) FROM public.ai_usage_log WHERE created_at>=m)>s.monthly_budget_usd THEN RETURN jsonb_build_object('allowed',false,'reason','budget'); END IF;
 INSERT INTO public.ai_guest_usage(network_hash) VALUES(_network_hash) RETURNING id INTO ident;
 RETURN jsonb_build_object('allowed',true,'usage_id',ident,'warning',CASE WHEN nd+1>=8 THEN format('You have used %s of 10 guest questions today. Sign in for personal answers.',nd+1) ELSE NULL END);
END $$;
CREATE FUNCTION public.ai_web_reserve(_id uuid,_guest boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.ai_settings; d timestamptz:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; m timestamptz:=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; gd numeric; gm numeric; ad numeric; am numeric;
BEGIN
 IF _guest THEN IF current_user <> 'postgres' AND coalesce(auth.role(),'') <> 'service_role' THEN RETURN false; END IF;
 ELSE IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.ai_usage_log WHERE id=_id AND user_id=auth.uid() AND status='pending') THEN RETURN false; END IF; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('guest-ai-global',0));
 SELECT * INTO s FROM public.ai_settings WHERE id;
 IF NOT coalesce(s.ai_enabled,false) THEN RETURN false; END IF;
 SELECT coalesce(sum(coalesce(est_cost_usd,reserved_usd)+web_reserved_usd),0) INTO gd FROM public.ai_guest_usage WHERE created_at>=d;
 SELECT coalesce(sum(coalesce(est_cost_usd,reserved_usd)+web_reserved_usd),0) INTO gm FROM public.ai_guest_usage WHERE created_at>=m;
 IF _guest AND (gd+0.22>1 OR gm+0.22>10) THEN RETURN false; END IF;
 IF (s.daily_budget_usd IS NOT NULL OR s.monthly_budget_usd IS NOT NULL) AND EXISTS(SELECT 1 FROM public.ai_usage_log WHERE created_at>=m AND id<>_id AND est_cost_usd IS NULL AND web_reserved_usd=0) THEN RETURN false; END IF;
 SELECT coalesce(sum(coalesce(est_cost_usd,0)+web_reserved_usd),0) INTO ad FROM public.ai_usage_log WHERE created_at>=d;
 SELECT coalesce(sum(coalesce(est_cost_usd,0)+web_reserved_usd),0) INTO am FROM public.ai_usage_log WHERE created_at>=m;
 IF (s.daily_budget_usd IS NOT NULL AND gd+ad+0.22>s.daily_budget_usd) OR (s.monthly_budget_usd IS NOT NULL AND gm+am+0.22>s.monthly_budget_usd) THEN RETURN false; END IF;
 IF _guest THEN UPDATE public.ai_guest_usage SET web_reserved_usd=0.22 WHERE id=_id AND status='pending' AND web_reserved_usd=0;
 ELSE UPDATE public.ai_usage_log SET web_reserved_usd=0.22 WHERE id=_id AND user_id=auth.uid() AND status='pending' AND web_reserved_usd=0; END IF;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.ai_web_reserve(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ai_web_reserve(uuid,boolean) TO authenticated,service_role;
CREATE FUNCTION public.ai_web_finish(_id uuid,_guest boolean,_ok boolean,_input integer,_output integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cost numeric;
BEGIN
 cost:=CASE WHEN _ok AND _input>=0 AND _output>=0 THEN (_input*0.25+_output*2)/1000000.0+0.01 ELSE NULL END;
 IF _guest THEN
 IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
 UPDATE public.ai_guest_usage SET status=CASE WHEN _ok THEN 'ok' ELSE 'failed' END,input_tokens=NULLIF(_input,-1),output_tokens=NULLIF(_output,-1),est_cost_usd=cost,web_reserved_usd=CASE WHEN cost IS NULL THEN web_reserved_usd ELSE 0 END WHERE id=_id AND status='pending' AND web_reserved_usd>0;
 ELSE
 UPDATE public.ai_usage_log SET status=CASE WHEN _ok THEN 'ok' ELSE 'failed' END,model='gpt-5-mini',input_tokens=NULLIF(_input,-1),output_tokens=NULLIF(_output,-1),est_cost_usd=cost,web_cost_usd=CASE WHEN cost IS NOT NULL THEN 0.01 ELSE NULL END,web_reserved_usd=CASE WHEN cost IS NULL THEN web_reserved_usd ELSE 0 END,finished_at=now() WHERE id=_id AND user_id=auth.uid() AND status='pending' AND web_reserved_usd>0;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.ai_web_finish(uuid,boolean,boolean,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ai_web_finish(uuid,boolean,boolean,integer,integer) TO authenticated,service_role;
COMMENT ON FUNCTION public.ai_web_finish(uuid,boolean,boolean,integer,integer) IS 'Conservative maximum one web-search call charged at $0.01 even when unused. gpt-5-mini input $0.25/M output $2/M verified https://developers.openai.com/api/docs/pricing and /models/gpt-5-mini on 2026-11-03. Unknown outcomes retain $0.22 reservation; two 400K input contexts plus two 1200-token outputs reserved.';