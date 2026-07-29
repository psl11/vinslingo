import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Marca durable de "este dispositivo ya estuvo autenticado".
 *
 * POR QUÉ EXISTE: sin red, `supabase-js` intenta refrescar el token caducado,
 * la petición falla y **borra la sesión del disco**. A partir de ahí
 * `isAuthenticated` es false y el guard te manda a la pantalla de login — donde
 * no puedes hacer nada, porque iniciar sesión también necesita red.
 *
 * Resultado: la app quedaba inservible en un avión pese a que TODOS los datos de
 * estudio son locales (SQLite). Reproducido inyectando una sesión caducada con
 * el servidor apagado: la sesión desaparece del almacenamiento y aterrizas en el
 * login.
 *
 * Esta marca la guardamos en NUESTRA clave, que supabase-js no toca, y sirve
 * para distinguir dos situaciones que de otro modo son idénticas:
 *
 *   - "no hay sesión porque nunca te has registrado"      → al login, correcto.
 *   - "no hay sesión porque estás sin red y caducó"       → déjale entrar.
 *
 * Solo se borra al cerrar sesión explícitamente.
 */
const KEY = 'vinslingo_has_authenticated';

export async function rememberAuthenticated(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ userId, at: Date.now() }));
  } catch {
    // Si el almacenamiento falla, se pierde el modo offline pero nada más.
  }
}

export async function forgetAuthenticated(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Ignorado a propósito: no debe impedir cerrar sesión.
  }
}

export async function hasAuthenticatedBefore(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) !== null;
  } catch {
    return false;
  }
}
