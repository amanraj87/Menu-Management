/**
 * FoodOps — meal planning & ordering.
 * @format
 */

import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from './src/context/SessionContext';
import { ToastProvider } from './src/context/ToastContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        <SessionProvider>
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
