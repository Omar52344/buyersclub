import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../components/ui/app-text';
import { Banner } from '../components/ui/banner';
import { Icon } from '../components/ui/icon';
import { IconButton } from '../components/ui/button';
import { API_URL, ApiError } from '../lib/api';
import {
  listMessages,
  markConversationRead,
  sendMessage,
  type ChatMessage,
} from '../lib/chat';
import { pickImage, uploadImage } from '../lib/files';
import { connectRealtime } from '../lib/realtime';
import { useResponsive } from '../lib/responsive';
import { colors, radius, spacing } from '../theme';

function timeLabel(value: string): string {
  return new Date(value).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : null;
  const { gutter } = useResponsive();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCount = useRef(0);

  useEffect(() => {
    if (!id) {
      return;
    }
    let active = true;

    async function load(initial: boolean) {
      try {
        const items = await listMessages(id as string);
        if (!active) {
          return;
        }
        setMessages(items);
        setError(null);
        if (items.length !== lastCount.current) {
          lastCount.current = items.length;
          await markConversationRead(id as string).catch(() => undefined);
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof ApiError ? caught.message : 'No pudimos cargar el chat.');
        }
      } finally {
        if (active && initial) {
          setLoading(false);
        }
      }
    }

    void load(true);
    const disconnect = connectRealtime((event) => {
      if (event.type === 'message.created' && event.conversationId === id) {
        void load(false);
      }
    });
    const timer = setInterval(() => {
      void load(false);
    }, 15000);

    return () => {
      active = false;
      clearInterval(timer);
      disconnect();
    };
  }, [id]);

  async function refresh() {
    if (!id) {
      return;
    }
    try {
      setMessages(await listMessages(id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos cargar el chat.');
    }
  }

  async function handleSend() {
    if (!id) {
      return;
    }
    const body = text.trim();
    if (!body) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendMessage(id, { body });
      setText('');
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos enviar el mensaje.');
    } finally {
      setSending(false);
    }
  }

  async function handleImage() {
    if (!id) {
      return;
    }
    setError(null);
    try {
      const uri = await pickImage();
      if (!uri) {
        return;
      }
      setUploading(true);
      const file = await uploadImage(uri);
      await sendMessage(id, { fileId: file.id, body: text.trim() || undefined });
      setText('');
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos enviar la imagen.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={[styles.header, { paddingHorizontal: gutter }]}>
          <View style={styles.headerInner}>
            <IconButton
              icon="arrow-back"
              label="Volver"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/orders');
                }
              }}
            />
            <View style={styles.headerText}>
              <AppText variant="h3">Chat del pedido</AppText>
              <AppText variant="caption" color={colors.muted}>
                Coordina entrega y pago con la tienda
              </AppText>
            </View>
            <View style={styles.headerSpacer} />
          </View>
        </View>

        {!id ? (
          <View style={[styles.emptyWrap, { paddingHorizontal: gutter }]}>
            <Banner
              tone="danger"
              title="Conversación no encontrada"
              message="Abre el chat desde el detalle de un pedido para ver los mensajes."
              actionLabel="Ir a mis pedidos"
              onAction={() => router.replace('/orders')}
            />
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} />
            <AppText variant="caption" color={colors.muted}>
              Cargando mensajes…
            </AppText>
          </View>
        ) : messages.length === 0 ? (
          error ? (
            <View style={[styles.emptyWrap, { paddingHorizontal: gutter }]}>
              <Banner
                tone="warning"
                title="No pudimos cargar el chat"
                message={error}
                actionLabel="Reintentar"
                onAction={() => void refresh()}
              />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Icon name="chatbubbles-outline" size={32} color={colors.brand} />
              </View>
              <AppText variant="h2" align="center">
                Empieza la conversación
              </AppText>
              <AppText variant="body" color={colors.muted} align="center" style={styles.emptyText}>
                Escríbele a la tienda para coordinar tu pedido, el pago o la entrega.
              </AppText>
            </View>
          )
        ) : (
          <FlatList
            data={[...messages].reverse()}
            inverted
            keyExtractor={(message) => message.id}
            contentContainerStyle={[styles.messages, { paddingHorizontal: gutter }]}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: message }) => (
              <View style={[styles.bubble, message.mine ? styles.bubbleMine : styles.bubbleOther]}>
                {message.fileUrl ? (
                  <Image source={{ uri: `${API_URL}${message.fileUrl}` }} style={styles.image} />
                ) : null}
                {message.body ? (
                  <AppText
                    variant="body"
                    color={message.mine ? colors.onBrand : colors.text}
                    style={styles.body}
                  >
                    {message.body}
                  </AppText>
                ) : null}
                <AppText
                  variant="caption"
                  color={message.mine ? colors.brandSoft : colors.subtle}
                  style={styles.time}
                >
                  {timeLabel(message.createdAt)}
                </AppText>
              </View>
            )}
          />
        )}

        {error && messages.length > 0 ? (
          <View style={[styles.errorWrap, { paddingHorizontal: gutter }]}>
            <Banner tone="warning" message={error} />
          </View>
        ) : null}

        {id ? (
          <View style={[styles.composerWrap, { paddingHorizontal: gutter }]}>
            <View style={styles.composer}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enviar imagen"
                disabled={uploading || sending}
                onPress={handleImage}
                style={({ pressed }) => [styles.imageButton, pressed && styles.pressed]}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <Icon name="camera-outline" size={21} color={colors.brand} />
                )}
              </Pressable>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Escribe un mensaje…"
                placeholderTextColor={colors.subtle}
                style={styles.input}
                multiline
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enviar mensaje"
                disabled={sending || !text.trim()}
                onPress={handleSend}
                style={({ pressed }) => [
                  styles.sendButton,
                  (sending || !text.trim()) && styles.sendButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.onBrand} />
                ) : (
                  <Icon name="arrow-up" size={20} color={colors.onBrand} />
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { paddingTop: 6, paddingBottom: spacing.sm, backgroundColor: colors.bg },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  headerText: { flex: 1, gap: 0 },
  headerSpacer: { width: 42 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.lg },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyText: { maxWidth: 360 },
  messages: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  bubble: {
    maxWidth: '84%',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: radius.lg,
    gap: 3,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  body: { fontSize: 15, lineHeight: 21 },
  time: { fontSize: 10, alignSelf: 'flex-end' },
  image: {
    width: 200,
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    resizeMode: 'cover',
    marginBottom: 2,
  },
  errorWrap: { maxWidth: 760, width: '100%', alignSelf: 'center', paddingBottom: 4 },
  composerWrap: {
    backgroundColor: colors.bg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 6,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  imageButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandTint,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    paddingHorizontal: 6,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
});
