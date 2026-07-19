import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../ui/Screen';
import { Card, EmptyState, Loader, SectionLabel } from '../../ui';
import { SignOutButton } from '../../ui/SignOutButton';
import { usePriceHistory } from '../../api/hooks';
import { useMenuItems } from '../../api/hooks';
import { colors, font, radius, spacing } from '../../theme';
import { Sheet } from '../../ui/Sheet';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatPrice(v: number | null): string {
  if (v == null) return '—';
  return `₹${v}`;
}

export function AdminPriceHistoryScreen() {
  const { history, loading, refetch } = usePriceHistory();
  const menu = useMenuItems();
  const [filter, setFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const menuItemNames = useMemo(() => {
    const names = new Set<string>();
    for (const h of history) names.add(h.menuItemName);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [history]);

  const filtered = useMemo(() => {
    if (!filter) return history;
    return history.filter(h => h.menuItemName === filter);
  }, [history, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const entry of filtered) {
      const date = formatDate(entry.changedAt);
      const list = map.get(date) ?? [];
      list.push(entry);
      map.set(date, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <Screen
      title="Price History"
      headerRight={<SignOutButton />}
      refreshing={loading}
      onRefresh={refetch}
    >
      <Pressable style={styles.filterBtn} onPress={() => setFilterOpen(true)}>
        <Text style={styles.filterBtnText}>
          {filter ?? 'All items'}
        </Text>
        <Text style={styles.filterChevron}>▾</Text>
      </Pressable>

      <Text style={styles.countText}>
        {filtered.length} change{filtered.length !== 1 ? 's' : ''} recorded
      </Text>

      {loading && !history.length ? (
        <Loader label="Loading price history…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No price changes"
          message="Price changes will appear here when a vendor updates a menu item's price."
        />
      ) : (
        grouped.map(([date, entries]) => (
          <View key={date}>
            <SectionLabel>{date}</SectionLabel>
            <Card padded={false}>
              {entries.map((entry, i) => (
                <View
                  key={entry.id}
                  style={[
                    styles.entryRow,
                    i > 0 && styles.entryBorder,
                  ]}
                >
                  <View style={styles.entryLeft}>
                    <Text style={styles.entryName}>{entry.menuItemName}</Text>
                    <Text style={styles.entryTime}>{formatTime(entry.changedAt)}</Text>
                  </View>
                  <View style={styles.entryRight}>
                    <Text style={[
                      styles.oldPrice,
                      entry.oldPrice != null && styles.oldPriceStrike,
                    ]}>
                      {formatPrice(entry.oldPrice)}
                    </Text>
                    <Text style={styles.arrow}>→</Text>
                    <Text style={styles.newPrice}>
                      {formatPrice(entry.newPrice)}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ))
      )}

      <Sheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter by item"
      >
        <Pressable
          style={[styles.filterItem, !filter && styles.filterItemActive]}
          onPress={() => { setFilter(null); setFilterOpen(false); }}
        >
          <Text style={[styles.filterItemText, !filter && styles.filterItemTextActive]}>
            All items
          </Text>
        </Pressable>
        {menuItemNames.map(name => (
          <Pressable
            key={name}
            style={[styles.filterItem, filter === name && styles.filterItemActive]}
            onPress={() => { setFilter(name); setFilterOpen(false); }}
          >
            <Text style={[styles.filterItemText, filter === name && styles.filterItemTextActive]}>
              {name}
            </Text>
          </Pressable>
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  filterBtnText: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600',
  },
  filterChevron: {
    color: colors.textMuted,
    fontSize: font.body,
  },
  countText: {
    color: colors.textMuted,
    fontSize: font.small,
    marginBottom: spacing.md,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  entryBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  entryLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  entryName: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600',
  },
  entryTime: {
    color: colors.textMuted,
    fontSize: font.tiny,
    marginTop: 2,
  },
  entryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  oldPrice: {
    color: colors.textFaint,
    fontSize: font.small,
  },
  oldPriceStrike: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  arrow: {
    color: colors.textMuted,
    fontSize: font.small,
  },
  newPrice: {
    color: colors.primary,
    fontSize: font.body,
    fontWeight: '700',
  },
  filterItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterItemActive: {
    backgroundColor: colors.surface,
  },
  filterItemText: {
    color: colors.text,
    fontSize: font.body,
  },
  filterItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
