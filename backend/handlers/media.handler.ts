import { logger } from '../utils/logger';

/**
 * Media Handlers (Articles & Newspapers)
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/articles/*, /api/newspapers/*, /api/my-newspapers
 */
export function createMediaHandlers(deps: {
  supabase: any;
  generateSecureId: (len: number) => string;
}) {
  const { supabase, generateSecureId } = deps;

  const normalizeNewspaperRole = (value: any): 'owner' | 'editor' | 'writer' | null => {
    const role = String(value || '').trim().toLowerCase();
    if (role === 'owner' || role === 'editor' || role === 'writer') return role;
    return null;
  };

  const canAssignNewspaperRole = (actorRole: string, targetRole: 'owner' | 'editor' | 'writer'): boolean => {
    if (actorRole === 'editor') return targetRole === 'writer';
    if (actorRole === 'owner') return targetRole === 'editor' || targetRole === 'writer';
    return false;
  };

  // GET /api/articles
  async function getArticles(req: any, res: any) {
    const section = req.query.section;
    let query = supabase
      .from('articles')
      .select(`
        *,
        newspapers (
          name,
          logo_url
        )
      `)
      .order('createdAt', { ascending: false })
      .limit(50);

    if (section === 'local') {
      query = query.eq('section', req.user.residenceId || req.user.regionId);
    } else {
      query = query.eq('section', 'global');
    }

    const { data: articles, error } = await query;
    if (error) {
      console.error("Articles fetch error:", error);
      return res.json([]);
    }

    // Format articles to include newspaper info and handle legacy content
    const formatted = (articles || []).map((a: any) => ({
      ...a,
      newspaperId: a.newspaper_id,
      newspaperName: a.newspapers?.name,
      newspaperLogo: a.newspapers?.logo_url,
      // Backward compatibility: if blocks is empty, create a default text block
      blocks: a.blocks && Array.isArray(a.blocks) && a.blocks.length > 0
        ? a.blocks
        : [{ id: 'legacy', type: 'text', content: a.content }]
    }));

    res.json(formatted);
  }

  // GET /api/articles/:id
  async function getArticleById(req: any, res: any) {
    const { data: article } = await supabase
      .from('articles')
      .select(`
        *,
        newspapers (
          name,
          logo_url
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (!article) return res.status(404).json({ error: "Article not found" });

    const formatted = {
      ...article,
      newspaperId: article.newspaper_id,
      newspaperName: article.newspapers?.name,
      newspaperLogo: article.newspapers?.logo_url,
      blocks: article.blocks && Array.isArray(article.blocks) && article.blocks.length > 0
        ? article.blocks
        : [{ id: 'legacy', type: 'text', content: article.content }]
    };

    res.json(formatted);
  }

  // POST /api/articles
  async function createArticle(req: any, res: any) {
    const { title, content, blocks, section, newspaperId } = req.body;
    if (!title || (!content && !blocks)) return res.status(400).json({ error: "Titolo e contenuto richiesti" });

    // If newspaperId is provided, check if user has permission
    if (newspaperId) {
      const { data: member } = await supabase
        .from('newspaper_members')
        .select('role')
        .eq('newspaper_id', newspaperId)
        .eq('user_id', req.user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!member || (member.role !== 'owner' && member.role !== 'editor' && member.role !== 'writer')) {
        return res.status(403).json({ error: "Non hai i permessi per pubblicare tramite questo giornale." });
      }
    }

    const resolvedSection = section === 'local' ? (req.user.residenceId || req.user.regionId || 'global') : 'global';

    // Rate limit: max 5 per hour
    const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000)).toISOString();
    const { count } = await supabase.from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('authorId', req.user.id)
      .gt('createdAt', oneHourAgo);

    if (count && count >= 5) return res.status(429).json({ error: "Limite raggiunto (max 5 articoli all'ora)" });

    const id = generateSecureId(7);
    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from('articles').insert({
      id,
      authorId: req.user.id,
      authorName: req.user.username,
      newspaper_id: newspaperId || null,
      title,
      content: content || (blocks?.[0]?.type === 'text' ? blocks[0].content : "Multimediale"),
      blocks: blocks || [],
      section: resolvedSection,
      createdAt: now,
      updatedAt: now
    });

    if (insertError) {
      console.error("Article insert error:", insertError);
      return res.status(500).json({ error: "Errore nella creazione dell'articolo." });
    }

    res.json({ success: true, id });
  }

  // PUT /api/articles/:id
  async function updateArticle(req: any, res: any) {
    const { title, content, blocks } = req.body;
    const { data: article } = await supabase.from('articles').select('authorId, content').eq('id', req.params.id).single();
    if (!article) return res.status(404).json({ error: "Article not found" });
    if (article.authorId !== req.user.id) return res.status(403).json({ error: "Non autorizzato" });

    await supabase.from('articles').update({
      title,
      content: content || article.content,
      blocks: blocks || [],
      updatedAt: new Date().toISOString()
    }).eq('id', req.params.id);

    res.json({ success: true });
  }

  // DELETE /api/articles/:id
  async function deleteArticle(req: any, res: any) {
    const { data: article } = await supabase.from('articles').select('authorId').eq('id', req.params.id).single();
    if (!article) return res.status(404).json({ error: "Article not found" });
    if (article.authorId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    await supabase.from('articles').delete().eq('id', req.params.id);
    res.json({ success: true });
  }

  // GET /api/articles/:id/comments
  async function getArticleComments(req: any, res: any) {
    const { data: comments, error } = await supabase
      .from('article_comments')
      .select('id, articleId, authorId, authorName, content, createdAt')
      .eq('articleId', req.params.id)
      .order('createdAt', { ascending: true });
    if (error) {
      console.error("Article comments fetch error:", error);
      return res.json([]);
    }
    res.json(comments || []);
  }

  // POST /api/articles/:id/comments
  async function postArticleComment(req: any, res: any) {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: "Content required" });
    const { data, error } = await supabase.from('article_comments').insert({
      articleId: req.params.id,
      authorId: req.user.id,
      authorName: req.user.username,
      content: content.trim(),
    }).select().single();
    if (error) {
      logger.error('operation_failed', { error: error.message });
      return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
    res.json(data);
  }

  // GET /api/articles/:id/vote
  async function getArticleVote(req: any, res: any) {
    const articleId = req.params.id;
    // Get user's vote
    const { data: userVote } = await supabase
      .from('article_votes')
      .select('vote')
      .eq('articleId', articleId)
      .eq('userId', req.user.id)
      .single();
    // Get total score
    const { count: upCount } = await supabase
      .from('article_votes')
      .select('*', { count: 'exact', head: true })
      .eq('articleId', articleId)
      .eq('vote', 'up');
    const { count: downCount } = await supabase
      .from('article_votes')
      .select('*', { count: 'exact', head: true })
      .eq('articleId', articleId)
      .eq('vote', 'down');
    const score = (upCount || 0) - (downCount || 0);
    res.json({ vote: userVote?.vote || null, score });
  }

  // POST /api/articles/:id/vote
  async function postArticleVote(req: any, res: any) {
    const articleId = req.params.id;
    const { vote } = req.body; // 'up', 'down', or null to remove
    const userId = req.user.id;

    if (vote === null || vote === undefined) {
      // Remove vote
      await supabase.from('article_votes').delete().eq('articleId', articleId).eq('userId', userId);
    } else if (vote === 'up' || vote === 'down') {
      // Upsert vote
      const { data: existing } = await supabase
        .from('article_votes')
        .select('id')
        .eq('articleId', articleId)
        .eq('userId', userId)
        .single();
      if (existing) {
        await supabase.from('article_votes').update({ vote }).eq('id', existing.id);
      } else {
        await supabase.from('article_votes').insert({ articleId, userId, vote });
      }
    }

    // Return updated score
    const { count: upCount } = await supabase
      .from('article_votes')
      .select('*', { count: 'exact', head: true })
      .eq('articleId', articleId)
      .eq('vote', 'up');
    const { count: downCount } = await supabase
      .from('article_votes')
      .select('*', { count: 'exact', head: true })
      .eq('articleId', articleId)
      .eq('vote', 'down');
    const score = (upCount || 0) - (downCount || 0);
    // Update article likeCount
    await supabase.from('articles').update({ likeCount: score }).eq('id', articleId);
    res.json({ vote: vote || null, score });
  }

  // GET /api/newspapers
  async function getNewspapers(req: any, res: any) {
    const { data: newspapers } = await supabase.from('newspapers').select('*').limit(50);
    const formatted = (newspapers || []).map((n: any) => ({
      ...n,
      logoUrl: n.logo_url,
      ownerId: n.owner_id,
      createdAt: n.created_at
    }));
    res.json(formatted);
  }

  // POST /api/newspapers
  async function createNewspaper(req: any, res: any) {
    const { name, description, logoUrl } = req.body;
    if (!name) return res.status(400).json({ error: "Nome giornale richiesto" });

    // Cost: 10,000 Money
    const cost = 10000;
    if (req.user.money < cost) return res.status(400).json({ error: `Fondi insufficienti (serve $${cost})` });

    try {
      const id = generateSecureId(8);
      // 1. Create newspaper
      const { error: nsError } = await supabase.from('newspapers').insert({
        id,
        name,
        description: description || "",
        logo_url: logoUrl || "",
        owner_id: req.user.id,
        created_at: new Date().toISOString()
      });
      if (nsError) throw nsError;

      // 2. Add owner as member
      await supabase.from('newspaper_members').insert({
        newspaper_id: id,
        user_id: req.user.id,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString()
      });

      // 3. Deduct money
      await supabase.from('users').update({ money: req.user.money - cost }).eq('id', req.user.id);

      res.json({ success: true, id });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // PUT /api/newspapers/:id
  async function updateNewspaper(req: any, res: any) {
    const { name, description, logoUrl } = req.body;
    if (!name) return res.status(400).json({ error: "Nome richiesto" });

    try {
      // Check ownership
      const { data: member } = await supabase
        .from('newspaper_members')
        .select('role')
        .eq('newspaper_id', req.params.id)
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (!member || member.role !== 'owner') {
        return res.status(403).json({ error: "Solo il proprietario può modificare il giornale." });
      }

      const { error } = await supabase.from('newspapers').update({
        name,
        description: description || "",
        logo_url: logoUrl || ""
      }).eq('id', req.params.id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // DELETE /api/newspapers/:id
  async function deleteNewspaper(req: any, res: any) {
    try {
      // Check ownership
      const { data: member } = await supabase
        .from('newspaper_members')
        .select('role')
        .eq('newspaper_id', req.params.id)
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (!member || member.role !== 'owner') {
        return res.status(403).json({ error: "Solo il proprietario può cancellare il giornale." });
      }

      // Remove all members first
      await supabase.from('newspaper_members').delete().eq('newspaper_id', req.params.id);
      // Unlink articles (set newspaper_id to null)
      await supabase.from('articles').update({ newspaper_id: null }).eq('newspaper_id', req.params.id);
      // Delete the newspaper
      const { error } = await supabase.from('newspapers').delete().eq('id', req.params.id);
      if (error) throw error;

      res.json({ success: true });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // GET /api/newspapers/:id
  async function getNewspaperById(req: any, res: any) {
    const { data: newspaper } = await supabase.from('newspapers').select('*').eq('id', req.params.id).single();
    if (!newspaper) return res.status(404).json({ error: "Giornale non trovato" });

    const { data: members } = await supabase
      .from('newspaper_members')
      .select('*, users(username)')
      .eq('newspaper_id', req.params.id)
      .eq('status', 'active');

    const { data: articles } = await supabase
      .from('articles')
      .select('*')
      .eq('newspaper_id', req.params.id)
      .order('createdAt', { ascending: false });

    res.json({
      ...newspaper,
      logoUrl: newspaper.logo_url,
      ownerId: newspaper.owner_id,
      createdAt: newspaper.created_at,
      members: (members || []).map((m: any) => ({
        ...m,
        newspaperId: m.newspaper_id,
        userId: m.user_id,
        joinedAt: m.joined_at,
        username: m.users?.username
      })),
      articles: (articles || []).map((a: any) => ({
        ...a,
        newspaperId: a.newspaper_id
      }))
    });
  }

  // GET /api/my-newspapers
  async function getMyNewspapers(req: any, res: any) {
    const { data: memberships } = await supabase
      .from('newspaper_members')
      .select(`
        newspaper_id,
        role,
        newspapers (
          id,
          name,
          logo_url
        )
      `)
      .eq('user_id', req.user.id)
      .eq('status', 'active');

    const formatted = (memberships || []).map((m: any) => ({
      id: m.newspapers?.id,
      name: m.newspapers?.name,
      logoUrl: m.newspapers?.logo_url,
      role: m.role,
      newspaperId: m.newspaper_id
    }));

    res.json(formatted);
  }

  // POST /api/newspapers/:id/members
  async function addNewspaperMember(req: any, res: any) {
    const { userId, role } = req.body;
    const newspaperId = req.params.id;
    const targetRole = normalizeNewspaperRole(role || 'writer');

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: "Utente non valido." });
    }
    if (!targetRole) {
      return res.status(400).json({ error: "Ruolo non valido." });
    }

    // Check if current user is owner or editor
    const { data: myMember } = await supabase
      .from('newspaper_members')
      .select('role')
      .eq('newspaper_id', newspaperId)
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!myMember || (myMember.role !== 'owner' && myMember.role !== 'editor')) {
      return res.status(403).json({ error: "Non hai i permessi per gestire i membri." });
    }

    if (!canAssignNewspaperRole(myMember.role, targetRole)) {
      return res.status(403).json({ error: "Non hai i permessi per assegnare questo ruolo." });
    }

    try {
      const { data: targetUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!targetUser) return res.status(404).json({ error: "Utente target non trovato." });

      await supabase.from('newspaper_members').insert({
        newspaper_id: newspaperId,
        user_id: userId,
        role: targetRole,
        status: 'active',
        joined_at: new Date().toISOString()
      });
      res.json({ success: true });
    } catch (err: any) {
      if (err?.code === '23505') {
        return res.status(409).json({ error: "L'utente è già membro di questo giornale." });
      }
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  return {
    getArticles,
    getArticleById,
    createArticle,
    updateArticle,
    deleteArticle,
    getArticleComments,
    postArticleComment,
    getArticleVote,
    postArticleVote,
    getNewspapers,
    createNewspaper,
    updateNewspaper,
    deleteNewspaper,
    getNewspaperById,
    getMyNewspapers,
    addNewspaperMember,
  };
}
