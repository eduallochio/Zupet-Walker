export type WalkerPlan = 'free' | 'pro';

export type WalkerProfile = {
  id: string;
  user_id: string;
  name: string;
  bio?: string;
  city: string;
  phone?: string;
  cep?: string;
  cpf?: string;
  avatar_url?: string;
  price_per_hour?: number;
  rating?: number;
  active: boolean;
  plan: WalkerPlan;
  experience_years?: number;
  certifications?: string[];
  services?: string[];
  max_pets_per_walk?: number;
  service_radius_km?: number;
  available_days?: number[];
  available_start?: string;
  available_end?: string;
  terms_accepted?: boolean;
  terms_accepted_at?: string;
  updated_at?: string;
  created_at: string;
};

export type PetStatus = 'pending' | 'active' | 'inactive';

export type LinkedPet = {
  id: string;
  walker_id: string;
  pet_id: string;
  owner_id: string;
  status: PetStatus;
  linked_at: string;
  // dados do pet (join)
  pet?: {
    id: string;
    name: string;
    breed?: string;
    photo_uri?: string;
    species?: string;
    gender?: string;
    dob?: string;
    weight?: number;
    castrated?: boolean;
    microchip?: string;
    food_allergies?: string[];
    med_allergies?: string[];
    restrictions?: string;
    observations?: string;
  };
  // dados do dono (join)
  owner?: {
    user_id: string;
    name?: string;
    avatar_url?: string;
  };
};

export type WalkEventType = 'pee' | 'poop' | 'interaction' | 'mood' | 'photo' | 'note';

export type WalkEvent = {
  id?: string;
  session_id?: string;
  pet_id: string;
  type: WalkEventType;
  value?: string;
  recorded_at: string;
};

export type WalkSession = {
  id?: string;
  walker_id: string;
  schedule_id?: string;
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  distance_meters?: number;
  notes?: string;
  photos?: string[];
  pet_ids: string[];
  events: WalkEvent[];
};

export type ScheduleStatus = 'proposed' | 'confirmed' | 'cancelled' | 'done';

export type WalkSchedule = {
  id: string;
  walker_id: string;
  owner_id: string;
  scheduled_at: string;
  duration_minutes: number;
  pet_ids: string[];
  status: ScheduleStatus;
  proposed_by: 'walker' | 'owner';
};

export type EarningStatus = 'received' | 'pending';

export type WalkEarning = {
  id?: string;
  session_id: string;
  walker_id: string;
  pet_id: string;
  amount: number;
  status: EarningStatus;
  notes?: string;
  recorded_at: string;
};
