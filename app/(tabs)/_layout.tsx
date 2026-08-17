import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; label: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', label: 'Início', icon: 'home-outline', iconActive: 'home' },
  { name: 'pets', label: 'Pets', icon: 'paw-outline', iconActive: 'paw' },
  { name: 'agenda', label: 'Agenda', icon: 'calendar-outline', iconActive: 'calendar' },
  { name: 'financeiro', label: 'Histórico', icon: 'time-outline', iconActive: 'time' },
  { name: 'perfil', label: 'Perfil', icon: 'person-outline', iconActive: 'person' },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 4,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.iconActive : tab.icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
