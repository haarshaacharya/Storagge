/*
# Add user accounts, analytics, and password reset support

## Overview
Adds user account management (signup/login with email or phone), password reset
via OTP, usage analytics tracking, and removes bookmark from quick_urls.

## 1. New Tables

### `profiles`
Registered user accounts.
- id (uuid PK), name, email (unique), phone (unique), password_hash,
  display_picture_url, is_admin, created_at

### `password_resets`
OTP codes for password reset.
- id, identifier (email/phone), otp_code, expires_at, used, created_at

### `tool_usage_logs`
Tracks every AI tool click for analytics.
- id, tool_id (FK ai_tools), tool_name, user_id (FK profiles), clicked_at

## 2. Modified Tables
### `quick_urls`
- Drop is_bookmarked column (bookmarks are AI-tools-only now).

## 3. Security
- RLS enabled on all new tables.
- anon + authenticated CRUD allowed (single-tenant public app).
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- profiles table
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  phone text UNIQUE,
  password_hash text NOT NULL,
  display_picture_url text,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_profiles" ON profiles;
CREATE POLICY "anon_select_profiles" ON profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_profiles" ON profiles;
CREATE POLICY "anon_insert_profiles" ON profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_profiles" ON profiles;
CREATE POLICY "anon_update_profiles" ON profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_profiles" ON profiles;
CREATE POLICY "anon_delete_profiles" ON profiles FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- password_resets table
-- ============================================================
CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_password_resets" ON password_resets;
CREATE POLICY "anon_select_password_resets" ON password_resets FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_password_resets" ON password_resets;
CREATE POLICY "anon_insert_password_resets" ON password_resets FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_password_resets" ON password_resets;
CREATE POLICY "anon_update_password_resets" ON password_resets FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_password_resets" ON password_resets;
CREATE POLICY "anon_delete_password_resets" ON password_resets FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- tool_usage_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS tool_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid REFERENCES ai_tools(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  clicked_at timestamptz DEFAULT now()
);

ALTER TABLE tool_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tool_usage_logs" ON tool_usage_logs;
CREATE POLICY "anon_select_tool_usage_logs" ON tool_usage_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tool_usage_logs" ON tool_usage_logs;
CREATE POLICY "anon_insert_tool_usage_logs" ON tool_usage_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tool_usage_logs" ON tool_usage_logs;
CREATE POLICY "anon_delete_tool_usage_logs" ON tool_usage_logs FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_tool_usage_logs_clicked_at ON tool_usage_logs(clicked_at);
CREATE INDEX IF NOT EXISTS idx_tool_usage_logs_tool_id ON tool_usage_logs(tool_id);

-- ============================================================
-- Remove is_bookmarked from quick_urls
-- ============================================================
ALTER TABLE quick_urls DROP COLUMN IF EXISTS is_bookmarked;

-- ============================================================
-- Default admin account: admin@aihub.com / admin123
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'admin@aihub.com') THEN
    INSERT INTO profiles (name, email, password_hash, is_admin)
    VALUES (
      'Admin',
      'admin@aihub.com',
      encode(digest('admin123', 'sha256'), 'hex'),
      true
    );
  END IF;
END $$;
