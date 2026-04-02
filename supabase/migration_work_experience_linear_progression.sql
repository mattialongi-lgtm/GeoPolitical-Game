-- Align work experience persistence with the linear progression model:
-- experienceMultiplier = 1 + (workXp / 1000)
-- New rows must start from 0 XP so 0 XP => 1.00x.

ALTER TABLE IF EXISTS public.player_resource_work_experience
  ALTER COLUMN experience SET DEFAULT 0;

UPDATE public.player_resource_work_experience
SET experience = 0
WHERE experience < 0;
