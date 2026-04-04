import { createCommunicationHandlers } from '../handlers/communication.handler';

interface RegisterCommunicationRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
}

export function registerCommunicationRoutes(deps: RegisterCommunicationRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createCommunicationHandlers(deps);

  // Chat
  app.get('/api/chat', authenticate, h.getChat);
  app.post('/api/chat', authenticate, h.postChat);

  // Private Messages
  app.get('/api/messages', authenticate, h.getMessages);
  app.get('/api/messages/unread-count', authenticate, h.getUnreadCount);
  app.post('/api/messages', authenticate, h.sendMessage);
  app.put('/api/messages/:id/read', authenticate, h.markMessageRead);
  app.delete('/api/messages/:id', authenticate, h.deleteMessage);
}
