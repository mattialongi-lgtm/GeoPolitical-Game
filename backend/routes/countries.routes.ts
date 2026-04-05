import { createCountriesHandlers } from '../handlers/countries.handler';

interface RegisterCountriesRoutesDeps {
  app: any;
  authenticate: any;
  supabase: any;
  isValidIso2: any;
}

export function registerCountriesRoutes(deps: RegisterCountriesRoutesDeps) {
  const { app, authenticate } = deps;
  const h = createCountriesHandlers(deps);

  app.get('/api/countries/:iso2', authenticate, h.getCountry);
  app.get('/api/countries/:iso2/agreements', authenticate, h.getCountryAgreements);
  app.get('/api/countries/:iso2/sanctions', authenticate, h.getCountrySanctions);
}
