-- Migration: Add messages table for private messaging between players
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "senderId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "senderName" TEXT NOT NULL,
    "receiverId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "receiverName" TEXT NOT NULL,
    subject TEXT DEFAULT '',
    body TEXT NOT NULL,
    "read" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages("receiverId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages("senderId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages("receiverId") WHERE "read" = false;

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only see their own messages
DROP POLICY IF EXISTS "Users can read their own messages" ON messages;
CREATE POLICY "Users can read their own messages" ON messages
    FOR SELECT USING (auth.uid() = "senderId" OR auth.uid() = "receiverId");

DROP POLICY IF EXISTS "Users can insert messages" ON messages;
CREATE POLICY "Users can insert messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = "senderId");

DROP POLICY IF EXISTS "Users can update their received messages" ON messages;
CREATE POLICY "Users can update their received messages" ON messages
    FOR UPDATE USING (auth.uid() = "receiverId");

DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages" ON messages
    FOR DELETE USING (auth.uid() = "senderId" OR auth.uid() = "receiverId");
