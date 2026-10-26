import Feather from '@expo/vector-icons/Feather';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '@/components/Brand';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { FeatureNotice, type FeatureMessage } from '@/components/FeatureNotice';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors, radii, spacing } from '@/theme/tokens';
import { useState } from 'react';
import type { Permissions } from '@/lib/auth/session';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface MenuItemProps {
  icon: FeatherIconName;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  permission?: keyof Permissions;
}

function MenuItem({ icon, label, sublabel, onPress, danger }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      accessibilityRole="button"
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Feather name={icon} size={18} color={danger ? colors.error : colors.ink} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
        {Boolean(sublabel) && <Text style={styles.menuSublabel}>{sublabel}</Text>}
      </View>
      <Feather name="chevron-right" size={16} color={colors.muted} />
    </Pressable>
  );
}

interface MenuSection {
  title?: string;
  items: MenuItemProps[];
}

export default function MoreScreen() {
  const { state } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [feature, setFeature] = useState<FeatureMessage | null>(null);
  const { logout } = useAuth();

  if (state.status !== 'authenticated') return null;
  const { session } = state;
  const isOwner = session.role === 'owner';

  async function handleLogout() {
    setLogoutBusy(true);
    setLogoutError('');
    try {
      await logout();
    } catch {
      setLogoutError('Belum berhasil keluar. Coba kembali.');
    } finally {
      setLogoutBusy(false);
    }
  }

  const menuSections: MenuSection[] = [
    {
      title: 'Operasional',
      items: [
        {
          icon: 'package',
          label: 'Paket Foto',
          sublabel: 'Katalog layanan studio',
          permission: 'booking',
          onPress: () => setFeature({ title: 'Paket foto', message: 'Katalog paket foto dan pengelolaan layanan studio segera tersedia.' }),
        },
        {
          icon: 'credit-card',
          label: 'Keuangan',
          sublabel: 'Pemasukan & pengeluaran',
          permission: 'payments',
          onPress: () => setFeature({ title: 'Keuangan', message: 'Pencatatan pembayaran, pengeluaran dan refund studio segera tersedia.' }),
        },
        {
          icon: 'bar-chart-2',
          label: 'Laporan',
          sublabel: 'Rekap & analisis omzet',
          permission: 'reports',
          onPress: () => setFeature({ title: 'Laporan', message: 'Ringkasan pemasukan dan pengeluaran per periode segera tersedia.' }),
        },
      ],
    },
    ...(isOwner
      ? [
          {
            title: 'Manajemen Studio',
            items: [
              {
                icon: 'users' as FeatherIconName,
                label: 'Kelola Staf',
                sublabel: 'Undang & atur hak akses',
                onPress: () => setFeature({ title: 'Kelola staf', message: 'Undangan staf dan pengaturan hak akses studio segera tersedia.' }),
              },
              {
                icon: 'settings' as FeatherIconName,
                label: 'Pengaturan Studio',
                sublabel: 'Jam buka, DP default, dll.',
                onPress: () => setFeature({ title: 'Pengaturan studio', message: 'Pengaturan jam operasional, kontak dan uang muka studio segera tersedia.' }),
              },
            ],
          },
        ]
      : []),
    {
      title: 'Akun',
      items: [
        {
          icon: 'user',
          label: 'Profil Saya',
          sublabel: session.displayName,
          onPress: () => setFeature({ title: 'Profil saya', message: `${session.displayName}\n${session.email}\n${session.studioName}\n${isOwner ? 'Pemilik studio' : 'Staf studio'}` }),
        },
        {
          icon: 'help-circle',
          label: 'Bantuan & FAQ',
          onPress: () => setFeature({ title: 'Bantuan & FAQ', message: 'Gunakan lima menu di bawah untuk berpindah halaman. Untuk akses studio atau perubahan akun, hubungi pemilik studio Anda.' }),
        },
        {
          icon: 'info',
          label: 'Tentang LensFlow',
          onPress: () => setFeature({ title: 'Tentang LensFlow', message: 'LensFlow membantu studio foto mengelola pelanggan, jadwal pemotretan, booking dan keuangan dalam satu tempat.\n\nVersi 1.0.0' }),
        },
      ],
    },
    {
      items: [
        {
          icon: 'log-out',
          label: 'Keluar dari Akun',
          onPress: () => setConfirmLogout(true),
          danger: true,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Brand />
        </View>

        {/* Profil singkat */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitial}>
              {session.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName}>{session.displayName}</Text>
            <Text style={styles.profileRole}>
              {isOwner ? 'Pemilik Studio' : 'Staf Studio'}
            </Text>
            <Text style={styles.profileStudio}>{session.studioName}</Text>
          </View>
        </View>

        {/* Menu Sections */}
        {menuSections.map((section) => ({ ...section, items: section.items.filter((item) => isOwner || !item.permission || session.permissions[item.permission]) }))
          .filter((section) => section.items.length > 0).map((section, sIdx) => (
          <View key={sIdx} style={styles.section}>
            {Boolean(section.title) && (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            <View style={styles.menuGroup}>
              {section.items.map((item, iIdx) => (
                <View key={iIdx}>
                  <MenuItem {...item} />
                  {iIdx < section.items.length - 1 && <View style={styles.menuDivider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.footerText}>LensFlow v1.0 · Studio tertata, momen terjaga.</Text>
      </ScrollView>

      <ConfirmationModal
        visible={confirmLogout}
        title="Keluar dari LensFlow?"
        message="Data studio tetap tersimpan. Anda dapat masuk kembali kapan saja."
        confirmLabel="Ya, keluar"
        cancelLabel="Tetap di sini"
        onConfirm={() => { void handleLogout(); }}
        onCancel={() => { if (!logoutBusy) setConfirmLogout(false); }}
        loading={logoutBusy}
        error={logoutError}
      />
      <FeatureNotice feature={feature} onClose={() => setFeature(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
    gap: spacing.xl,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },

  header: {
    marginTop: spacing.sm,
  },

  profileCard: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  profileInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  profileText: { flex: 1, gap: 2 },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  profileRole: {
    fontSize: 12,
    color: colors.muted,
  },
  profileStudio: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },

  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  menuGroup: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  menuItemPressed: {
    backgroundColor: colors.greenLight,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconDanger: {
    backgroundColor: colors.errorLight,
  },
  menuText: { flex: 1, gap: 2 },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  menuLabelDanger: {
    color: colors.error,
  },
  menuSublabel: {
    fontSize: 12,
    color: colors.muted,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginLeft: 66,
  },

  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.muted,
    paddingTop: spacing.sm,
  },
});
