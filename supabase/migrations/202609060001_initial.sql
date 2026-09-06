-- Apply with Supabase CLI or SQL editor. Only the server service role writes data.
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, plan text not null default 'free', created_at timestamptz not null default now());
create table public.projects (id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, name text not null, language text not null check (language in ('en','ar','ar-EG','ar-SA')), snapshot jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), lease_id uuid, lease_until timestamptz);
create index projects_owner on public.projects(user_id,updated_at desc);
create table public.sources (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, name text not null, unique(project_id,name));
create table public.reviews (id uuid primary key, project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, source_id uuid references public.sources(id), original_text text not null, normalized_text text not null, masked_text text not null, language text not null, rating numeric check(rating between 1 and 5), review_date text, title text, near_duplicate_of uuid, unique(project_id,id));
create index reviews_project on public.reviews(project_id);
create table public.analysis_runs (id uuid primary key, project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, status text not null, model text not null, score_version text not null, progress jsonb not null, updated_at timestamptz not null default now());
create table public.themes (id uuid primary key, project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null);
create table public.insights (id uuid primary key, project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null);
create table public.angles (id uuid primary key, project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, unique(project_id,id));
create table public.angle_evidence (angle_id uuid not null, review_id uuid not null, project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, primary key(angle_id,review_id), foreign key(project_id,angle_id) references public.angles(project_id,id) on delete cascade, foreign key(project_id,review_id) references public.reviews(project_id,id) on delete cascade);
create table public.followups (id uuid primary key, angle_id uuid not null references public.angles(id) on delete cascade, project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null);
create table public.usage_events (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, event_key text not null, kind text not null, units integer not null check(units > 0), created_at timestamptz not null default now(), unique(user_id,event_key,kind));
create index usage_owner_period on public.usage_events(user_id,kind,created_at);

do $$ declare t text; begin
  foreach t in array array['profiles','projects','sources','reviews','analysis_runs','themes','insights','angles','angle_evidence','followups','usage_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    if t='profiles' then execute format('create policy owner_read on public.%I for select to authenticated using (id = auth.uid())',t);
    else execute format('create policy owner_read on public.%I for select to authenticated using (user_id = auth.uid())',t); end if;
  end loop;
end $$;

create function public.save_project_snapshot(owner_id uuid,payload jsonb) returns void language plpgsql security definer set search_path=public as $$
declare pid uuid := (payload->>'id')::uuid; item jsonb; source_key uuid; rid text;
begin
  if exists(select 1 from projects where id=pid and user_id<>owner_id) then raise exception 'Owner mismatch'; end if;
  insert into profiles(id) values(owner_id) on conflict do nothing;
  insert into projects(id,user_id,name,language,snapshot,created_at,updated_at) values(pid,owner_id,payload->>'name',payload->>'language',payload,(payload->>'createdAt')::timestamptz,(payload->>'updatedAt')::timestamptz)
  on conflict(id) do update set name=excluded.name,language=excluded.language,snapshot=excluded.snapshot,updated_at=excluded.updated_at;
  for item in select * from jsonb_array_elements(payload->'reviews') loop
    insert into sources(project_id,user_id,name) values(pid,owner_id,coalesce(item->>'source','Paste')) on conflict(project_id,name) do nothing;
    select id into source_key from sources where project_id=pid and name=coalesce(item->>'source','Paste');
    insert into reviews(id,project_id,user_id,source_id,original_text,normalized_text,masked_text,language,rating,review_date,title,near_duplicate_of)
    values((item->>'id')::uuid,pid,owner_id,source_key,item->>'text',item->>'normalized',item->>'masked',item->>'language',(item->>'rating')::numeric,item->>'date',item->>'title',(item->>'nearDuplicateOf')::uuid) on conflict(id) do nothing;
  end loop;
  insert into analysis_runs(id,project_id,user_id,status,model,score_version,progress) values((payload->'run'->>'id')::uuid,pid,owner_id,payload->'run'->>'stage',payload->'run'->>'model',payload->'run'->>'scoreVersion',payload->'run')
  on conflict(id) do update set status=excluded.status,progress=excluded.progress,updated_at=now();
  delete from themes where project_id=pid; delete from insights where project_id=pid; delete from angles where project_id=pid;
  for item in select * from jsonb_array_elements(payload->'themes') loop insert into themes values((item->>'id')::uuid,pid,owner_id,item); end loop;
  for item in select * from jsonb_array_elements(payload->'insights') loop insert into insights values((item->>'id')::uuid,pid,owner_id,item); end loop;
  for item in select * from jsonb_array_elements(payload->'angles') loop
    insert into angles values((item->>'id')::uuid,pid,owner_id,item);
    for rid in select jsonb_array_elements_text(item->'reviewIds') loop insert into angle_evidence values((item->>'id')::uuid,rid::uuid,pid,owner_id); end loop;
  end loop;
  for item in select * from jsonb_array_elements(payload->'followups') loop insert into followups values((item->>'id')::uuid,(item->>'angleId')::uuid,pid,owner_id,item); end loop;
end $$;
create function public.claim_project(owner_id uuid,project_key uuid,lease_key uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
  update projects set lease_id=lease_key,lease_until=now()+interval '10 minutes' where id=project_key and user_id=owner_id and (lease_until is null or lease_until<now());
  return found;
end $$;
create function public.release_project(owner_id uuid,project_key uuid,lease_key uuid) returns void language sql security definer set search_path=public as $$ update projects set lease_id=null,lease_until=null where id=project_key and user_id=owner_id and lease_id=lease_key $$;
create function public.reserve_usage(owner_id uuid,event_key text,event_kind text,units integer,allowance integer) returns boolean language plpgsql security definer set search_path=public as $$
declare used bigint;
begin
  if units<=0 or allowance<=0 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  if exists(select 1 from usage_events e where e.user_id=owner_id and e.event_key=reserve_usage.event_key and e.kind=event_kind) then return true; end if;
  select coalesce(sum(e.units),0) into used from usage_events e where e.user_id=owner_id and e.kind=event_kind and e.created_at>=date_trunc('month',now());
  if used+units>allowance then return false; end if;
  insert into usage_events(user_id,event_key,kind,units) values(owner_id,event_key,event_kind,units); return true;
end $$;
revoke all on function public.save_project_snapshot(uuid,jsonb),public.claim_project(uuid,uuid,uuid),public.release_project(uuid,uuid,uuid),public.reserve_usage(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.save_project_snapshot(uuid,jsonb),public.claim_project(uuid,uuid,uuid),public.release_project(uuid,uuid,uuid),public.reserve_usage(uuid,text,text,integer,integer) to service_role;

create function public.reserve_request(owner_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare used bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  select count(*) into used from usage_events where user_id=owner_id and kind='request' and created_at>now()-interval '1 minute';
  if used>=120 then return false; end if;
  insert into usage_events(user_id,event_key,kind,units) values(owner_id,gen_random_uuid()::text,'request',1);
  return true;
end $$;
revoke all on function public.reserve_request(uuid) from public,anon,authenticated;
grant execute on function public.reserve_request(uuid) to service_role;
