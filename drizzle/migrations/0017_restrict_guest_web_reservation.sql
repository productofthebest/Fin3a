CREATE OR REPLACE FUNCTION public.ai_web_reserve(_id uuid,_guest boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.ai_settings; d timestamptz:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; m timestamptz:=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; gd numeric; gm numeric; ad numeric; am numeric;
BEGIN
 IF _guest THEN IF coalesce(auth.role(),'') <> 'service_role' THEN RETURN false; END IF;
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