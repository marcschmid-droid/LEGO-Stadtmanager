begin;
-- Existing users are only referenced inside this rolled-back test. No account is changed.
select set_config('test.owner_a',(select id::text from auth.users where deleted_at is null and not coalesce(is_anonymous,false) order by created_at limit 1),true);
select set_config('test.owner_b',(select id::text from auth.users where deleted_at is null and not coalesce(is_anonymous,false) order by created_at offset 1 limit 1),true);
insert into public.showcase_links(owner_id,token,items) values
(current_setting('test.owner_a')::uuid,'00000000-0000-4000-8000-000000000001','[{"setNumber":"10297","name":"Test A","imageUrl":""}]'),
(current_setting('test.owner_b')::uuid,'00000000-0000-4000-8000-000000000002','[{"setNumber":"10297","name":"Test B","imageUrl":""}]');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner_a'),'role','authenticated','is_anonymous',false)::text,true);
set local role authenticated;
do $$declare changed integer;begin
 if (select count(*) from public.showcase_links) <> 1 then raise exception 'Owner isolation failed';end if;
 update public.showcase_links set active=false where owner_id=current_setting('test.owner_b')::uuid;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Cross-owner write allowed';end if;
 begin
  update public.showcase_links set items='[{"setNumber":"10297","name":"Secret","imageUrl":"","email":"private"}]';
  raise exception 'Private fields accepted';
 exception when check_violation then null;end;
 update public.showcase_links set items='[{"setNumber":"10297","name":"Updated","imageUrl":""}]' where owner_id=current_setting('test.owner_a')::uuid;
end $$;
set local role anon;
do $$declare payload jsonb;begin
 begin perform * from public.showcase_links;raise exception 'Anon enumeration allowed';exception when insufficient_privilege then null;end;
 payload:=public.read_showcase('00000000-0000-4000-8000-000000000001');
 if payload->'sets'->0->>'name' <> 'Updated' or payload ? 'owner_id' then raise exception 'Public payload wrong';end if;
 if public.read_showcase('00000000-0000-4000-8000-000000000099') is not null then raise exception 'Unknown token returned data';end if;
end $$;
set local role authenticated;
update public.showcase_links set active=false where owner_id=current_setting('test.owner_a')::uuid;
set local role anon;
do $$begin if public.read_showcase('00000000-0000-4000-8000-000000000001') is not null then raise exception 'Revoked link visible';end if;end $$;
reset role;
select 'Owner isolation, field allowlist, public capability, update and revoke passed' as result;
rollback;
