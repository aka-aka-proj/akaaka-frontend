-- Migration: Add INSERT policy for profiles table
-- The existing RLS policies only allow SELECT and UPDATE on profiles.
-- This causes "new row violates row-level security policy" when a new user
-- completes onboarding and the client tries to upsert their profile row.

CREATE POLICY profiles_insert_self ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
