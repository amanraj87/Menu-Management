import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Loader,
  Segmented,
} from '../../ui';
import { Sheet } from '../../ui/Sheet';
import { SignOutButton } from '../../ui/SignOutButton';
import { useMenuItems } from '../../api/hooks';
import { gqlRequest } from '../../api/client';
import {
  CREATE_MENU_ITEM,
  DELETE_MENU_ITEM,
  UPDATE_MENU_ITEM,
} from '../../api/operations';
import { useToast } from '../../context/ToastContext';
import { colors, font, mealMeta, radius, spacing } from '../../theme';
import { MEAL_TYPES, type MealType, type MenuItem } from '../../types';

const UNITS = ['portion', 'piece', 'kg', 'plate', 'bowl'];

export function VendorMenuScreen() {
  const toast = useToast();
  const { items, loading, refetch } = useMenuItems();
  const [meal, setMeal] = useState<MealType>('breakfast');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [name, setName] = useState('');
  const [formMeal, setFormMeal] = useState<MealType>('breakfast');
  const [unit, setUnit] = useState('portion');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => items.filter(i => i.mealType === meal),
    [items, meal],
  );

  const openAdd = () => {
    setEditing(null);
    setName('');
    setFormMeal(meal);
    setUnit('portion');
    setPrice('');
    setSheetOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setName(item.name);
    setFormMeal(item.mealType);
    setUnit(item.unit);
    setPrice(item.pricePerUnit != null ? String(item.pricePerUnit) : '');
    setSheetOpen(true);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return toast.show('Enter an item name.', 'warning');
    const parsedPrice = price.trim() ? Number(price) : undefined;
    if (parsedPrice != null && isNaN(parsedPrice))
      return toast.show('Price must be a number.', 'warning');

    setSaving(true);
    try {
      if (editing) {
        await gqlRequest(UPDATE_MENU_ITEM, {
          id: editing._id,
          input: {
            name: trimmed,
            mealType: formMeal,
            unit,
            pricePerUnit: parsedPrice,
          },
        });
        toast.show('Item updated.', 'success');
      } else {
        await gqlRequest(CREATE_MENU_ITEM, {
          input: {
            name: trimmed,
            mealType: formMeal,
            unit,
            pricePerUnit: parsedPrice,
          },
        });
        toast.show('Item added.', 'success');
      }
      setSheetOpen(false);
      refetch();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item: MenuItem) => {
    Alert.alert('Delete item', `Remove "${item.name}" from the menu?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await gqlRequest(DELETE_MENU_ITEM, { id: item._id });
            toast.show('Item removed.', 'success');
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
      title="Manage menu"
      subtitle="Add, edit, and remove items"
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

      <Button title="Add item" icon="＋" fullWidth onPress={openAdd} />

      {loading && items.length === 0 ? (
        <Loader label="Loading menu…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={mealMeta[meal].icon}
          title={`No ${mealMeta[meal].label.toLowerCase()} items`}
          message="Tap “Add item” to create your first one."
        />
      ) : (
        <Card padded={false}>
          {filtered.map((item, idx) => (
            <View key={item._id} style={[styles.row, idx > 0 && styles.rowBorder]}>
              <View style={styles.flex1}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  per {item.unit}
                  {item.pricePerUnit != null ? ` · ₹${item.pricePerUnit}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => openEdit(item)}
                hitSlop={6}
                style={styles.iconBtn}>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(item)}
                hitSlop={6}
                style={[styles.iconBtn, styles.deleteBtn]}>
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit item' : 'Add item'}>
        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Grilled Chicken"
        />
        <Text style={styles.fieldLabel}>Meal</Text>
        <Segmented
          value={formMeal}
          onChange={setFormMeal}
          options={MEAL_TYPES.map(m => ({
            value: m,
            label: mealMeta[m].label,
          }))}
        />
        <View style={styles.sheetGap} />
        <Text style={styles.fieldLabel}>Unit</Text>
        <View style={styles.unitRow}>
          {UNITS.map(u => (
            <Pressable
              key={u}
              onPress={() => setUnit(u)}
              style={[styles.unitChip, unit === u && styles.unitChipActive]}>
              <Text
                style={[
                  styles.unitChipText,
                  unit === u && styles.unitChipTextActive,
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
          keyboardType="numeric"
        />
        <View style={styles.sheetGap} />
        <Button
          title={editing ? 'Save changes' : 'Add item'}
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
  meta: { color: colors.textFaint, fontSize: font.small, marginTop: 2 },
  iconBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
  },
  editText: { color: colors.primary, fontSize: font.small, fontWeight: '700' },
  deleteBtn: { backgroundColor: colors.dangerSoft },
  deleteText: { color: colors.danger, fontSize: font.small, fontWeight: '700' },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '600',
    marginBottom: 6,
  },
  sheetGap: { height: spacing.lg },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  unitChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  unitChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  unitChipText: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  unitChipTextActive: { color: colors.primary },
});
