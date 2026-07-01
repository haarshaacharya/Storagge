/*
# Create initial schema for AI Tools Hub

1. New Tables
- `categories`: Stores tool categories (coding, music, editing, etc.)
  - `id` (uuid, primary key)
  - `name` (text, unique, not null)
  - `icon` (text, for lucide icon name)
  - `sort_order` (integer, for custom ordering)
  - `created_at` (timestamp)

- `ai_tools`: Stores AI tools with category reference
  - `id` (uuid, primary key)
  - `name` (text, not null)
  - `url` (text, not null)
  - `logo_url` (text, optional logo image URL)
  - `category_id` (uuid, foreign key to categories)
  - `is_bookmarked` (boolean, default false)
  - `sort_order` (integer, for custom ordering)
  - `created_at` (timestamp)

- `quick_urls`: Stores URL shortcuts for quick access
  - `id` (uuid, primary key)
  - `title` (text, not null)
  - `url` (text, not null)
  - `is_bookmarked` (boolean, default false)
  - `created_at` (timestamp)

2. Security
- Enable RLS on all tables.
- Allow anon + authenticated full CRUD since this is a single-tenant public app.
- Admin access controlled via secret key in URL (not database-level).
*/

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  icon text NOT NULL DEFAULT 'Folder',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- AI Tools table
CREATE TABLE IF NOT EXISTS ai_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  logo_url text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_bookmarked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Quick URLs table
CREATE TABLE IF NOT EXISTS quick_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  is_bookmarked boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_urls ENABLE ROW LEVEL SECURITY;

-- Categories policies
DROP POLICY IF EXISTS "anon_crud_categories" ON categories;
CREATE POLICY "anon_crud_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE
  TO anon, authenticated USING (true);

-- AI Tools policies
DROP POLICY IF EXISTS "anon_crud_ai_tools" ON ai_tools;
CREATE POLICY "anon_crud_ai_tools" ON ai_tools FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_ai_tools" ON ai_tools FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_ai_tools" ON ai_tools FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_ai_tools" ON ai_tools FOR DELETE
  TO anon, authenticated USING (true);

-- Quick URLs policies
DROP POLICY IF EXISTS "anon_crud_quick_urls" ON quick_urls;
CREATE POLICY "anon_crud_quick_urls" ON quick_urls FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_quick_urls" ON quick_urls FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_quick_urls" ON quick_urls FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_quick_urls" ON quick_urls FOR DELETE
  TO anon, authenticated USING (true);

-- Insert default categories
INSERT INTO categories (name, icon, sort_order) VALUES
  ('Coding', 'Code', 1),
  ('Music', 'Music', 2),
  ('Editing', 'Film', 3),
  ('Writing', 'PenTool', 4),
  ('Design', 'Palette', 5),
  ('Other', 'Sparkles', 99)
ON CONFLICT (name) DO NOTHING;