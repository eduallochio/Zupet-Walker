import { ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { ProfileBio } from '../../components/profile/ProfileBio';
import { ProfileAvailability } from '../../components/profile/ProfileAvailability';
import { ProfileServices } from '../../components/profile/ProfileServices';
import { ProfileRatings } from '../../components/profile/ProfileRatings';
import { ProfilePaymentsCard } from '../../components/profile/ProfilePaymentsCard';
import { ProfilePlanCard } from '../../components/profile/ProfilePlanCard';

export default function PerfilScreen() {
  const fetchWalkerProfile = useAuthStore((s) => s.fetchWalkerProfile);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWalkerProfile();
    setRefreshing(false);
  }, [fetchWalkerProfile]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <ProfileHeader />
        <ProfileBio />
        <ProfileAvailability />
        <ProfileServices />
        <ProfileRatings />
        <ProfilePaymentsCard />
        <ProfilePlanCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: 48, gap: 24 },
});
