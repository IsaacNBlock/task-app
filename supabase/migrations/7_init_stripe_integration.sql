-- Enable Stripe integration
-- IMPORTANT: The wrappers extension must be enabled in Supabase dashboard first
-- Go to Database > Extensions and enable 'wrappers' before running this migration
-- If wrappers is not available, this migration will be skipped

do $$
begin
  -- Try to enable wrappers extension
  create extension if not exists wrappers with schema extensions;
  
  -- Only proceed if wrappers extension exists
  if exists (select 1 from pg_extension where extname = 'wrappers') then
    -- Create foreign data wrapper (only if it doesn't exist)
    if not exists (select 1 from pg_foreign_data_wrapper where fdwname = 'stripe_wrapper') then
      create foreign data wrapper stripe_wrapper
        handler stripe_fdw_handler
        validator stripe_fdw_validator;
    end if;

    -- Create server (only if it doesn't exist)
    if not exists (select 1 from pg_foreign_server where srvname = 'stripe_server') then
      create server stripe_server
      foreign data wrapper stripe_wrapper
      options (
        api_key_name 'stripe'
      );
    end if;

    -- Create schema
    create schema if not exists stripe;

    -- Create Stripe customers foreign table (only if it doesn't exist)
    if not exists (select 1 from information_schema.tables where table_schema = 'stripe' and table_name = 'customers') then
      create foreign table stripe.customers (
        id text,
        email text,
        name text,
        description text,
        created timestamp,
        attrs jsonb
      )
      server stripe_server
      options (
        object 'customers',
        rowid_column 'id'
      );
    end if;
    
    raise notice 'Stripe FDW setup completed successfully';
  else
    raise notice 'WARNING: wrappers extension not found. Stripe FDW setup skipped.';
    raise notice 'Please enable wrappers extension in Supabase dashboard (Database > Extensions) and rerun this migration.';
  end if;
exception when others then
  raise notice 'WARNING: Could not set up Stripe FDW. Error: %. The app will work without Stripe integration.', SQLERRM;
end $$;

-- Function to handle Stripe customer creation (will only work if FDW is set up)
create or replace function public.handle_stripe_customer_creation()
returns trigger
security definer
set search_path = public
as $$
declare
  customer_email text;
begin
  -- Only proceed if Stripe FDW is available
  if exists (select 1 from pg_foreign_data_wrapper where fdwname = 'stripe_wrapper') then
    -- Get user email
    select email into customer_email
    from auth.users
    where id = new.user_id;

    -- Create Stripe customer
    begin
      insert into stripe.customers (email, name)
      values (customer_email, new.name);
      
      -- Get the created customer ID from Stripe
      select id into new.stripe_customer_id
      from stripe.customers
      where email = customer_email
      order by created desc
      limit 1;
    exception when others then
      raise notice 'Failed to create Stripe customer: %', SQLERRM;
    end;
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Trigger to create Stripe customer on profile creation
drop trigger if exists create_stripe_customer_on_profile_creation on public.profiles;
create trigger create_stripe_customer_on_profile_creation
  before insert on public.profiles
  for each row
  execute function public.handle_stripe_customer_creation();

-- Function to handle Stripe customer deletion
create or replace function public.handle_stripe_customer_deletion()
returns trigger
security definer
set search_path = public
as $$
begin
  if old.stripe_customer_id is not null and exists (select 1 from pg_foreign_data_wrapper where fdwname = 'stripe_wrapper') then
    begin
      delete from stripe.customers where id = old.stripe_customer_id;
    exception when others then
      raise notice 'Failed to delete Stripe customer: %', SQLERRM;
    end;
  end if;
  return old;
end;
$$ language plpgsql;

-- Trigger to delete Stripe customer on profile deletion
drop trigger if exists delete_stripe_customer_on_profile_deletion on public.profiles;
create trigger delete_stripe_customer_on_profile_deletion
  before delete on public.profiles
  for each row
  execute function public.handle_stripe_customer_deletion();

-- Security policy: Users can read their own Stripe data
create policy "Users can read own Stripe data"
  on public.profiles
  for select
  using (auth.uid() = user_id);