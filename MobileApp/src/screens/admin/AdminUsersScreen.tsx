import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Loader,
  Segmented,
} from '../../ui';
import { Sheet } from '../../ui/Sheet';
import { SignOutButton } from '../../ui/SignOutButton';
import { useUsers } from '../../api/hooks';
import { gqlRequest } from '../../api/client';
import { CREATE_USER } from '../../api/operations';
import { useToast } from '../../context/ToastContext';
import { colors, font, spacing } from '../../theme';
import type { UserRole } from '../../types';

type Filter = 'all' | UserRole;

const roleTone = (role: UserRole) =>
  role === 'admin' ? 'danger' : role === 'vendor' ? 'info' : 'primary';

export function AdminUsersScreen() {
  const toast = useToast();
  const { users, loading, refetch } = useUsers();

  const [filter, setFilter] = useState<Filter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('person');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => (filter === 'all' ? users : users.filter(u => u.role === filter)),
    [users, filter],
  );

  const openSheet = (initialRole: UserRole) => {
    setName('');
    setEmail('');
    setRole(initialRole);
    setSheetOpen(true);
  };

  const create = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) return toast.show('Enter a name.', 'warning');
    if (!trimmedEmail) return toast.show('Enter an email.', 'warning');
    setSaving(true);
    try {
      await gqlRequest(CREATE_USER, {
        input: { name: trimmedName, email: trimmedEmail, role },
      });
      toast.show(`${trimmedName} added.`, 'success');
      setSheetOpen(false);
      refetch();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title="Users"
      subtitle={`${users.length} members`}
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={refetch}>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'person', label: 'People' },
          { value: 'vendor', label: 'Vendors' },
          { value: 'admin', label: 'Admins' },
        ]}
      />

      <View style={styles.actionRow}>
        <Button
          title="Add user"
          icon="＋"
          variant="outline"
          onPress={() => openSheet('person')}
          style={styles.flex1}
        />
        <Button
          title="Add vendor"
          icon="＋"
          variant="outline"
          onPress={() => openSheet('vendor')}
          style={styles.flex1}
        />
      </View>

      {loading && users.length === 0 ? (
        <Loader label="Loading users…" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="👥" title="No users" message="Add your first member." />
      ) : (
        <Card padded={false}>
          {filtered.map((u, idx) => (
            <View key={u._id} style={[styles.row, idx > 0 && styles.rowBorder]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {u.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.flex1}>
                <Text style={styles.name}>{u.name}</Text>
                <Text style={styles.email}>{u.email}</Text>
              </View>
              <Badge label={u.role} tone={roleTone(u.role)} />
            </View>
          ))}
        </Card>
      )}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Add member">
        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          autoCapitalize="words"
        />
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.fieldLabel}>Role</Text>
        <Segmented
          value={role}
          onChange={setRole}
          options={[
            { value: 'person', label: 'Person' },
            { value: 'vendor', label: 'Vendor' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
        <View style={styles.sheetSpacer} />
        <Button
          title="Add member"
          onPress={create}
          loading={saving}
          fullWidth
          size="lg"
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  actionRow: { flexDirection: 'row', gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontSize: font.body, fontWeight: '800' },
  name: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  email: { color: colors.textFaint, fontSize: font.small, marginTop: 2 },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '600',
    marginBottom: 6,
  },
  sheetSpacer: { height: spacing.lg },
});
