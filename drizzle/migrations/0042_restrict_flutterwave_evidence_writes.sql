REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.flw_webhook_events FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.flw_topup_refunds FROM anon,authenticated;
REVOKE SELECT ON public.flw_webhook_events,public.flw_topup_refunds FROM anon;
GRANT SELECT ON public.flw_webhook_events,public.flw_topup_refunds TO authenticated;
GRANT ALL ON public.flw_webhook_events,public.flw_topup_refunds TO service_role;