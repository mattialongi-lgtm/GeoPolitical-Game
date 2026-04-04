import type { Request, Response, NextFunction } from 'express';

/**
 * Extended Express Request with authenticated user data
 * populated by the authenticate middleware.
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    username: string;
    email: string;
    money: number;
    gold: number;
    energy: number;
    xp: number;
    level: number;
    regionId: string;
    originalNationId: string;
    displayedNationId: string;
    perks: Record<string, number>;
    perkUpgrades: Record<string, any>;
    boosters: Record<string, any>;
    inventory: Record<string, number>;
    inventoryVolume: number;
    partyId?: string;
    partyName?: string;
    partyLogo?: string;
    [key: string]: any;
  };
}

/**
 * Standard Express route handler with Promise return.
 */
export type RouteHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => Promise<void>;

/**
 * Dependencies passed to route/handler registration functions.
 * Uses `any` for now — will be typed incrementally as services are extracted.
 */
export interface RouteDeps {
  app: any;
  authenticate: any;
  supabase: any;
  /** Shared helper functions defined in server.ts */
  [key: string]: any;
}
