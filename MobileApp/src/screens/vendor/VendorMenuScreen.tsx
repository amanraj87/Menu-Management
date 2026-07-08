import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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

  const [meal, setMeal] = useState<MealType>('breakfast');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuFormOpen, setMenuFormOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null); // per-meal single edit
  const [editingDish, setEditingDish] = useState<CatalogDish | null>(null); // full-menu dish edit
  const [name, setName] = useState('');
  const [formMeal, setFormMeal] = useState<MealType>('breakfast');
  const [unit, setUnit] = useState('portion');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [addSearch, setAddSearch] = useState('');

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
    map.forEach(d =>
      d.meals.sort(
        (a, b) => MEAL_TYPES.indexOf(a) - MEAL_TYPES.indexOf(b),
      ),
    );
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(
    () => items.filter(i => i.mealType === meal),
    [items, meal],
  );

  const menuFilteredCatalog = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return q ? catalog.filter(d => d.name.toLowerCase().includes(q)) : catalog;
  }, [catalog, menuSearch]);

  const pickable = useMemo(
    () => catalog.filter(d => !d.meals.includes(formMeal)),
    [catalog, formMeal],
  );

  const pickListFiltered = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    return q ? pickable.filter(d => d.name.toLowerCase().includes(q)) : pickable;
  }, [pickable, addSearch]);

  const unitOptions = useMemo(() => {
    const set = new Set<string>(UNITS);
    items.forEach(i => {
      if (i.unit) set.add(i.unit);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const resetForm = (m: MealType) => {
    setEditing(null);
    setEditingDish(null);
    setName('');
    setFormMeal(m);
    setUnit('portion');
    setPrice('');
  };

  const openAddForMeal = (m: MealType) => {
    resetForm(m);
    setAddSearch('');
    setSheetOpen(true);
  };

  const addDishToMeal = async (dish: CatalogDish) => {
    try {
      await gqlRequest(CREATE_MENU_ITEM, {
        input: {
          name: dish.name,
          mealType: formMeal,
          unit: dish.unit,
          pricePerUnit: dish.pricePerUnit,
        },
      });
      toast.show(`Added ${dish.name} to ${mealMeta[formMeal].label}.`, 'success');
      refetch();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    }
  };

  const openMenu = () => {
    resetForm('breakfast');
    setMenuFormOpen(false);
    setMenuSearch('');
    setMenuOpen(true);
  };

  const openAddInMenu = () => {
    resetForm('breakfast');
    setMenuFormOpen(true);
  };

  const openEditDish = (dish: CatalogDish) => {
    setEditing(null);
    setEditingDish(dish);
    setName(dish.name);
    setUnit(dish.unit);
    setPrice(dish.pricePerUnit != null ? String(dish.pricePerUnit) : '');
    setMenuFormOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingDish(null);
    setEditing(item);
    setName(item.name);
    setFormMeal(item.mealType);
    setUnit(item.unit);
    setPrice(item.pricePerUnit != null ? String(item.pricePerUnit) : '');
    setSheetOpen(true);
  };

  const validate = (): { name: string; unit: string; price?: number } | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.show('Enter an item name.', 'warning');
      return null;
    }
    const parsedPrice = price.trim() ? Number(price) : undefined;
    if (parsedPrice != null && isNaN(parsedPrice)) {
      toast.show('Price must be a number.', 'warning');
      return null;
    }
    return { name: trimmed, unit: unit.trim() || 'portion', price: parsedPrice };
  };

  // Per-meal single-record edit (from a meal tab)
  const saveInSheet = async () => {
    const v = validate();
    if (!v || !editing) return;
    setSaving(true);
    try {
      await gqlRequest(UPDATE_MENU_ITEM, {
        id: editing._id,
        input: { name: v.name, mealType: formMeal, unit: v.unit, pricePerUnit: v.price },
      });
      toast.show('Item updated.', 'success');
      setSheetOpen(false);
      refetch();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Full-menu inline form: add a new dish, or edit a dish across all its meals.
  const saveInMenu = async () => {
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
        const dup = items.some(
          i =>
            i.mealType === formMeal &&
            i.name.trim().toLowerCase() === v.name.toLowerCase(),
        );
        if (dup) {
          toast.show(`"${v.name}" is already in ${mealMeta[formMeal].label}.`, 'warning');
          setSaving(false);
          return;
        }
        await gqlRequest(CREATE_MENU_ITEM, {
          input: { name: v.name, mealType: formMeal, unit: v.unit, pricePerUnit: v.price },
        });
        toast.show(`Added to ${mealMeta[formMeal].label}.`, 'success');
      }
      setMenuFormOpen(false);
      resetForm('breakfast');
      refetch();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeDish = (dish: CatalogDish) => {
    const where = dish.meals.map(m => mealMeta[m].label).join(', ');
    Alert.alert('Remove dish', `Remove "${dish.name}" from ${where}?`, [
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

  const confirmDelete = (item: MenuItem) => {
    Alert.alert(
      'Remove item',
      `Remove "${item.name}" from ${mealMeta[item.mealType].label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
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
      ],
    );
  };

  return (
    <Screen
      title="Manage menu"
      subtitle="Reuse dishes across meals"
      headerRight={
        <View style={styles.headerBtns}>
          <Pressable onPress={openMenu} style={styles.menuBtn} hitSlop={6}>
            <Text style={styles.menuBtnText}>📖 Menu</Text>
          </Pressable>
          <SignOutButton />
        </View>
      }
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
      <Button
        title={`Add item to ${mealMeta[meal].label}`}
        icon="＋"
        fullWidth
        onPress={() => openAddForMeal(meal)}
      />

      {loading && items.length === 0 ? (
        <Loader label="Loading menu…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={mealMeta[meal].icon}
          title={`No ${mealMeta[meal].label.toLowerCase()} items`}
          message="Add one — pick a dish from your menu."
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
                onPress={() => confirmDelete(item)}
                hitSlop={6}
                style={[styles.iconBtn, styles.deleteBtn]}>
                <Text style={styles.deleteText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      {/* Edit a single item, or pick an existing dish to add to this meal */}
      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit item' : `Add to ${mealMeta[formMeal].label}`}
        maxHeightPct={editing ? 88 : 80}>
        {editing ? (
          <>
            {renderForm(true)}
            <Button
              title="Save changes"
              onPress={saveInSheet}
              loading={saving}
              fullWidth
              size="lg"
            />
          </>
        ) : catalog.length === 0 ? (
          <EmptyState
            icon="📖"
            title="Your menu is empty"
            message="Open Menu → Add new dish to create dishes first, then add them to meals here."
          />
        ) : (
          <>
            <Text style={styles.hint}>
              Pick a dish from your menu to serve in {mealMeta[formMeal].label}.
            </Text>
            <View style={styles.sheetGap} />
            <Input
              value={addSearch}
              onChangeText={setAddSearch}
              placeholder="Search dishes…"
              autoCapitalize="none"
            />
            {pickListFiltered.length === 0 ? (
              <Text style={styles.emptyMenu}>
                {addSearch.trim()
                  ? `No dishes match “${addSearch.trim()}”.`
                  : `Every dish is already in ${mealMeta[formMeal].label}.`}
              </Text>
            ) : (
              <Card padded={false}>
                {pickListFiltered.map((dish, idx) => (
                  <Pressable
                    key={dish.name}
                    onPress={() => addDishToMeal(dish)}
                    style={[styles.row, idx > 0 && styles.rowBorder]}>
                    <View style={styles.flex1}>
                      <Text style={styles.name}>{dish.name}</Text>
                      <Text style={styles.meta}>
                        per {dish.unit}
                        {dish.pricePerUnit != null ? ` · ₹${dish.pricePerUnit}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.addPlus}>＋ Add</Text>
                  </Pressable>
                ))}
              </Card>
            )}
            <View style={styles.sheetGap} />
            <Button
              title="Done"
              variant="outline"
              onPress={() => setSheetOpen(false)}
              fullWidth
            />
          </>
        )}
      </Sheet>

      {/* Full menu popup: one row per dish (meal badges), add/edit inline */}
      <Sheet
        visible={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          setMenuFormOpen(false);
        }}
        title="Full menu"
        maxHeightPct={92}>
        <View style={styles.menuHeader}>
          <Text style={styles.menuCount}>
            {catalog.length} {catalog.length === 1 ? 'dish' : 'dishes'}
          </Text>
          {!menuFormOpen ? (
            <Button title="＋ Add new dish" size="sm" onPress={openAddInMenu} />
          ) : null}
        </View>

        {catalog.length > 0 ? (
          <Input
            value={menuSearch}
            onChangeText={setMenuSearch}
            placeholder="Search dishes…"
            autoCapitalize="none"
          />
        ) : null}

        {menuFormOpen ? (
          <View style={styles.inlineForm}>
            <Text style={styles.inlineFormTitle}>
              {editingDish ? `Edit “${editingDish.name}”` : 'Add a dish'}
            </Text>
            {renderForm(!editingDish)}
            {editingDish ? (
              <Text style={styles.appliesTo}>
                Applies to: {editingDish.meals.map(m => mealMeta[m].label).join(', ')}
              </Text>
            ) : null}
            <View style={styles.formActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => {
                  setMenuFormOpen(false);
                  resetForm('breakfast');
                }}
                style={styles.flex1}
              />
              <Button
                title={editingDish ? 'Save' : 'Add dish'}
                onPress={saveInMenu}
                loading={saving}
                style={styles.flex1}
              />
            </View>
          </View>
        ) : null}

        {catalog.length === 0 ? (
          <Text style={styles.emptyMenu}>
            No dishes yet. Tap “Add new dish” to create one.
          </Text>
        ) : menuFilteredCatalog.length === 0 ? (
          <Text style={styles.emptyMenu}>No dishes match “{menuSearch.trim()}”.</Text>
        ) : (
          <Card padded={false}>
            {menuFilteredCatalog.map((dish, idx) => (
              <View key={dish.name} style={[styles.row, idx > 0 && styles.rowBorder]}>
                <View style={styles.flex1}>
                  <Text style={styles.name}>{dish.name}</Text>
                  <View style={styles.metaLine}>
                    {dish.meals.map(m => (
                      <Badge key={m} label={mealMeta[m].label} tone="primary" />
                    ))}
                    <Text style={styles.meta}>
                      per {dish.unit}
                      {dish.pricePerUnit != null ? ` · ₹${dish.pricePerUnit}` : ''}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => openEditDish(dish)}
                  hitSlop={6}
                  style={styles.iconBtn}>
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
      </Sheet>
    </Screen>
  );

  /** Shared name / (optional meal) / unit / price fields.
   *  Unit is a free text field with quick-pick chips, so any custom unit works. */
  function renderForm(showMeal: boolean) {
    return (
      <>
        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Grilled Chicken"
        />
        {showMeal ? (
          <>
            <Text style={styles.fieldLabel}>Meal</Text>
            <Segmented
              value={formMeal}
              onChange={setFormMeal}
              options={MEAL_TYPES.map(m => ({ value: m, label: mealMeta[m].label }))}
            />
            <View style={styles.sheetGap} />
          </>
        ) : null}
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
      </>
    );
  }
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  menuBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  menuBtnText: { color: colors.primary, fontSize: font.small, fontWeight: '700' },
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
  addPlus: { color: colors.primary, fontSize: font.small, fontWeight: '700' },
  deleteBtn: { backgroundColor: colors.dangerSoft },
  deleteText: { color: colors.danger, fontSize: font.small, fontWeight: '700' },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '600',
    marginBottom: 6,
  },
  sheetGap: { height: spacing.lg },
  hint: { color: colors.textFaint, fontSize: font.tiny, marginTop: spacing.sm },
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
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  menuCount: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  inlineForm: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  inlineFormTitle: {
    color: colors.text,
    fontSize: font.h3,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  appliesTo: { color: colors.textMuted, fontSize: font.tiny, marginBottom: spacing.md },
  formActions: { flexDirection: 'row', gap: spacing.md },
  emptyMenu: {
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
