import { StyleSheet, Text, View } from 'react-native';

// Version web (aperçu de design uniquement) : la WebView native n'existe pas
// dans un navigateur. Le lecteur réel est fourni par YoutubePlayer.js.
export default function YoutubePlayer({ style }) {
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.label}>Lecteur YouTube</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  label: {
    color: '#646C78',
    fontSize: 12,
    letterSpacing: 1,
  },
});
