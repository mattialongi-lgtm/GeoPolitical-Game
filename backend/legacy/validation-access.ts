export const isValidIso2 = (code: string): boolean => /^[A-Z]{2,4}$/.test(code);

export const isValidUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const isAllowedAvatarDataUrl = (value: string): boolean =>
  /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(value);

export const normalizeRegionLikeId = (value: any): string | null => {
  const normalized = String(value || "").trim().toUpperCase();
  return isValidIso2(normalized) ? normalized : null;
};

export const normalizeNewspaperRole = (value: any): "owner" | "editor" | "writer" | null => {
  const role = String(value || "").trim().toLowerCase();
  if (role === "owner" || role === "editor" || role === "writer") return role;
  return null;
};

export const canAssignNewspaperRole = (
  actorRole: string,
  targetRole: "owner" | "editor" | "writer"
): boolean => {
  if (actorRole === "editor") return targetRole === "writer";
  if (actorRole === "owner") return targetRole === "editor" || targetRole === "writer";
  return false;
};

export function createAccessHelpers(supabase: any) {
  const canManageRegion = async (regionId: string, userId: string): Promise<boolean> => {
    const normalizedRegionId = String(regionId || "").trim().toUpperCase();
    if (!isValidIso2(normalizedRegionId) || !userId) return false;

    const { data: region, error } = await supabase
      .from("regions")
      .select("ownerUserId, leaderUserId")
      .eq("id", normalizedRegionId)
      .maybeSingle();

    if (error || !region) return false;
    return region.ownerUserId === userId || region.leaderUserId === userId;
  };

  const canReadRegionScopedData = async (user: any, regionId: string): Promise<boolean> => {
    if (!user?.id || !regionId) return false;
    const canManage = await canManageRegion(regionId, user.id);
    if (canManage) return true;
    return user.residenceId === regionId || user.workPermitId === regionId;
  };

  const assertCanManageRegion = async (
    req: any,
    res: any,
    rawRegionId: any,
    forbiddenMessage: string
  ): Promise<string | null> => {
    const regionId = normalizeRegionLikeId(rawRegionId);
    if (!regionId) {
      res.status(400).json({ error: "Regione non valida." });
      return null;
    }

    const allowed = await canManageRegion(regionId, req.user?.id);
    if (!allowed) {
      res.status(403).json({ error: forbiddenMessage });
      return null;
    }

    return regionId;
  };

  return {
    canManageRegion,
    canReadRegionScopedData,
    assertCanManageRegion,
  };
}
