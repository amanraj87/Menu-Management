import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { Badge, Button, Card, EmptyState, Input, Loader } from '../../ui';
import { Sheet } from '../../ui/Sheet';
import { SignOutButton } from '../../ui/SignOutButton';
import { useMenuItems } from '../../api/hooks';
import { gqlRequest } from '../../api/client';
import { CREATE_MENU_ITEM, DELETE_MENU_ITEM, UPDATE_MENU_ITEM } from '../../api/operations';
import { useToast } from '../../context/ToastContext';
import { colors, font, radius, spacing } from '../../theme';
import { MEAL_TYPES, type MealType, type MenuItem } from '../../types';

const UNITS = ['portion', 'piece', 'kg', 'plate', 'bowl'];

type CatalogDish = {
  name: string;
  unit: string;
  pricePerUnit?: number;
  meals: MealType[];
  items: MenuItem[];
};

export function VendorMenuScreen() {
  const toast = useToast();
  const { items, loading, refetch } = useMenuItems();

  const [formOpen, setFormOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<CatalogDish | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('portion');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const catalog: CatalogDish[] = useMemo(() => {
    const map = new Map<string, CatalogDish>();
    items.forEach(it => {
      const key = it.name.trim().toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.items.push(it);
        if (!existing.meals.includes(it.mealType)) existing.meals.push(it.mealType);
      } else {
        map.set(key, {
          name: it.name,
          unit: it.unit,
          pricePerUnit: it.pricePerUnit,
          meals: [it.mealType],
          items: [it],
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? catalog.filter(d => d.name.toLowerCase().includes(q)) : catalog;
  }, [catalog, search]);

  const unitOptions = useMemo(() => {
    const set = new Set<string>(UNITS);
    items.forEach(i => {
      if (i.unit) set.add(i.unit);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const resetForm = () => {
    setEditingDish(null);
    setName('');
    setUnit('portion');
    setPrice('');
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditDish = (dish: CatalogDish) => {
    setEditingDish(dish);
    setName(dish.name);
    setUnit(dish.unit);
    setPrice(dish.pricePerUnit != null ? String(dish.pricePerUnit) : '');
    setFormOpen(true);
  };

  const validate = (): { name: string; unit: string; price?: number } | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.show('Enter a dish name.', 'warning');
      return null;
    }
    const parsedPrice = price.trim() ? Number(price) : undefined;
    if (parsedPrice != null && isNaN(parsedPrice)) {
      toast.show('Price must be a number.', 'warning');
      return null;
    }
    return { name: trimmed, unit: unit.trim() || 'portion', price: parsedPrice };
  };

  const save = async () => {
    const v = validate();
    if (!v) return;
    setSaving(true);
    try {
      if (editingDish) {
        for (const rec of editingDish.items) {
          await gqlRequest(UPDATE_MENU_ITEM, {
            id: rec._id,
            input: { name: v.name, mealType: rec.mealType, unit: v.unit, pricePerUnit: v.price },
          });
        }
        toast.show('Dish updated.', 'success');
      } else {
        const dup = catalog.some(d => d.name.trim().toLowerCase() === v.name.toLowerCase());
        if (dup) {
          toast.show(`"${v.name}" is already on the menu.`, 'warning');
          setSaving(false);
          return;
        }
        // A dish is available for every meal.
        for (const mealType of MEAL_TYPES) {
          await gqlRequest(CREATE_MENU_ITEM, {
            input: { name: v.name, mealType, unit: v.unit, pricePerUnit: v.price },
          });
        }
        toast.show('Dish added.', 'success');
      }
      setFormOpen(false);
      resetForm();
      refetch();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeDish = (dish: CatalogDish) => {
    Alert.alert('Remove dish', `Remove "${dish.name}" from the menu?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            for (const rec of dish.items) {
              await gqlRequest(DELETE_MENU_ITEM, { id: rec._id });
            }
            toast.show('Dish removed.', 'success');
            refetch();
          } catch (e) {
            toast.show((e as Error).message, 'error');
          }
        },
      },
    ]);
  };

  return (
    <Screen
      title="Menu"
      subtitle="Your full list of dishes"
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={refetch}>
      <Button title="Add new dish" icon="＋" fullWidth onPress={openAdd} />

      {catalog.length > 0 ? (
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search dishes…"
          autoCapitalize="none"
        />
      ) : null}

      {loading && items.length === 0 ? (
        <Loader label="Loading menu…" />
      ) : catalog.length === 0 ? (
        <EmptyState
          icon="📖"
          title="Your menu is empty"
          message="Tap “Add new dish” to create your first dish."
        />
      ) : filtered.length === 0 ? (
        <Text style={styles.emptyMenu}>No dishes match “{search.trim()}”.</Text>
      ) : (
        <Card padded={false}>
          {filtered.map((dish, idx) => (
            <View key={dish.name} style={[styles.row, idx > 0 && styles.rowBorder]}>
              <View style={styles.flex1}>
                <Text style={styles.name}>{dish.name}</Text>
                <View style={styles.metaLine}>
                  <Badge label="All meals" tone="primary" />
                  <Text style={styles.meta}>
                    per {dish.unit}
                    {dish.pricePerUnit != null ? ` · ₹${dish.pricePerUnit}` : ''}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => openEditDish(dish)} hitSlop={6} style={styles.iconBtn}>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={() => removeDish(dish)}
                hitSlop={6}
                style={[styles.iconBtn, styles.deleteBtn]}>
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      {/* Add / edit dish */}
      <Sheet
        visible={formOpen}
        onClose={() => { setFormOpen(false); resetForm(); }}
        title={editingDish ? `Edit “${editingDish.name}”` : 'Add a dish'}
        maxHeightPct={80}>
        <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Grilled Chicken" />
        <Input
          label="Unit"
          value={unit}
          onChangeText={setUnit}
          placeholder="e.g. portion (type any)"
          autoCapitalize="none"
        />
        <View style={styles.unitRow}>
          {unitOptions.map(u => (
            <Pressable
              key={u}
              onPress={() => setUnit(u)}
              style={[
                styles.unitChip,
                unit.trim().toLowerCase() === u.toLowerCase() && styles.unitChipActive,
              ]}>
              <Text
                style={[
                  styles.unitChipText,
                  unit.trim().toLowerCase() === u.toLowerCase() && styles.unitChipTextActive,
                ]}>
                {u}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sheetGap} />
        <Input
          label="Price per unit (optional)"
          value={price}
          onChangeText={setPrice}
          placeholder="e.g. 120"
          keyboardType="decimal-pad"
        />
        <View style={styles.sheetGap} />
        <Button
          title={editingDish ? 'Save changes' : 'Add dish'}
          onPress={save}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  name: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  meta: { color: colors.textFaint, fontSize: font.small },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 4,
  },
  iconBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
  },
  editText: { color: colors.primary, fontSize: font.small, fontWeight: '700' },
  deleteBtn: { backgroundColor: colors.dangerSoft },
  deleteText: { color: colors.danger, fontSize: font.small, fontWeight: '700' },
  sheetGap: { height: spacing.lg },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  unitChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  unitChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  unitChipText: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  unitChipTextActive: { color: colors.primary },
  emptyMenu: {
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
