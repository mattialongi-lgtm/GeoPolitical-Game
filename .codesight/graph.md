# Dependency Graph

## Most Imported Files (change these carefully)

- `src\types.ts` — imported by **72** files
- `backend\utils\logger.ts` — imported by **16** files
- `src\hooks\usePollingTask.ts` — imported by **12** files
- `src\components\home\mockData.ts` — imported by **11** files
- `backend\middleware\rateLimiter.middleware.ts` — imported by **8** files
- `backend\services\service-result.ts` — imported by **8** files
- `backend\__tests__\setup.ts` — imported by **8** files
- `backend\repositories\war.repository.ts` — imported by **7** files
- `src\components\ResourceIcon.tsx` — imported by **7** files
- `backend\services\war-domain.helpers.ts` — imported by **6** files
- `backend\services\http-result.mapper.ts` — imported by **5** files
- `src\api\httpClient.ts` — imported by **5** files
- `src\utils\time.ts` — imported by **5** files
- `backend\services\factory-economy.shared.ts` — imported by **4** files
- `src\lib\supabase.ts` — imported by **4** files
- `backend\services\factory-create.service.ts` — imported by **3** files
- `backend\repositories\production.repository.ts` — imported by **3** files
- `backend\services\production.service.ts` — imported by **3** files
- `backend\services\war.service.ts` — imported by **3** files
- `backend\handlers\automation.handler.ts` — imported by **3** files

## Import Map (who imports what)

- `src\types.ts` ← `backend\handlers\resources.handler.ts`, `backend\handlers\wars-legacy.handler.ts`, `backend\repositories\daily-reward.repository.ts`, `backend\routes\wars-legacy.routes.ts`, `backend\services\daily-reward.service.ts` +67 more
- `backend\utils\logger.ts` ← `backend\handlers\actions.handler.ts`, `backend\handlers\communication.handler.ts`, `backend\handlers\factories.handler.ts`, `backend\handlers\factory-market.handler.ts`, `backend\handlers\governance.handler.ts` +11 more
- `src\hooks\usePollingTask.ts` ← `src\components\articles\ArticleDetailView.tsx`, `src\components\articles\ArticlesView.tsx`, `src\components\articles\NewspaperDetailView.tsx`, `src\components\chat\GlobalChat.tsx`, `src\components\country\CountryDetailView.tsx` +7 more
- `src\components\home\mockData.ts` ← `src\App.tsx`, `src\App.tsx`, `src\components\home\EventHistoryCard.tsx`, `src\components\home\HomePage.tsx`, `src\components\home\ParliamentCard.tsx` +6 more
- `backend\middleware\rateLimiter.middleware.ts` ← `backend\app.ts`, `backend\routes\actions.routes.ts`, `backend\routes\factories.routes.ts`, `backend\routes\governance.routes.ts`, `backend\routes\market.routes.ts` +3 more
- `backend\services\service-result.ts` ← `backend\services\daily-reward.service.ts`, `backend\services\factory-create.service.ts`, `backend\services\factory-economy.service.ts`, `backend\services\factory-upgrade.service.ts`, `backend\services\http-result.mapper.ts` +3 more
- `backend\__tests__\setup.ts` ← `backend\__tests__\handlers\automation.handler.test.ts`, `backend\__tests__\handlers\resources.handler.test.ts`, `backend\__tests__\middleware\errorHandler.test.ts`, `backend\__tests__\middleware\validation.test.ts`, `backend\__tests__\services\economy.service.test.ts` +3 more
- `backend\repositories\war.repository.ts` ← `backend\routes\war.routes.ts`, `backend\services\war-create.usecase.ts`, `backend\services\war-deploy.usecase.ts`, `backend\services\war-targets.usecase.ts`, `backend\services\war-validation.usecase.ts` +2 more
- `src\components\ResourceIcon.tsx` ← `src\components\ExtractionDashboard.tsx`, `src\components\FactoryMarket.tsx`, `src\components\market\MarketView.tsx`, `src\components\produce\ProduceView.tsx`, `src\components\ResourceHistoryView.tsx` +2 more
- `backend\services\war-domain.helpers.ts` ← `backend\app.ts`, `backend\routes\war.routes.ts`, `backend\services\war-create.usecase.ts`, `backend\services\war-deploy.usecase.ts`, `backend\services\war.service.ts` +1 more
