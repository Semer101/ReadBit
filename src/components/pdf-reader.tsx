import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import Pdf from 'react-native-pdf';

interface Props {
  uri: string;
  page: number;
  onPageChanged: (page: number, total: number) => void;
  onLoadComplete: (total: number) => void;
}

export function PdfReader({ uri, page, onPageChanged, onLoadComplete }: Props) {
  return (
    <Pdf
      source={{ uri }}
      page={page}
      onPageChanged={onPageChanged}
      onLoadComplete={onLoadComplete}
      onError={(error) => console.log('PDF Error:', error)}
      style={styles.pdf}
      renderActivityIndicator={() => <ActivityIndicator size="large" color="#000" />}
    />
  );
}

const styles = StyleSheet.create({
  pdf: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  }
});
