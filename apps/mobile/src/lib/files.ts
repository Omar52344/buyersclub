import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { API_URL, ApiError } from './api';
import { loadSession } from './token-store';

export async function pickImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.7,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets[0]) {
    return null;
  }
  return result.assets[0].uri;
}

export async function uploadImage(uri: string): Promise<{ id: string; url: string }> {
  const session = await loadSession();
  if (!session) {
    throw new ApiError(401, 'NO_SESSION', 'No hay una sesión activa.');
  }

  const form = new FormData();
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    form.append('file', blob, 'imagen.jpg');
  } else {
    form.append('file', {
      uri,
      name: 'imagen.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
  }

  const response = await fetch(`${API_URL}/v1/files`, {
    method: 'POST',
    headers: { authorization: `Bearer ${session.accessToken}` },
    body: form,
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'UPLOAD_ERROR',
      body?.error?.message ?? 'No pudimos subir la imagen.',
    );
  }
  return body.file as { id: string; url: string };
}
