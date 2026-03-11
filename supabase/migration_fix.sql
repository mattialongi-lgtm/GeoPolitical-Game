-- ==========================================
-- MIGRAZIONE FIX: Tabelle e colonne mancanti
-- ==========================================
-- ISTRUZIONI: Copia tutto questo file e incollalo nel
-- SQL Editor di Supabase, poi clicca "Run".
-- Puoi eseguirlo più volte senza problemi (usa IF NOT EXISTS).
-- ==========================================

-- 1. Aggiungi colonne mancanti alla tabella USERS
ALTER TABLE users ADD COLUMN IF NOT EXISTS "perkUpgradesJson" TEXT DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "boostersJson" TEXT DEFAULT '{}';

-- 2. Crea la tabella PERKS (livelli dei perk per ogni utente)
CREATE TABLE IF NOT EXISTS perks (
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "perkId" TEXT NOT NULL,
    level INT DEFAULT 0,
    PRIMARY KEY ("userId", "perkId")
);

-- 3. Crea la tabella CHAT_MESSAGES (messaggi della chat globale)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    username TEXT,
    "regionId" TEXT,
    message TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Crea la tabella ARTICLES (articoli/giornale)
CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    "authorId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "authorName" TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Disabilita RLS (Row Level Security) per queste tabelle
--    così il server con Service Role Key può accedere a tutto.
--    Se hai già RLS abilitato su queste tabelle, queste righe
--    assicurano che ci siano le policy corrette.
ALTER TABLE perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Policy: il server usa la Service Role Key che bypassa RLS,
-- ma aggiungiamo policy di lettura pubblica per sicurezza.
DO $$
BEGIN
    -- Perks
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'perks' AND policyname = 'Perks are viewable by everyone') THEN
        CREATE POLICY "Perks are viewable by everyone" ON perks FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'perks' AND policyname = 'Server can manage perks') THEN
        CREATE POLICY "Server can manage perks" ON perks FOR ALL USING (true);
    END IF;

    -- Chat Messages
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Chat messages are viewable by everyone') THEN
        CREATE POLICY "Chat messages are viewable by everyone" ON chat_messages FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Server can manage chat') THEN
        CREATE POLICY "Server can manage chat" ON chat_messages FOR ALL USING (true);
    END IF;

    -- Articles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'articles' AND policyname = 'Articles are viewable by everyone') THEN
        CREATE POLICY "Articles are viewable by everyone" ON articles FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'articles' AND policyname = 'Server can manage articles') THEN
        CREATE POLICY "Server can manage articles" ON articles FOR ALL USING (true);
    END IF;
END $$;

-- ==========================================
-- FATTO! Se non ci sono errori rossi, tutto è andato a buon fine.
-- ==========================================
