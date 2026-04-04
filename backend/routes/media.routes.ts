import { createMediaHandlers } from '../handlers/media.handler';

interface RegisterMediaRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  generateSecureId: (len: number) => string;
}

export function registerMediaRoutes(deps: RegisterMediaRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createMediaHandlers(deps);

  // Articles
  app.get('/api/articles', authenticate, h.getArticles);
  app.get('/api/articles/:id', authenticate, h.getArticleById);
  app.post('/api/articles', authenticate, h.createArticle);
  app.put('/api/articles/:id', authenticate, h.updateArticle);
  app.delete('/api/articles/:id', authenticate, h.deleteArticle);

  // Article Comments
  app.get('/api/articles/:id/comments', authenticate, h.getArticleComments);
  app.post('/api/articles/:id/comments', authenticate, h.postArticleComment);

  // Article Voting
  app.get('/api/articles/:id/vote', authenticate, h.getArticleVote);
  app.post('/api/articles/:id/vote', authenticate, h.postArticleVote);

  // Newspapers
  app.get('/api/newspapers', authenticate, h.getNewspapers);
  app.post('/api/newspapers', authenticate, h.createNewspaper);
  app.put('/api/newspapers/:id', authenticate, h.updateNewspaper);
  app.delete('/api/newspapers/:id', authenticate, h.deleteNewspaper);
  app.get('/api/newspapers/:id', authenticate, h.getNewspaperById);
  app.get('/api/my-newspapers', authenticate, h.getMyNewspapers);
  app.post('/api/newspapers/:id/members', authenticate, h.addNewspaperMember);
}
