-- Migration for existing Supabase databases
-- Run these statements in Supabase SQL Editor one by one

-- 1. Add militaryExp column to users table (required for military training)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "militaryExp" INT DEFAULT 0;

-- 2. Add payMode column to factories table (salary vs resource-based work)
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "payMode" TEXT DEFAULT 'salary';
