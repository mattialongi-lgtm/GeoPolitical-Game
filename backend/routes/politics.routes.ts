import { createPoliticsHandlers } from '../handlers/politics.handler';

interface RegisterPoliticsRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  generateSecureId: (length?: number) => string;
  getUserPerks: (userId: string, boosterInfo?: Record<string, any>) => Promise<Record<string, number>>;
  partyAssetsService: any;
  mapServiceResultToHttp: (result: any) => { statusCode: number; body: any };
  LawRegistry: any;
  GAME_CONFIG: any;
}

export function registerPoliticsRoutes(deps: RegisterPoliticsRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createPoliticsHandlers(deps);

  // Parties
  app.post('/api/parties/create', authenticate, h.createParty);
  app.put('/api/parties/edit', authenticate, h.editParty);
  app.get('/api/parties', authenticate, h.getParties);
  app.get('/api/parties/my', authenticate, h.getMyParty);
  app.get('/api/parties/my-invites', authenticate, h.getMyInvites);
  app.get('/api/parties/:id', authenticate, h.getPartyById);
  app.post('/api/parties/roles', authenticate, h.setPartyRoles);
  app.post('/api/parties/kick', authenticate, h.kickMember);
  app.post('/api/parties/set-wage', authenticate, h.setWage);
  app.post('/api/parties/pay-wages', authenticate, h.payWages);
  app.post('/api/parties/contribute', authenticate, h.contribute);
  app.post('/api/parties/invite', authenticate, h.invite);
  app.post('/api/parties/join', authenticate, h.joinParty);
  app.post('/api/parties/primaries-vote', authenticate, h.primariesVote);

  // Elections
  app.get('/api/elections', authenticate, h.getElections);
  app.post('/api/elections/vote', authenticate, h.voteElection);

  // Parliament
  app.get('/api/parliament', authenticate, h.getParliament);
  app.get('/api/parliament/laws', authenticate, h.getParliamentLaws);
  app.post('/api/parliament/laws/propose', authenticate, h.proposeLaw);
  app.post('/api/parliament/laws/vote', authenticate, h.voteLaw);
  app.post('/api/parliament/laws/withdraw', authenticate, h.withdrawLaw);
  app.post('/api/parliament/laws/pass', authenticate, h.passLaw);

  // Blocs
  app.get('/api/blocs', authenticate, h.getBlocs);
  app.get('/api/blocs-map', authenticate, h.getBlocsMap);
  app.post('/api/blocs/create', authenticate, h.createBloc);
  app.get('/api/blocs/:id', authenticate, h.getBlocById);
  app.post('/api/blocs/applications/:id/vote', authenticate, h.voteApplication);
  app.post('/api/blocs/:id/update', authenticate, h.updateBloc);
  app.post('/api/blocs/:id/apply', authenticate, h.applyToBloc);
  app.post('/api/blocs/:id/regulations/propose', authenticate, h.proposeRegulation);
  app.post('/api/blocs/regulations/proposals/:id/vote', authenticate, h.voteRegulationProposal);
}
