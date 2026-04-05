
-- Create Newspapers table
CREATE TABLE IF NOT EXISTS public.newspapers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    logoUrl TEXT,
    ownerId UUID REFERENCES public.users(id) ON DELETE CASCADE,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Create Newspaper Members table
CREATE TABLE IF NOT EXISTS public.newspaper_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    newspaperId TEXT REFERENCES public.newspapers(id) ON DELETE CASCADE,
    userId UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'writer')),
    status TEXT DEFAULT 'active',
    joinedAt TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(newspaperId, userId)
);

-- Update Articles table to support newspapers and blocks
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS newspaperId TEXT REFERENCES public.newspapers(id) ON DELETE SET NULL;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS blocks JSONB DEFAULT '[]'::jsonb;

-- Enable RLS (opzionale, ma consigliato se il service role non viene usato ovunque)
ALTER TABLE public.newspapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newspaper_members ENABLE ROW LEVEL SECURITY;

-- Criteri di accesso base (permetti lettura a tutti)
CREATE POLICY "Allow public read on newspapers" ON public.newspapers FOR SELECT USING (true);
CREATE POLICY "Allow public read on members" ON public.newspaper_members FOR SELECT USING (true);
