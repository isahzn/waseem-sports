-- 01_rls_matrix.sql — Phase 02 task 4 acceptance.
-- Proves: anon reads ZERO rows from sensitive tables; every anon write dies
-- with SQLSTATE 42501 (privilege/RLS denial — NOT a constraint accident);
-- the safe projection exposes no quantities; stock/order functions are
-- unexecutable by anon AND authenticated.
-- Run: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/01_rls_matrix.sql
-- (any violation RAISES and aborts). RESET ROLE restores the login role.
do $$
declare
  t text;
  sig text;
  sensitive text[] := array['orders','order_items','order_status_history','payment_transactions',
                             'webhook_events','notifications','audit_logs','inventory',
                             'inventory_movements','admin_users','rate_limits'];
  writable_catalog text[] := array['products','product_variants','categories','brands',
                                   'sports','pages','page_sections','shipping_rules',
                                   'store_settings','attribute_definitions','product_attribute_values',
                                   'orders','notifications','audit_logs'];
  n int;
begin
  -- 1) anon must read ZERO rows from every sensitive table
  foreach t in array sensitive loop
    perform set_config('role', 'anon', true);
    execute format('select count(*) from public.%I', t) into n;
    reset role;
    if n > 0 then
      raise exception 'RLS LEAK: anon read % rows from public.%', n, t;
    end if;
  end loop;

  -- 2) anon writes must die with 42501 (privilege/RLS), never succeed,
  --    and never "pass" via some other error like NOT NULL
  foreach t in array writable_catalog loop
    perform set_config('role', 'anon', true);
    begin
      execute format('insert into public.%I default values', t);
      reset role;
      raise exception 'RLS LEAK: anon INSERT succeeded on public.%', t;
    exception
      when insufficient_privilege then
        reset role; -- expected: denied at privilege/RLS layer
      when others then
        reset role;
        raise exception 'WEAK TEST: anon INSERT on public.% died with % (%) instead of 42501', t, SQLSTATE, SQLERRM;
    end;
  end loop;

  -- 3) the safe projection works for anon but exposes no quantities
  perform set_config('role', 'anon', true);
  perform count(*) from public.variant_availability;
  begin
    perform va.variant_id, va.on_hand from public.variant_availability va limit 1;
    reset role;
    raise exception 'RLS LEAK: variant_availability exposes quantities';
  exception
    when undefined_column then
      reset role; -- expected: no such column in the projection
    when others then
      reset role;
      raise exception 'WEAK TEST: availability probe died with % (%)', SQLSTATE, SQLERRM;
  end;

  -- 4) stock/order/publish functions unexecutable by anon AND authenticated
  foreach t in array array['adjust_order_stock','place_order','admin_adjust_stock','publish_page'] loop
    sig := case t
      when 'adjust_order_stock' then '(uuid, text)'
      when 'place_order' then '(text,text,jsonb,jsonb,jsonb,text,text,text)'
      when 'admin_adjust_stock' then '(uuid, integer, text, text)'
      else '(uuid)' end;
    if has_function_privilege('anon', 'public.' || t || sig, 'EXECUTE') then
      raise exception 'PRIVILEGE LEAK: anon can execute public.%', t;
    end if;
    if has_function_privilege('authenticated', 'public.' || t || sig, 'EXECUTE') then
      raise exception 'PRIVILEGE LEAK: authenticated can execute public.%', t;
    end if;
  end loop;

  raise notice 'RLS MATRIX PASSED';
end $$;
