/**
 * Zod request-body schemas for backend endpoints.
 *
 * Convention: schema name = `<HandlerMethod>Schema`
 * Inferred TS type = `<HandlerMethod>Body`
 *
 * Schemas are kept intentionally loose (mostly `z.string()` without
 * strict UUID checks) because the existing DB / Supabase layer
 * already enforces FK constraints.  The goal here is to catch
 * obvious client-side mistakes early (missing fields, wrong types).
 */

import { z } from 'zod/v4';

// ─── User ────────────────────────────────────────────────────────

export const ChangeNationSchema = z.object({
  nationId: z.string().min(1, 'nationId è obbligatorio'),
});
export type ChangeNationBody = z.infer<typeof ChangeNationSchema>;

export const UpdateAvatarSchema = z.object({
  avatarData: z.string().min(1, 'avatarData è obbligatorio').max(260000, 'avatarData supera la dimensione massima consentita'),
});
export type UpdateAvatarBody = z.infer<typeof UpdateAvatarSchema>;

export const UpdateUsernameSchema = z.object({
  username: z.string().min(1, 'username è obbligatorio').max(30),
});
export type UpdateUsernameBody = z.infer<typeof UpdateUsernameSchema>;

// ─── Actions ─────────────────────────────────────────────────────

export const FactoryIdSchema = z.object({
  factoryId: z.string().min(1, 'factoryId è obbligatorio'),
});
export type FactoryIdBody = z.infer<typeof FactoryIdSchema>;

export const RegionIdSchema = z.object({
  regionId: z.string().min(1, 'regionId è obbligatorio'),
});
export type RegionIdBody = z.infer<typeof RegionIdSchema>;

export const UpgradePerkSchema = z.object({
  perkId: z.string().min(1, 'perkId è obbligatorio'),
  useGold: z.boolean().optional(),
});
export type UpgradePerkBody = z.infer<typeof UpgradePerkSchema>;

// ─── Wars (legacy) ──────────────────────────────────────────────

export const DeployWeaponSchema = z.object({
  warId: z.string().min(1, 'warId è obbligatorio'),
  side: z.string().min(1, 'side è obbligatorio'),
  weaponId: z.string().min(1, 'weaponId è obbligatorio'),
});
export type DeployWeaponBody = z.infer<typeof DeployWeaponSchema>;

export const MilitaryAgreementSchema = z.object({
  targetStateId: z.string().min(1, 'targetStateId è obbligatorio'),
  agreementType: z.string().min(1, 'agreementType è obbligatorio'),
});
export type MilitaryAgreementBody = z.infer<typeof MilitaryAgreementSchema>;

// ─── Factories ──────────────────────────────────────────────────

export const DepositBudgetSchema = z.object({
  factoryId: z.string().min(1, 'factoryId è obbligatorio'),
  amount: z.number().positive('amount deve essere > 0'),
});
export type DepositBudgetBody = z.infer<typeof DepositBudgetSchema>;

export const UpgradeFactorySchema = z.object({
  factoryId: z.string().min(1, 'factoryId è obbligatorio'),
  payMode: z.string().optional(),
});
export type UpgradeFactoryBody = z.infer<typeof UpgradeFactorySchema>;

export const TargetLevelUpgradeSchema = z.object({
  factoryId: z.string().min(1, 'factoryId è obbligatorio'),
  targetLevel: z.number().int().positive(),
});
export type TargetLevelUpgradeBody = z.infer<typeof TargetLevelUpgradeSchema>;

// ─── Market ─────────────────────────────────────────────────────

export const CreateOfferSchema = z.object({
  itemName: z.string().min(1, 'itemName è obbligatorio'),
  quantity: z.number().int().positive('quantity deve essere > 0'),
  price: z.number().positive('price deve essere > 0'),
});
export type CreateOfferBody = z.infer<typeof CreateOfferSchema>;

export const EditOfferSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().positive('quantity deve essere > 0'),
  price: z.number().positive('price deve essere > 0'),
});
export type EditOfferBody = z.infer<typeof EditOfferSchema>;

