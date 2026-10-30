-- ============================================================
-- UNHIMAS Fees & Payments (2026-10-30)
-- Safe to re-run. Adds financial management for Cameroon-style
-- university operations (fee structures, invoices, Mobile Money).
-- ============================================================

-- Payment method enum (extendable)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum (
      'mtn_momo',
      'orange_money',
      'bank',
      'cash',
      'other'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum (
      'draft',
      'issued',
      'partially_paid',
      'paid',
      'cancelled',
      'waived'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum (
      'pending',
      'completed',
      'failed',
      'refunded'
    );
  end if;
end$$;

-- 1. Fee categories (Tuition, Registration, Medical, Library, ...)
create table if not exists public.fee_categories (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  description   text,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. Fee structures (amount per category, optionally scoped to department/batch/year)
create table if not exists public.fee_structures (
  id                uuid primary key default gen_random_uuid(),
  fee_category_id   uuid not null references public.fee_categories(id) on delete restrict,
  academic_year_id  uuid references public.academic_years(id) on delete set null,
  department_id     uuid references public.departments(id) on delete set null,
  batch_id          uuid references public.batches(id) on delete set null,
  amount            numeric(12,2) not null check (amount >= 0),
  currency          text not null default 'XAF',
  is_mandatory      boolean not null default true,
  due_days          integer, -- days after invoice issue
  description       text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_fee_structures_category on public.fee_structures(fee_category_id);
create index if not exists idx_fee_structures_year on public.fee_structures(academic_year_id);
create index if not exists idx_fee_structures_batch on public.fee_structures(batch_id);

-- 3. Student invoices
create table if not exists public.student_invoices (
  id                uuid primary key default gen_random_uuid(),
  invoice_number    text not null unique,
  student_id        uuid not null references public.students(id) on delete restrict,
  academic_year_id  uuid references public.academic_years(id) on delete set null,
  semester_id       uuid references public.semesters(id) on delete set null,
  status            public.invoice_status not null default 'draft',
  issue_date        date not null default current_date,
  due_date          date,
  subtotal          numeric(12,2) not null default 0,
  total_amount      numeric(12,2) not null default 0,
  amount_paid       numeric(12,2) not null default 0,
  balance           numeric(12,2) generated always as (total_amount - amount_paid) stored,
  notes             text,
  issued_by         uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_student_invoices_student on public.student_invoices(student_id);
create index if not exists idx_student_invoices_status on public.student_invoices(status);
create index if not exists idx_student_invoices_year on public.student_invoices(academic_year_id);

-- 4. Invoice line items
create table if not exists public.invoice_items (
  id                uuid primary key default gen_random_uuid(),
  invoice_id        uuid not null references public.student_invoices(id) on delete cascade,
  fee_structure_id  uuid references public.fee_structures(id) on delete set null,
  fee_category_id   uuid references public.fee_categories(id) on delete set null,
  description       text not null,
  quantity          numeric(8,2) not null default 1 check (quantity > 0),
  unit_amount       numeric(12,2) not null check (unit_amount >= 0),
  line_total        numeric(12,2) generated always as (quantity * unit_amount) stored,
  created_at        timestamptz not null default now()
);

create index if not exists idx_invoice_items_invoice on public.invoice_items(invoice_id);

-- 5. Payments
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  payment_reference   text not null unique,
  invoice_id          uuid not null references public.student_invoices(id) on delete restrict,
  student_id          uuid not null references public.students(id) on delete restrict,
  amount              numeric(12,2) not null check (amount > 0),
  currency            text not null default 'XAF',
  method              public.payment_method not null default 'other',
  status              public.payment_status not null default 'pending',
  provider_reference  text, -- MoMo / Orange transaction id
  phone_number        text, -- for Mobile Money
  paid_at             timestamptz,
  recorded_by         uuid references public.profiles(id) on delete set null,
  notes               text,
  receipt_number      text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_student on public.payments(student_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_method on public.payments(method);

-- Updated_at trigger helper (reuse pattern)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fee_categories_updated on public.fee_categories;
create trigger trg_fee_categories_updated
  before update on public.fee_categories
  for each row execute function public.set_updated_at();

drop trigger if exists trg_fee_structures_updated on public.fee_structures;
create trigger trg_fee_structures_updated
  before update on public.fee_structures
  for each row execute function public.set_updated_at();

drop trigger if exists trg_student_invoices_updated on public.student_invoices;
create trigger trg_student_invoices_updated
  before update on public.student_invoices
  for each row execute function public.set_updated_at();

drop trigger if exists trg_payments_updated on public.payments;
create trigger trg_payments_updated
  before update on public.payments
  for each row execute function public.set_updated_at();

-- Sequence helpers for human-readable numbers
create sequence if not exists public.invoice_number_seq start 1000;
create sequence if not exists public.payment_ref_seq start 10000;
create sequence if not exists public.receipt_number_seq start 5000;

create or replace function public.generate_invoice_number()
returns text
language plpgsql
as $$
begin
  return 'INV-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
end;
$$;

create or replace function public.generate_payment_reference()
returns text
language plpgsql
as $$
begin
  return 'PAY-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(nextval('public.payment_ref_seq')::text, 6, '0');
end;
$$;

create or replace function public.generate_receipt_number()
returns text
language plpgsql
as $$
begin
  return 'RCP-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0');
end;
$$;

-- Keep invoice totals in sync when items change
create or replace function public.recalc_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(12,2);
begin
  select coalesce(sum(line_total), 0) into v_subtotal
  from public.invoice_items
  where invoice_id = p_invoice_id;

  update public.student_invoices
     set subtotal = v_subtotal,
         total_amount = v_subtotal,
         updated_at = now()
   where id = p_invoice_id;
end;
$$;

create or replace function public.trg_invoice_items_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_invoice_totals(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_invoice_items_recalc on public.invoice_items;
create trigger trg_invoice_items_recalc
  after insert or update or delete on public.invoice_items
  for each row execute function public.trg_invoice_items_recalc();

-- When a payment is completed, update invoice amount_paid + status
create or replace function public.apply_payment_to_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(12,2);
  v_paid  numeric(12,2);
begin
  if new.status = 'completed' and (old is null or old.status is distinct from 'completed') then
    if new.receipt_number is null then
      new.receipt_number := public.generate_receipt_number();
    end if;
    if new.paid_at is null then
      new.paid_at := now();
    end if;

    select total_amount into v_total
    from public.student_invoices
    where id = new.invoice_id
    for update;

    select coalesce(sum(amount), 0) into v_paid
    from public.payments
    where invoice_id = new.invoice_id
      and status = 'completed'
      and id <> new.id;

    v_paid := v_paid + new.amount;

    update public.student_invoices
       set amount_paid = v_paid,
           status = case
             when v_paid >= v_total then 'paid'::public.invoice_status
             when v_paid > 0 then 'partially_paid'::public.invoice_status
             else status
           end,
           updated_at = now()
     where id = new.invoice_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_payment on public.payments;
create trigger trg_apply_payment
  before insert or update of status, amount on public.payments
  for each row execute function public.apply_payment_to_invoice();

-- Student balance view
create or replace view public.student_fee_balances
with (security_invoker = true)
as
select
  s.id as student_id,
  s.profile_id,
  s.matricule,
  s.first_name,
  s.last_name,
  s.batch_id,
  coalesce(sum(si.total_amount) filter (where si.status not in ('cancelled', 'waived', 'draft')), 0) as total_invoiced,
  coalesce(sum(si.amount_paid) filter (where si.status not in ('cancelled', 'waived', 'draft')), 0) as total_paid,
  coalesce(sum(si.balance) filter (where si.status not in ('cancelled', 'waived', 'draft')), 0) as outstanding_balance
from public.students s
left join public.student_invoices si on si.student_id = s.id
group by s.id, s.profile_id, s.matricule, s.first_name, s.last_name, s.batch_id;

grant select on public.student_fee_balances to authenticated;

-- RLS
alter table public.fee_categories enable row level security;
alter table public.fee_structures enable row level security;
alter table public.student_invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

-- Fee categories / structures: admins manage, everyone authenticated can read active
drop policy if exists fee_categories_select on public.fee_categories;
create policy fee_categories_select on public.fee_categories
  for select to authenticated using (true);

drop policy if exists fee_categories_admin on public.fee_categories;
create policy fee_categories_admin on public.fee_categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists fee_structures_select on public.fee_structures;
create policy fee_structures_select on public.fee_structures
  for select to authenticated using (true);

drop policy if exists fee_structures_admin on public.fee_structures;
create policy fee_structures_admin on public.fee_structures
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Invoices: admin full; student sees own
drop policy if exists student_invoices_select on public.student_invoices;
create policy student_invoices_select on public.student_invoices
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = auth.uid()
    )
  );

drop policy if exists student_invoices_admin on public.student_invoices;
create policy student_invoices_admin on public.student_invoices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists invoice_items_select on public.invoice_items;
create policy invoice_items_select on public.invoice_items
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.student_invoices si
      join public.students s on s.id = si.student_id
      where si.id = invoice_id and s.profile_id = auth.uid()
    )
  );

drop policy if exists invoice_items_admin on public.invoice_items;
create policy invoice_items_admin on public.invoice_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Payments: admin full; student sees own + can insert pending for own invoices
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = auth.uid()
    )
  );

