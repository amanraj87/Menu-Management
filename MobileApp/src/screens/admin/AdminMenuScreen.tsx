import React, { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { Card, EmptyState, Loader, Segmented } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { useMenuItems } from '../../api/hooks';
import { gqlRequest } from '../../api/client';
import { SET_MENU_ITEM_OFFERED } from '../../api/operations';
import { useToast } from '../../context/ToastContext';
import { colors, font, mealMeta, spacing } from '../../theme';
import { MEAL_TYPES, type MealType } from '../../types';

export function AdminMenuScreen() {
  const toast = useToast();
  const [meal, setMeal] = useState<MealType>('breakfast');
  const { items, loading, refetch } = useMenuItems();
  // Optimistic overrides so the switch flips instantly before refetch lands.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () =>
      items
        .filter(i => i.mealType === meal)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items, meal],
  );

  const isOffered = (id: string, fallback: boolean) =>
    overrides[id] ?? fallback;

  const availableCount = filtered.filter(i => isOffered(i._id, i.offered)).length;

  const toggle = async (id: string, next: boolean) => {
    setOverrides(prev => ({ ...prev, [id]: next }));
    setPending(prev => new Set(prev).add(id));
    try {
      await gqlRequest(SET_MENU_ITEM_OFFERED, { id, offered: next });
      await refetch();
    } catch (e) {
      setOverrides(prev => ({ ...prev, [id]: !next })); // revert
      toast.show((e as Error).message, 'error');
    } finally {
      setPending(prev => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  return (
    <Screen
      title="Menu"
      subtitle="Choose what users can order"
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={refetch}>
      <Segmented
        value={meal}
        onChange={setMeal}
        options={MEAL_TYPES.map(m => ({
          value: m,
          label: mealMeta[m].label,
          icon: mealMeta[m].icon,
        }))}
      />

      {loading && !items.length ? (
        <Loader label="Loading menu…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={mealMeta[meal].icon}
          title={`No ${mealMeta[meal].label.toLowerCase()} dishes`}
          message="The vendor adds dishes from their Menu page."
        />
      ) : (
        <>
          <Text style={styles.summary}>
            <Text style={styles.summaryStrong}>{availableCount}</Text> of {filtered.length} available to users
          </Text>
          <Card padded={false}>
            {filtered.map((item, idx) => {
              const offered = isOffered(item._id, item.offered);
              return (
                <View
                  key={item._id}
                  style={[styles.row, idx > 0 && styles.rowBorder]}>
                  <View style={styles.flex1}>
                    <Text style={[styles.name, !offered && styles.nameOff]}>{item.name}</Text>
                    <Text style={styles.meta}>
                      per {item.unit}
                      {item.pricePerUnit != null ? ` · ₹${item.pricePerUnit}` : ''}
                      {offered ? '' : ' · hidden'}
                    </Text>
                  </View>
                  <Switch
                    value={offered}
                    disabled={pending.has(item._id)}
                    onValueChange={v => toggle(item._id, v)}
                    trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, paddingRight: spacing.md },
  summary: { color: colors.textMuted, fontSize: font.small, marginBottom: spacing.sm },
  summaryStrong: { color: colors.primary, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  name: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  nameOff: { color: colors.textMuted },
  meta: { color: colors.textFaint, fontSize: font.small, marginTop: 2 },
});