export const BuyOfferSchema = z.object({
  offerId: z.string().min(1, 'offerId è obbligatorio'),
  quantity: z.number().int().positive('quantity deve essere > 0'),
  isStateBuy: z.boolean().optional(),
});
export type BuyOfferBody = z.infer<typeof BuyOfferSchema>;

// ─── Governance ─────────────────────────────────────────────────

export const DonateSchema = z.object({
  entityId: z.string().min(1, 'entityId è obbligatorio'),
  amount: z.number().positive('amount deve essere > 0'),
  currency: z.string().min(1, 'currency è obbligatorio'),
});
export type DonateBody = z.infer<typeof DonateSchema>;

export const AssignMinisterSchema = z.object({
  userId: z.string().min(1, 'userId è obbligatorio'),
  role: z.string().min(1, 'role è obbligatorio'),
  iso2: z.string().optional(),
});
export type AssignMinisterBody = z.infer<typeof AssignMinisterSchema>;

// ─── Resources ──────────────────────────────────────────────────

export const ResourceWorkSchema = z.object({
  regionId: z.string().min(1, 'regionId è obbligatorio'),
  resourceType: z.string().min(1, 'resourceType è obbligatorio'),
});
export type ResourceWorkBody = z.infer<typeof ResourceWorkSchema>;

export const DeepExplorationSchema = z.object({
  nationId: z.string().min(1, 'nationId è obbligatorio'),
  resourceType: z.string().min(1, 'resourceType è obbligatorio'),
  level: z.number().int().positive(),
});
export type DeepExplorationBody = z.infer<typeof DeepExplorationSchema>;

export const TransferWorkExpSchema = z.object({
  sourceResource: z.string().min(1, 'sourceResource è obbligatorio'),
  targetResource: z.string().min(1, 'targetResource è obbligatorio'),
  xpToTransfer: z.number().int().positive('xpToTransfer deve essere > 0'),
});
export type TransferWorkExpBody = z.infer<typeof TransferWorkExpSchema>;

// ─── Communication ──────────────────────────────────────────────

export const SendChatSchema = z.object({
  message: z.string().min(1, 'message è obbligatorio').max(1000),
  channel: z.string().optional(),
});
export type SendChatBody = z.infer<typeof SendChatSchema>;

export const SendMailSchema = z.object({
  receiverUsername: z.string().min(1, 'receiverUsername è obbligatorio'),
  subject: z.string().min(1, 'subject è obbligatorio').max(200),
  body: z.string().min(1, 'body è obbligatorio').max(5000),
});
export type SendMailBody = z.infer<typeof SendMailSchema>;

// ─── Media ──────────────────────────────────────────────────────

export const CreateArticleSchema = z.object({
  title: z.string().min(1, 'title è obbligatorio').max(200),
  content: z.string().min(1, 'content è obbligatorio'),
  blocks: z.any().optional(),
  section: z.string().optional(),
  newspaperId: z.string().optional(),
});
export type CreateArticleBody = z.infer<typeof CreateArticleSchema>;

export const CreateNewspaperSchema = z.object({
  name: z.string().min(1, 'name è obbligatorio').max(100),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
});
export type CreateNewspaperBody = z.infer<typeof CreateNewspaperSchema>;

// ─── Politics ───────────────────────────────────────────────────

export const CreatePartySchema = z.object({
  name: z.string().min(1, 'name è obbligatorio').max(100),
  ideology: z.string().optional(),
  tag: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
});
export type CreatePartyBody = z.infer<typeof CreatePartySchema>;

export const ProposeLawSchema = z.object({
  type: z.string().min(1, 'type è obbligatorio'),
  params: z.record(z.string(), z.unknown()).optional(),
});
export type ProposeLawBody = z.infer<typeof ProposeLawSchema>;

export const VoteLawSchema = z.object({
  lawId: z.string().min(1, 'lawId è obbligatorio'),
  vote: z.string().min(1, 'vote è obbligatorio'),
});
export type VoteLawBody = z.infer<typeof VoteLawSchema>;
