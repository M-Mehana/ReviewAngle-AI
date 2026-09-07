-- Run against the existing staging project with the Supabase SQL connector.
-- No schema changes. All test users/data and role changes roll back inside
-- the exception subtransaction. Any unexpected failure aborts the statement.
do $audit$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  project_id uuid := gen_random_uuid();
  review_id uuid := gen_random_uuid();
  angle_id uuid := gen_random_uuid();
  run_id uuid := gen_random_uuid();
  lease_id uuid := gen_random_uuid();
  payload jsonb;
  relation text;
  row_count integer;
  tables text[] := array['projects','sources','reviews','analysis_runs','themes','insights','angles','angle_evidence','followups','usage_events'];
begin
  begin
    insert into auth.users(id) values(owner_id),(other_id);
    payload := jsonb_build_object(
      'id',project_id,'name','NON-CUSTOMER rollback validation','language','en',
      'createdAt',now(),'updatedAt',now(),
      'reviews',jsonb_build_array(jsonb_build_object('id',review_id,'text','Synthetic database test.','normalized','Synthetic database test.','masked','Synthetic database test.','language','en','source','Rollback fixture')),
      'run',jsonb_build_object('id',run_id,'stage','complete','model','database-test-only','scoreVersion','v1'),
      'themes',jsonb_build_array(jsonb_build_object('id',gen_random_uuid())),
      'insights',jsonb_build_array(jsonb_build_object('id',gen_random_uuid())),
      'angles',jsonb_build_array(jsonb_build_object('id',angle_id,'reviewIds',jsonb_build_array(review_id))),
      'followups',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'angleId',angle_id,'content','Synthetic database test.'))
    );
    set local role service_role;
    perform public.save_project_snapshot(owner_id,payload);
    perform public.save_project_snapshot(owner_id,payload);
    if not exists(select 1 from public.profiles where id=owner_id) then raise exception 'Profile was not created'; end if;
    foreach relation in array tables[1:9] loop
      execute format('select count(*) from public.%I where user_id=$1',relation) into row_count using owner_id;
      if row_count<>1 then raise exception 'Relational persistence failed: %',relation; end if;
    end loop;
    if not public.reserve_usage(owner_id,'audit-one','reviews',7,10) then raise exception 'Quota reservation failed'; end if;
    if not public.reserve_usage(owner_id,'audit-one','reviews',7,10) then raise exception 'Quota idempotency failed'; end if;
    if public.reserve_usage(owner_id,'audit-two','reviews',4,10) then raise exception 'Quota exceeded allowance'; end if;
    if not public.reserve_usage(owner_id,'audit-three','reviews',3,10) then raise exception 'Quota boundary failed'; end if;
    for row_count in 1..120 loop
      if not public.reserve_request(owner_id) then raise exception 'Request allowance failed early'; end if;
    end loop;
    if public.reserve_request(owner_id) then raise exception 'Request limit was not enforced'; end if;
    if public.claim_project(other_id,project_id,lease_id) then raise exception 'Other user claimed project'; end if;
    if not public.claim_project(owner_id,project_id,lease_id) then raise exception 'Lease claim failed'; end if;
    perform public.release_project(owner_id,project_id,gen_random_uuid());
    if public.claim_project(owner_id,project_id,gen_random_uuid()) then raise exception 'Wrong lease released lock'; end if;
    perform public.release_project(owner_id,project_id,lease_id);
    if not public.claim_project(owner_id,project_id,lease_id) then raise exception 'Lease release failed'; end if;

    set local role authenticated;
    perform set_config('request.jwt.claim.sub',owner_id::text,true);
    foreach relation in array tables loop
      execute format('select count(*) from public.%I where user_id=$1',relation) into row_count using owner_id;
      if row_count=0 then raise exception 'Owner cannot read %',relation; end if;
    end loop;
    if not exists(select 1 from public.profiles where id=owner_id) then raise exception 'Owner profile is not readable'; end if;
    begin
      perform public.save_project_snapshot(owner_id,payload);
      raise exception 'Authenticated user could call write RPC';
    exception when insufficient_privilege then null; end;
    begin
      update public.projects set name='Forbidden' where id=project_id;
      raise exception 'Authenticated user could write directly';
    exception when insufficient_privilege then null; end;

    perform set_config('request.jwt.claim.sub',other_id::text,true);
    foreach relation in array tables loop
      execute format('select count(*) from public.%I where user_id=$1',relation) into row_count using owner_id;
      if row_count<>0 then raise exception 'Cross-user RLS leak: %',relation; end if;
    end loop;
    if exists(select 1 from public.profiles where id=owner_id) then raise exception 'Cross-user profile leak'; end if;
    set local role anon;
    begin
      perform 1 from public.projects;
      raise exception 'Anonymous user could read projects';
    exception when insufficient_privilege then null; end;
    raise exception using errcode='PZ001',message='Successful validation rollback';
  exception when sqlstate 'PZ001' then
    null;
  end;
  if exists(select 1 from auth.users where id in(owner_id,other_id)) then raise exception 'Validation data was not rolled back'; end if;
end $audit$;
