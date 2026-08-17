import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haversineMeters } from '../services/locationService';
import type { WalkSession, WalkEvent, WalkEventType } from '../types/walker';

type Coord = { lat: number; lon: number };

type WalkStore = {
  activeWalk: WalkSession | null;
  locationPoints: Coord[];
  startWalk: (walkerId: string, petIds: string[], scheduleId?: string) => void;
  endWalk: () => void;
  addEvent: (petId: string, type: WalkEventType, value?: string) => void;
  addPhoto: (url: string) => void;
  setNotes: (notes: string) => void;
  addLocationPoint: (lat: number, lon: number) => void;
};

export const useWalkStore = create<WalkStore>()(
  persist(
    (set, get) => ({
      activeWalk: null,
      locationPoints: [],

      startWalk: (walkerId, petIds, scheduleId) => {
        set({
          locationPoints: [],
          activeWalk: {
            walker_id:       walkerId,
            schedule_id:     scheduleId,
            started_at:      new Date().toISOString(),
            pet_ids:         petIds,
            events:          [],
            distance_meters: 0,
          },
        });
      },

      endWalk: () => set({ activeWalk: null, locationPoints: [] }),

      addEvent: (petId, type, value) => {
        const walk = get().activeWalk;
        if (!walk) return;
        const event: WalkEvent = {
          pet_id:      petId,
          type,
          value,
          recorded_at: new Date().toISOString(),
        };
        set({ activeWalk: { ...walk, events: [...walk.events, event] } });
      },

      addPhoto: (url) => {
        const walk = get().activeWalk;
        if (!walk) return;
        set({ activeWalk: { ...walk, photos: [...(walk.photos ?? []), url] } });
      },

      setNotes: (notes) => {
        const walk = get().activeWalk;
        if (!walk) return;
        set({ activeWalk: { ...walk, notes } });
      },

      addLocationPoint: (lat, lon) => {
        const points = get().locationPoints;
        const walk   = get().activeWalk;
        if (!walk) return;

        let addedMeters = 0;
        if (points.length > 0) {
          const last = points[points.length - 1];
          addedMeters = haversineMeters(last.lat, last.lon, lat, lon);
          // Ignora pontos com salto > 200m (GPS errado)
          if (addedMeters > 200) return;
        }

        const newPoints = [...points, { lat, lon }];
        const totalDistance = (walk.distance_meters ?? 0) + addedMeters;

        set({
          locationPoints: newPoints,
          activeWalk: { ...walk, distance_meters: totalDistance },
        });
      },
    }),
    {
      name: 'zupet-walker-active-walk',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
