import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastState {
  message: string;
  variant: ToastVariant;
  id: number;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const variantColor: Record<ToastVariant, string> = {
  success: colors.primary,
  error: colors.danger,
  info: colors.info,
  warning: colors.warning,
};

const variantIcon: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '!',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, variant, id: Date.now() });
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    translateY.setValue(20);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();

    timer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 3200);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast, opacity, translateY]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { opacity, transform: [{ translateY }] }]}>
          <View style={styles.toast}>
            <View
              style={[
                styles.badge,
                { backgroundColor: variantColor[toast.variant] },
              ]}>
              <Text style={styles.badgeText}>{variantIcon[toast.variant]}</Text>
            </View>
            <Text style={styles.message} numberOfLines={3}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 90,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  badgeText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  message: { color: colors.text, fontSize: font.body, flexShrink: 1 },
});
