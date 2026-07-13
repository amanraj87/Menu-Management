import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { navigationRef, flushPendingNavigation } from './navigationRef';
import { useSession } from '../context/SessionContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { PersonTabs } from './PersonTabs';
import { AdminTabs } from './AdminTabs';
import { VendorTabs } from './VendorTabs';
import { Loader } from '../ui';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

export function RootNavigator() {
  const { session, hydrated } = useSession();

  if (!hydrated) {
    return (
      <View style={styles.splash}>
        <Loader />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={flushPendingNavigation}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : session.role === 'admin' ? (
          <Stack.Screen name="Admin" component={AdminTabs} />
        ) : session.role === 'vendor' ? (
          <Stack.Screen name="Vendor" component={VendorTabs} />
        ) : (
          <Stack.Screen name="Person" component={PersonTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
});
