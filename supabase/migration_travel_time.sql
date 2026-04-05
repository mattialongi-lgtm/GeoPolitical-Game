-- Migration: Add travel time columns to users table
-- Run this in the Supabase SQL Editor

-- Add travelingTo column (ISO code of travel destination)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "travelingTo" TEXT DEFAULT NULL;

-- Add travelingUntil column (timestamp in ms when travel completes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "travelingUntil" BIGINT DEFAULT NULL;
