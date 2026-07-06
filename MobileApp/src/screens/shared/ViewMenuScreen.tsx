import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { Card, EmptyState, Loader, Segmented } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { useMenuItems } from '../../api/hooks';
import { colors, font, mealMeta, spacing } from '../../theme';
import { MEAL_TYPES, type MealType } from '../../types';

export function ViewMenuScreen() {
  const [meal, setMeal] = useState<MealType>('breakfast');
  const { items, loading, error, refetch } = useMenuItems();

  const filtered = useMemo(
    () => items.filter(i => i.mealType === meal),
    [items, meal],
  );

  return (
    <Screen
      title="Menu"
      subtitle="What's on offer"
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
      ) : error ? (
        <EmptyState icon="⚠️" title="Couldn't load menu" message={error.message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={mealMeta[meal].icon}
          title={`No ${mealMeta[meal].label.toLowerCase()} items`}
          message="The vendor hasn't added items for this meal yet."
        />
      ) : (
        <Card padded={false}>
          {filtered.map((item, idx) => (
            <View
              key={item._id}
              style={[styles.row, idx > 0 && styles.rowBorder]}>
              <View style={styles.flex1}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.unit}>Per {item.unit}</Text>
              </View>
              {item.pricePerUnit != null ? (
                <Text style={styles.price}>₹{item.pricePerUnit}</Text>
              ) : (
                <Text style={styles.noPrice}>—</Text>
              )}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  name: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  unit: { color: colors.textFaint, fontSize: font.small, marginTop: 2 },
  price: { color: colors.primary, fontSize: font.body, fontWeight: '700' },
  noPrice: { color: colors.textFaint, fontSize: font.body },
});
