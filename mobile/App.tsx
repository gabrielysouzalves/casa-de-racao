import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

type OrderStatus = 'AGUARDANDO' | 'EM_ATENDIMENTO' | 'CONCLUIDO' | 'CANCELADO';
type OrderType = 'PRESENCIAL' | 'ENTREGA';

type Order = {
  id: string;
  type: OrderType;
  status: OrderStatus;
  createdAt: string;
};

type ApiResult = {
  error?: string;
  token?: string;
  user?: { name: string; mustChange: boolean };
  orders?: Order[];
};

const labels: Record<OrderStatus, string> = {
  AGUARDANDO: 'Aguardando',
  EM_ATENDIMENTO: 'Em atendimento',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.secondaryButton, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{title}</Text>
    </Pressable>
  );
}

export default function App() {
  const [server, setServer] = useState('http://192.168.100.143:3000');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const base = server.trim().replace(/\/$/, '');

  const request = useCallback(async (
    path: string,
    method: 'GET' | 'POST' | 'PATCH',
    payload?: object,
    authToken?: string
  ): Promise<ApiResult> => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const result = (await response.json()) as ApiResult;
    if (!response.ok) {
      if (response.status === 401 && authToken) {
        setToken('');
        setOrders([]);
      }
      throw new Error(result.error || 'Não foi possível completar a solicitação.');
    }
    return result;
  }, [base]);

  const loadOrders = useCallback(async (activeToken: string) => {
    setLoading(true);
    try {
      const result = await request('/api/orders', 'GET', undefined, activeToken);
      setOrders(result.orders ?? []);
    } catch (error) {
      Alert.alert('Pedidos', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (token) void loadOrders(token);
  }, [token, loadOrders]);

  async function login() {
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      Alert.alert('Endereço inválido', 'Informe o endereço do servidor com http:// ou https://.');
      return;
    }
    if (!username.trim() || !password) {
      Alert.alert('Login', 'Informe o usuário e a senha.');
      return;
    }
    setBusy(true);
    try {
      const result = await request('/api/auth', 'POST', {
        action: 'mobileLogin',
        username: username.trim().toLowerCase(),
        password,
      });
      if (!result.token || !result.user) throw new Error('A sessão não foi criada.');
      if (result.user.mustChange) {
        throw new Error('Troque sua senha pelo sistema web antes de acessar o aplicativo.');
      }
      setName(result.user.name);
      setPassword('');
      setToken(result.token);
    } catch (error) {
      Alert.alert('Não foi possível entrar', (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function updateOrder(method: 'POST' | 'PATCH', payload: object) {
    setBusy(true);
    try {
      await request('/api/orders', method, payload, token);
      await loadOrders(token);
    } catch (error) {
      Alert.alert('Pedido', (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await request('/api/auth', 'POST', { action: 'logout' }, token);
    } catch {
      // Encerra o acesso local mesmo sem resposta do servidor.
    } finally {
      setToken('');
      setName('');
      setOrders([]);
      setBusy(false);
    }
  }

  const pending = [...orders]
    .filter((order) => order.status === 'AGUARDANDO')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const attending = orders.filter((order) => order.status === 'EM_ATENDIMENTO');
  const history = [...orders]
    .filter((order) => order.status === 'CONCLUIDO' || order.status === 'CANCELADO')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 15);

  function renderOrder(order: Order) {
    return (
      <View key={order.id} style={styles.order}>
        <View style={styles.row}>
          <Text style={styles.orderTitle}>{order.type === 'ENTREGA' ? 'Entrega' : 'Presencial'} · {order.id.slice(0, 8)}</Text>
          <Text style={styles.badge}>{labels[order.status]}</Text>
        </View>
        <Text style={styles.detail}>{formatDate(order.createdAt)}</Text>
        <View style={styles.actions}>
          {order.status === 'AGUARDANDO' && (
            <Button title="Iniciar" disabled={busy} onPress={() => void updateOrder('PATCH', { id: order.id, status: 'EM_ATENDIMENTO' })} />
          )}
          {order.status === 'EM_ATENDIMENTO' && (
            <Button title="Concluir" disabled={busy} onPress={() => void updateOrder('PATCH', { id: order.id, status: 'CONCLUIDO' })} />
          )}
          {(order.status === 'AGUARDANDO' || order.status === 'EM_ATENDIMENTO') && (
            <Button title="Cancelar" secondary disabled={busy} onPress={() =>
              Alert.alert('Cancelar pedido', 'Deseja cancelar este atendimento?', [
                { text: 'Voltar', style: 'cancel' },
                { text: 'Cancelar pedido', style: 'destructive', onPress: () => void updateOrder('PATCH', { id: order.id, status: 'CANCELADO' }) },
              ])
            } />
          )}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>🐾 Casa de Ração</Text>
          <Text style={styles.subtitle}>Gestão de atendimentos</Text>

          {!token ? (
            <View style={styles.card}>
              <Text style={styles.heading}>Entrar</Text>
              <Text style={styles.detail}>Use o mesmo usuário do sistema web.</Text>
              <Text style={styles.label}>Servidor</Text>
              <TextInput style={styles.input} value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="http://IP-do-computador:3000" />
              <Text style={styles.label}>Usuário</Text>
              <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="Usuário" />
              <Text style={styles.label}>Senha</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Senha" />
              <Button title={busy ? 'Entrando...' : 'Entrar'} disabled={busy} onPress={() => void login()} />
              <Text style={styles.hint}>Celular e computador precisam estar na mesma rede. Use esta conexão HTTP somente para testes locais.</Text>
            </View>
          ) : (
            <>
              <View style={[styles.card, styles.row]}>
                <View>
                  <Text style={styles.heading}>Olá, {name}</Text>
                  <Text style={styles.detail}>Acompanhe os pedidos da loja.</Text>
                </View>
                <Button title="Sair" secondary disabled={busy} onPress={() => void logout()} />
              </View>

              <View style={styles.card}>
                <Text style={styles.heading}>Novo pedido</Text>
                <View style={styles.actions}>
                  <Button title="Presencial" disabled={busy} onPress={() => void updateOrder('POST', { type: 'PRESENCIAL' })} />
                  <Button title="Entrega" secondary disabled={busy} onPress={() => void updateOrder('POST', { type: 'ENTREGA' })} />
                </View>
              </View>
              <View style={styles.row}>
                <Text style={styles.heading}>Fila de pedidos</Text>
                <Button title="Atualizar" secondary disabled={loading || busy} onPress={() => void loadOrders(token)} />
              </View>
              {loading && <ActivityIndicator color="#12674f" />}
              <Text style={styles.section}>Aguardando ({pending.length})</Text>
              {pending.length ? pending.map(renderOrder) : <Text style={styles.detail}>Nenhum pedido aguardando.</Text>}
              <Text style={styles.section}>Em atendimento ({attending.length})</Text>
              {attending.length ? attending.map(renderOrder) : <Text style={styles.detail}>Nenhum pedido em atendimento.</Text>}
              <Text style={styles.section}>Histórico recente</Text>
              {history.length ? history.map(renderOrder) : <Text style={styles.detail}>Nenhum pedido finalizado.</Text>}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#f4f7f5' },
  content: { padding: 22, paddingTop: 42, paddingBottom: 70 },
  logo: { color: '#12674f', fontWeight: '700', fontSize: 27 },
  subtitle: { color: '#64766f', marginTop: 5, marginBottom: 28 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 15, marginBottom: 18 },
  heading: { color: '#18342b', fontSize: 19, fontWeight: '700', marginBottom: 5 },
  detail: { color: '#66776f', fontSize: 13, marginBottom: 7 },
  label: { color: '#18342b', fontWeight: '600', marginTop: 13, marginBottom: 5 },
  input: { backgroundColor: '#f4f7f5', borderColor: '#dce6e0', borderWidth: 1, padding: 13, borderRadius: 8, fontSize: 15 },
  button: { backgroundColor: '#12674f', paddingVertical: 12, paddingHorizontal: 17, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryButton: { backgroundColor: '#e5f2ed' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  secondaryButtonText: { color: '#12674f' },
  hint: { color: '#74827b', fontSize: 12, lineHeight: 18, marginTop: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  order: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 10 },
  orderTitle: { color: '#173f33', fontSize: 14, fontWeight: '700' },
  badge: { backgroundColor: '#e5f2ed', color: '#12674f', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, fontSize: 11 },
  section: { color: '#12674f', fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10 },
});
