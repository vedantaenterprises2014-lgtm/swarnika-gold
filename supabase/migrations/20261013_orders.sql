-- Swarnika Gold: private customer orders and owner-managed discount codes.
create extension if not exists pgcrypto;
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  delivery_address jsonb not null,
  items jsonb not null,
  subtotal_paise integer not null check (subtotal_paise >= 0),
  discount_paise integer not null default 0 check (discount_paise >= 0),
  total_paise integer not null check (total_paise >= 0),
  coupon_code text,
  payment_method text not null check (payment_method in ('razorpay','cod')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  order_status text not null default 'new' check (order_status in ('new','confirmed','packed','shipped','delivered','cancelled')),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select, update on public.orders to authenticated;
drop policy if exists "owner can view orders" on public.orders;
create policy "owner can view orders" on public.orders for select to authenticated using (lower(coalesce(auth.jwt()->>'email','')) = 'vedantaenterprises2014@gmail.com');
drop policy if exists "owner can update orders" on public.orders;
create policy "owner can update orders" on public.orders for update to authenticated using (lower(coalesce(auth.jwt()->>'email','')) = 'vedantaenterprises2014@gmail.com') with check (lower(coalesce(auth.jwt()->>'email','')) = 'vedantaenterprises2014@gmail.com');
create table if not exists public.discount_coupons (
  code text primary key check (code = upper(code)),
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value integer not null check (discount_value > 0),
  minimum_order_paise integer not null default 0 check (minimum_order_paise >= 0),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.discount_coupons enable row level security;
revoke all on public.discount_coupons from anon, authenticated;
grant select, insert, update, delete on public.discount_coupons to authenticated;
drop policy if exists "owner manages coupons" on public.discount_coupons;
create policy "owner manages coupons" on public.discount_coupons for all to authenticated using (lower(coalesce(auth.jwt()->>'email','')) = 'vedantaenterprises2014@gmail.com') with check (lower(coalesce(auth.jwt()->>'email','')) = 'vedantaenterprises2014@gmail.com');
