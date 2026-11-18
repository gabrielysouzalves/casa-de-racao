import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.logo}>🐾 Casa de Ração</Text>
        <Text style={styles.subtitle}>Gestão de atendimentos</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Pedidos</Text>
        <Text style={styles.body}>
          Aplicativo dos funcionários. A conexão com os pedidos será adicionada na próxima etapa.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f5', padding: 24, justifyContent: 'center' },
  header: { marginBottom: 28 },
  logo: { fontSize: 26, fontWeight: '700', color: '#12674f' },
  subtitle: { color: '#697b75', marginTop: 8 },
  card: { padding: 22, backgroundColor: '#fff', borderRadius: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#18342b', marginBottom: 8 },
  body: { fontSize: 15, color: '#586a63', lineHeight: 22 },
});
