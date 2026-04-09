/**
 * Communication Handlers (Chat & Private Messages)
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/chat, /api/messages/*
 */
import { logger } from '../utils/logger';

export function createCommunicationHandlers(deps: {
  supabase: any;
}) {
  const { supabase } = deps;

  // Cache per-channel: evita una query DB ad ogni poll (ogni 15s per client)
  const CHAT_CACHE_TTL = 5_000; // 5 secondi — freschezza accettabile per una chat di gioco
  const chatCache = new Map<string, { data: any[]; fetchedAt: number }>();

  // GET /api/chat
  async function getChat(req: any, res: any) {
    const channel = (req.query.channel as string) || 'global';
    const user = req.user;
    const nation = user.originalNation || 'IT';
    const cacheKey = channel === 'local' ? `local:${nation}` : 'global';

    const cached = chatCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CHAT_CACHE_TTL) {
      return res.json(cached.data);
    }

    let query = supabase.from('chat_messages')
      .select('id, userId, username, regionId, channel, message, createdAt')
      .order('createdAt', { ascending: false })
      .limit(50);

    if (channel === 'local') {
      query = query.eq('channel', nation);
    } else {
      query = query.eq('channel', 'global');
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error("Chat fetch error:", error);
      return res.json([]);
    }

    const result = messages ? messages.reverse() : [];
    chatCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    res.json(result);
  }

  // POST /api/chat
  async function postChat(req: any, res: any) {
    const { message, channel: reqChannel } = req.body;
    const user = req.user;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Messaggio vuoto" });
    }
    if (message.trim().length > 280) {
      return res.status(400).json({ error: "Messaggio troppo lungo (max 280 caratteri)" });
    }

    // Determine channel: 'global' or the user's nation code for local chat
    const channel = reqChannel === 'local' ? (user.originalNation || 'IT') : 'global';

    // Rate limit: 1 message per 5 seconds
    const { data: lastMsg } = await supabase.from('chat_messages')
      .select('createdAt')
      .eq('userId', user.id)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastMsg && Date.now() - new Date(lastMsg.createdAt).getTime() < 5000) {
      return res.status(429).json({ error: "Aspetta qualche secondo prima di inviare un altro messaggio" });
    }

    const { error: insertError } = await supabase.from('chat_messages').insert({
      userId: user.id,
      username: user.username,
      regionId: user.regionId || "?",
      channel,
      message: message.trim(),
      createdAt: new Date().toISOString()
    });

    if (insertError) {
      console.error("Chat insert error:", insertError);
      logger.error('operation_failed', { error: insertError.message });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }

    // Invalida la cache del canale così il prossimo GET vede il nuovo messaggio
    chatCache.delete(channel === 'local' ? `local:${user.originalNation || 'IT'}` : 'global');

    res.json({ success: true });
  }

  // GET /api/messages
  async function getMessages(req: any, res: any) {
    const userId = req.user.id;
    const folder = req.query.folder || 'inbox'; // 'inbox' or 'sent'

    let query = supabase.from('messages').select('*');
    if (folder === 'sent') {
      query = query.eq('senderId', userId);
    } else {
      query = query.eq('receiverId', userId);
    }
    query = query.order('createdAt', { ascending: false }).limit(50);

    const { data, error } = await query;
    if (error) {
      logger.error('operation_failed', { error: error.message });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
    res.json(data || []);
  }

  // GET /api/messages/unread-count
  async function getUnreadCount(req: any, res: any) {
    const { count, error } = await supabase.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiverId', req.user.id)
      .eq('read', false);
    if (error) {
      logger.error('operation_failed', { error: error.message });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
    res.json({ count: count || 0 });
  }

  // POST /api/messages
  async function sendMessage(req: any, res: any) {
    const { receiverUsername, subject, body } = req.body;
    if (!receiverUsername || !body) return res.status(400).json({ error: "Destinatario e messaggio obbligatori." });
    if (body.length > 2000) return res.status(400).json({ error: "Messaggio troppo lungo (max 2000 caratteri)." });
    if (subject && subject.length > 100) return res.status(400).json({ error: "Oggetto troppo lungo (max 100 caratteri)." });

    // Find receiver
    const { data: receiver } = await supabase.from('users').select('id, username').eq('username', receiverUsername).maybeSingle();
    if (!receiver) return res.status(404).json({ error: "Giocatore non trovato." });
    if (receiver.id === req.user.id) return res.status(400).json({ error: "Non puoi inviare messaggi a te stesso." });

    // Rate limit: max 1 message per 30 seconds
    const MESSAGE_RATE_LIMIT_MS = 30 * 1000;
    const { data: lastMsg } = await supabase.from('messages')
      .select('createdAt')
      .eq('senderId', req.user.id)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastMsg && Date.now() - new Date(lastMsg.createdAt).getTime() < MESSAGE_RATE_LIMIT_MS) {
      return res.status(429).json({ error: "Attendi 30 secondi tra un messaggio e l'altro." });
    }

    const { error } = await supabase.from('messages').insert({
      senderId: req.user.id,
      senderName: req.user.username,
      receiverId: receiver.id,
      receiverName: receiver.username,
      subject: subject || '',
      body,
      read: false,
      createdAt: new Date().toISOString()
    });
    if (error) {
      logger.error('operation_failed', { error: error.message });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
    res.json({ success: true });
  }

  // PUT /api/messages/:id/read
  async function markMessageRead(req: any, res: any) {
    const { id } = req.params;
    const { error } = await supabase.from('messages')
      .update({ read: true })
      .eq('id', id)
      .eq('receiverId', req.user.id);
    if (error) {
      logger.error('operation_failed', { error: error.message });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
    res.json({ success: true });
  }

  // DELETE /api/messages/:id
  async function deleteMessage(req: any, res: any) {
    const { id } = req.params;
    const { data: message, error: messageError } = await supabase.from('messages')
      .select('senderId, receiverId')
      .eq('id', id)
      .maybeSingle();

    if (messageError) {
      logger.error('operation_failed', { error: messageError.message });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
    if (!message) return res.status(404).json({ error: "Messaggio non trovato." });
    if (message.senderId !== req.user.id && message.receiverId !== req.user.id) {
      return res.status(403).json({ error: "Non autorizzato a eliminare questo messaggio." });
    }

    const { error } = await supabase.from('messages')
      .delete()
      .eq('id', id);
    if (error) {
      logger.error('operation_failed', { error: error.message });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
    res.json({ success: true });
  }

  return {
    getChat,
    postChat,
    getMessages,
    getUnreadCount,
    sendMessage,
    markMessageRead,
    deleteMessage,
  };
}
