import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/services/api';
import type { FeedItem } from '@/types';
import { getDomainColor, getDifficultyLabel } from '@/utils/domain-colors';

type FeedStatus = 'loading' | 'ready' | 'error' | 'empty';

export default function DiscoverScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = useCallback(async () => {
    // No synchronous setState here: invoked from event handlers (refresh,
    // retry), so every state update comes after the await.
    try {
      const res = await api.discoverFeed({ count: 10 });
      setItems(res.items);
      setStatus(res.items.length > 0 ? 'ready' : 'empty');
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Something went wrong');
      setStatus('error');
    }
  }, []);

  // Mount load: fetch callbacks (sanctioned pattern for effects) rather
  // than calling an async function directly from the effect body.
  useEffect(() => {
    let cancelled = false;
    api
      .discoverFeed({ count: 10 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setStatus(res.items.length > 0 ? 'ready' : 'empty');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setErrorMessage(e instanceof ApiError ? e.message : 'Something went wrong');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }, [loadFeed]);

  const openLesson = useCallback((item: FeedItem) => {
    router.push({
      pathname: '/lesson/[topic]',
      params: { topic: item.topic, title: item.title },
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <Pressable
        onPress={() => openLesson(item)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <ThemedView type="backgroundElement" style={styles.cardInner}>
          <View style={styles.cardMeta}>
            <View style={[styles.domainChip, { backgroundColor: getDomainColor(item.domain) }]}>
              <ThemedText type="small" style={styles.chipText}>
                {item.domain}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {getDifficultyLabel(item.difficulty)} · {item.estimated_minutes} min
            </ThemedText>
          </View>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            {item.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary">{item.hook}</ThemedText>
        </ThemedView>
      </Pressable>
    ),
    [openLesson],
  );

  const header = (
    <ThemedView style={styles.header}>
      <ThemedText type="subtitle">Discover</ThemedText>
      <ThemedText themeColor="textSecondary">
        Tap a topic to generate a lesson
      </ThemedText>
    </ThemedView>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top']}>
      {status === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            Finding interesting topics…
          </ThemedText>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered}>
          <ThemedText type="subtitle" style={styles.centeredText}>
            Couldn&apos;t load the feed
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            {errorMessage}
          </ThemedText>
          <Pressable
            onPress={() => {
              setStatus('loading');
              loadFeed();
            }}
            style={({ pressed }) => [styles.retryButton, pressed && styles.cardPressed]}>
            <ThemedText type="smallBold" style={styles.retryText}>
              Retry
            </ThemedText>
          </Pressable>
        </View>
      )}

      {status === 'empty' && (
        <View style={styles.centered}>
          <ThemedText type="subtitle" style={styles.centeredText}>
            No topics right now
          </ThemedText>
          <Pressable
            onPress={() => {
              setStatus('loading');
              loadFeed();
            }}
            style={({ pressed }) => [styles.retryButton, pressed && styles.cardPressed]}>
            <ThemedText type="smallBold" style={styles.retryText}>
              Refresh
            </ThemedText>
          </Pressable>
        </View>
      )}

      {status === 'ready' && (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  centeredText: {
    textAlign: 'center',
  },
  header: {
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  listContent: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    marginBottom: Spacing.three,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardInner: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  domainChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
  },
  chipText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  retryButton: {
    marginTop: Spacing.two,
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  retryText: {
    color: '#ffffff',
  },
});
