-- ═══════════════════════════════════════════════════════════════
-- CodeBoard Chat History Schema
-- ═══════════════════════════════════════════════════════════════

-- 1. Create chat_history table
CREATE TABLE IF NOT EXISTS public.chat_history (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID        NOT NULL,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  message         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for chat_history
-- Allow anyone to insert chat history (unauthenticated users can use chatbot)
CREATE POLICY "Allow anyone to insert chat history" 
ON public.chat_history FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow users to read their own chat history
CREATE POLICY "Allow users to read their own chat history" 
ON public.chat_history FOR SELECT 
USING (auth.uid() = user_id OR (auth.uid() IS NULL AND user_id IS NULL));

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_chat_history_conversation_id ON public.chat_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.chat_history(user_id);
