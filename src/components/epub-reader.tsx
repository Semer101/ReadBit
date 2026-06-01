import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  uri: string;
}

export function EpubReader({ uri }: Props) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/epub.js/0.3.88/epub.min.js"></script>
      <style>
        body { margin: 0; padding: 0; background: #f9fafb; font-family: sans-serif; }
        #viewer { width: 100vw; height: 100vh; }
      </style>
    </head>
    <body>
      <div id="viewer"></div>
      <script>
        var book = ePub("${uri}");
        var rendition = book.renderTo("viewer", {
          width: "100%",
          height: "100%",
          flow: "paginated",
          manager: "default"
        });
        var display = rendition.display();
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        startInLoadingState={true}
        renderLoading={() => <ActivityIndicator size="large" color="#000" style={styles.loading} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
  }
});
