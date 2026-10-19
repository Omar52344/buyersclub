import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL, ApiError } from '../lib/api';
import {
  listMessages,
  markConversationRead,
  sendMessage,
  type ChatMessage,
} from '../lib/chat';
import { pickImage, uploadImage } from '../lib/files';
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No encontramos la conversación.');
      setLoading(false);
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
        await markConversationRead(id as string);
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof ApiError ? caught.message : 'No pudimos cargar el chat.',
          );
        }
      } finally {
        if (active && initial) {
          setLoading(false);
        }
      }
    }

    void load(true);
    const timer = setInterval(() => {
      void load(false);
    }, 4000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);

  async function refresh() {
    if (!id) {
      return;
    }
    setMessages(await listMessages(id));
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
      >
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.topTitle}>Chat</Text>
          <View style={styles.spacer} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.muted}>Cargando mensajes…</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.empty}>
              Aún no hay mensajes. Escríbele a la tienda para coordinar tu pedido.
            </Text>
          </View>
        ) : (
          <FlatList
            data={[...messages].reverse()}
            inverted
            keyExtractor={(message) => message.id}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: message }) => (
              <View
                style={[styles.bubble, message.mine ? styles.bubbleMine : styles.bubbleOther]}
              >
                {message.fileUrl ? (
                  <Image
                    source={{ uri: `${API_URL}${message.fileUrl}` }}
                    style={styles.image}
                  />
                ) : null}
                {message.body ? (
                  <Text style={[styles.body, message.mine && styles.bodyMine]}>
                    {message.body}
                  </Text>
                ) : null}
                <Text style={[styles.time, message.mine && styles.timeMine]}>
                  {timeLabel(message.createdAt)}
                </Text>
              </View>
            )}
          />
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.composer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar imagen"
            disabled={uploading || sending}
            onPress={handleImage}
            style={styles.imageButton}
          >
            {uploading ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <Text style={styles.imageButtonText}>📷</Text>
            )}
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje…"
            placeholderTextColor="#9AA8A4"
            style={styles.input}
            multiline
          />
          <Pressable
            accessibilityRole="button"
            disabled={sending || !text.trim()}
            onPress={handleSend}
            style={[
              styles.sendButton,
              (sending || !text.trim()) && styles.sendButtonDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.sendText}>Enviar</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: 22, color: colors.brand, fontWeight: '700' },
  topTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  spacer: { width: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  muted: { color: colors.muted, fontSize: 13 },
  messages: {
    padding: spacing.lg,
    gap: spacing.sm,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  emptyWrap: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  empty: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 20,
  },
  bubble: {
    maxWidth: '82%',
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: 4,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  bodyMine: { color: '#FFFFFF' },
  time: { color: colors.muted, fontSize: 10, alignSelf: 'flex-end' },
  timeMine: { color: '#D1FAE5' },
  image: {
    width: 190,
    height: 190,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    resizeMode: 'cover',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  imageButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  imageButtonText: { fontSize: 18 },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  sendButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  errorBox: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: 12 },
});
