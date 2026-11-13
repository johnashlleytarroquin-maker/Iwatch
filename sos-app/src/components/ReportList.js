import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { Empty } from '../ui';
import ReportCard from './ReportCard';
import { C } from '../theme';

// Unanswered reports first, then newest first
export const sortActive = (list) =>
  [...list].sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.id - a.id);

export default function ReportList({ data, onPress, onRefresh, loading, empty, header }) {
  return (
    <FlatList
      data={data}
      keyExtractor={(r) => String(r.id)}
      renderItem={({ item }) => <ReportCard report={item} onPress={() => onPress(item)} />}
      contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={C.blue} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={C.blue} />
          </View>
        ) : React.isValidElement(empty) ? (
          empty
        ) : (
          <Empty icon="shield-checkmark-outline" text={empty || 'No incidents reported.'} />
        )
      }
    />
  );
}