drop policy if exists payments_admin on public.payments;
create policy payments_admin on public.payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists payments_student_insert on public.payments;
create policy payments_student_insert on public.payments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = auth.uid()
    )
    and status = 'pending'
  );

-- Seed a few default categories (idempotent)
insert into public.fee_categories (code, name, description, sort_order)
values
  ('TUITION', 'Tuition Fees', 'Core academic tuition', 10),
  ('REGISTRATION', 'Registration Fees', 'Annual / semester registration', 20),
  ('MEDICAL', 'Medical Fees', 'Medical visit / insurance', 30),
  ('LIBRARY', 'Library Fees', 'Library access and services', 40),
  ('OTHER', 'Other Fees', 'Miscellaneous charges', 90)
on conflict (code) do nothing;

grant select, insert, update, delete on public.fee_categories to authenticated;
grant select, insert, update, delete on public.fee_structures to authenticated;
grant select, insert, update, delete on public.student_invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;
grant select, insert, update, delete on public.payments to authenticated;

grant usage, select on sequence public.invoice_number_seq to authenticated;
grant usage, select on sequence public.payment_ref_seq to authenticated;
grant usage, select on sequence public.receipt_number_seq to authenticated;

grant execute on function public.generate_invoice_number() to authenticated;
grant execute on function public.generate_payment_reference() to authenticated;
grant execute on function public.generate_receipt_number() to authenticated;
grant execute on function public.recalc_invoice_totals(uuid) to authenticated;
