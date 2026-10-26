import Feather from '@expo/vector-icons/Feather';
import { Tabs, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface TabItemConfig {
  name: string;
  title: string;
  icon: FeatherIconName;
}

const TABS: TabItemConfig[] = [
  { name: 'home', title: 'Beranda', icon: 'home' },
  { name: 'bookings', title: 'Booking', icon: 'check-square' },
  { name: 'calendar', title: 'Kalender', icon: 'calendar' },
  { name: 'clients', title: 'Pelanggan', icon: 'users' },
  { name: 'more', title: 'Lainnya', icon: 'more-horizontal' },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const bottomPadding = Math.max(insets.bottom, 10);

  return (
    <>
    <StatusBar style={segments[segments.length - 1] === 'home' ? 'light' : 'dark'} />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#203C35',
        tabBarInactiveTintColor: '#65736B',
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
        tabBarLabelPosition: 'below-icon',
        tabBarHideOnKeyboard: true,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarButtonTestID: `tab-${tab.name}`,
            tabBarIcon: ({ focused }) => (
              <View style={styles.iconContainer}>
                <Feather name={tab.icon} size={20} color={focused ? colors.ink : colors.muted} />
                {focused && <View style={styles.activeDot} />}
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    gap: 3,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ink,
  },
});
