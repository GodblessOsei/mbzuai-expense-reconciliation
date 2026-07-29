-- Seed data for LOCAL DEVELOPMENT.
--
-- Safe to run repeatedly: every statement is guarded, so re-seeding an already
-- seeded database changes nothing.
--
--   psql -d postgres -f src/db/seed.sql
--
-- ---------------------------------------------------------------------------
-- DEVELOPMENT CREDENTIALS -- every seeded account uses the same password:
--
--     Password123!
--
-- These accounts exist so a new developer can clone, seed, and sign in without
-- any setup. They are NOT for anything reachable from the internet. For a real
-- deployment, seed nothing and create the first manager with:
--
--     node src/db/manageAdmin.js create --email=... --name="..."
--
-- The email addresses below are local-development placeholders.
-- ---------------------------------------------------------------------------

-- ---- People ---------------------------------------------------------------
-- must_change_password is FALSE here purely so seeded logins go straight into
-- the app. Accounts created through the manager UI always start TRUE.

INSERT INTO users (full_name, email, password_hash, role, must_change_password)
SELECT 'Neil Hammond', 'neil.hammond@example.dev',
       '$2b$10$kzqB/ZWhhj/Xirt9gjJA9OgHuC3FgjKow6wQrPTR6xapgNkXkoZ2i', 'manager', FALSE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'neil.hammond@example.dev');

INSERT INTO users (full_name, email, password_hash, role, must_change_password)
SELECT 'Jose', 'jose@example.dev',
       '$2b$10$kzqB/ZWhhj/Xirt9gjJA9OgHuC3FgjKow6wQrPTR6xapgNkXkoZ2i', 'rla', FALSE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'jose@example.dev');

INSERT INTO users (full_name, email, password_hash, role, must_change_password)
SELECT 'Xiwei', 'xiwei@example.dev',
       '$2b$10$kzqB/ZWhhj/Xirt9gjJA9OgHuC3FgjKow6wQrPTR6xapgNkXkoZ2i', 'rla', FALSE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'xiwei@example.dev');

INSERT INTO users (full_name, email, password_hash, role, must_change_password)
SELECT 'Hawau', 'hawau@example.dev',
       '$2b$10$kzqB/ZWhhj/Xirt9gjJA9OgHuC3FgjKow6wQrPTR6xapgNkXkoZ2i', 'rla', FALSE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'hawau@example.dev');

INSERT INTO users (full_name, email, password_hash, role, must_change_password)
SELECT 'Seung', 'seung@example.dev',
       '$2b$10$kzqB/ZWhhj/Xirt9gjJA9OgHuC3FgjKow6wQrPTR6xapgNkXkoZ2i', 'rla', FALSE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'seung@example.dev');

-- ---- Cards ----------------------------------------------------------------
-- The four seeded prepaid cards, AED 5,000 limit each. Identified by their last
-- four digits, which is the only card detail this system ever stores.

INSERT INTO cardholders (cardholder_name, last_four_digits)
SELECT 'Jose', '8593'
WHERE NOT EXISTS (SELECT 1 FROM cardholders WHERE last_four_digits = '8593');

INSERT INTO cardholders (cardholder_name, last_four_digits)
SELECT 'Xiwei', '6954'
WHERE NOT EXISTS (SELECT 1 FROM cardholders WHERE last_four_digits = '6954');

INSERT INTO cardholders (cardholder_name, last_four_digits)
SELECT 'Hawau', '4924'
WHERE NOT EXISTS (SELECT 1 FROM cardholders WHERE last_four_digits = '4924');

INSERT INTO cardholders (cardholder_name, last_four_digits)
SELECT 'Seung', '9570'
WHERE NOT EXISTS (SELECT 1 FROM cardholders WHERE last_four_digits = '9570');

-- ---- Assignment -----------------------------------------------------------
-- Link each card to its current holder. Written as a separate UPDATE rather
-- than folded into the INSERTs above so it also repairs databases that were
-- seeded before logins existed.
--
-- assigned_at is backdated so seeded cards can see demo transactions already
-- sitting in a developer's database. Card-based visibility starts at this date.

UPDATE cardholders c
   SET assigned_user_id = u.user_id,
       assigned_at      = COALESCE(c.assigned_at, DATE '2025-01-01')
  FROM users u
 WHERE c.assigned_user_id IS NULL
   AND u.email = CASE c.last_four_digits
                   WHEN '8593' THEN 'jose@example.dev'
                   WHEN '6954' THEN 'xiwei@example.dev'
                   WHEN '4924' THEN 'hawau@example.dev'
                   WHEN '9570' THEN 'seung@example.dev'
                 END;

-- ---- Budget items ---------------------------------------------------------
-- Guarded per row so adding a new item to this list later does not require
-- wiping the table.

INSERT INTO budget_items (item_name)
SELECT seed.item_name FROM (VALUES
  ('Weekly Events'),
  ('House Cup Events'),
  ('ResLife Signature Event'),
  ('House Cup Event Prize Budget'),
  ('Grad Community Events'),
  ('HC Employee of the Month'),
  ('Subscriptions'),
  ('RLA Per Diem / Incidental Expenses'),
  ('Training / Meetings'),
  ('ResLife Equipment'),
  ('Transport'),
  ('Other / Misc'),
  ('Other')
) AS seed(item_name)
WHERE NOT EXISTS (
  SELECT 1 FROM budget_items b WHERE b.item_name = seed.item_name
);
