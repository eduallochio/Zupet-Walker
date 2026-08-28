import type { WalkerProfile } from '../types/walker';

export const PLAN_LIMITS = {
  free: {
    linkedPets:    7,   // pets vinculados por tutores
    ownPets:       7,   // pets cadastrados pelo walker
    services:      1,   // serviços criados
    petsPerWalk:   2,   // pets simultâneos por passeio
    reportDays:    7,   // dias de histórico de relatórios
    lastMinute:    false,
  },
  pro: {
    linkedPets:    Infinity,
    ownPets:       Infinity,
    services:      Infinity,
    petsPerWalk:   Infinity, // usa max_pets_per_walk do perfil
    reportDays:    Infinity,
    lastMinute:    true,
  },
} as const;

export function isPro(profile: WalkerProfile | null): boolean {
  return profile?.plan === 'pro';
}

export function getLimits(profile: WalkerProfile | null) {
  return isPro(profile) ? PLAN_LIMITS.pro : PLAN_LIMITS.free;
}

export function maxPetsPerWalk(profile: WalkerProfile | null): number {
  if (isPro(profile)) {
    return profile?.max_pets_per_walk ?? 10;
  }
  return PLAN_LIMITS.free.petsPerWalk;
}
