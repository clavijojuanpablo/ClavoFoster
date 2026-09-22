import 'server-only';

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { notificar } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import type { NegocioPublico } from '@/lib/tenant';

/**
 * Identificación del cliente por su celular (tarea F4).
 *
 * El cliente final no tiene contraseña ni cuenta: se identifica con un código
 * de seis dígitos que le llega por WhatsApp. Es todo lo que necesita para
 * reservar, y es también lo que impide que alguien agende a nombre de otro.
 *
 * Los límites de acá no son paranoia: cada mensaje cuesta plata y el saldo de
 * WhatsApp es de la plataforma, no del negocio. Sin tope, cualquiera con un
 * bucle nos lo quema en una tarde.
 *
 * Ver `docs/09-notificaciones.md` y `docs/13-contratos-de-api.md`.
 */

export const VIGENCIA_MINUTOS = 10;
export const INTENTOS_MAX = 5;
export const REENVIO_SEGUNDOS = 60;
/** Envíos por número por hora. */
const ENVIOS_POR_NUMERO = 3;
/** Envíos por dirección IP por hora, que es lo que frena a un bucle. */
const ENVIOS_POR_IP = 10;
/** Cuánto vale el token que sale de verificar: lo justo para terminar de reservar. */
const TOKEN_MINUTOS = 20;

export type ResultadoEnvio =
  | { ok: true; enmascarado: string; puedeReenviarEnSegundos: number }
  | { ok: false; error: string };

export type ResultadoVerificacion =
  | { ok: true; token: string; esClienteNuevo: boolean; nombre: string | null }
  | { ok: false; error: string };

/**
 * Manda el código al celular del cliente.
 *
 * `ip` se usa solo para contar envíos. No se guarda: lo que queda en
 * `otp_codes` es el número, que ya es el dato que identifica al cliente.
 */
export async function solicitarCodigo(input: {
  negocio: NegocioPublico;
  telefono: string;
  ip: string | null;
  ahora?: Date;
}): Promise<ResultadoEnvio> {
  const { negocio, telefono, ip } = input;
  const ahora = input.ahora ?? new Date();
  const supabase = createAdminClient();

  const haceUnaHora = new Date(ahora.getTime() - 3_600_000).toISOString();
  const huellaIp = ip ? huella(ip) : null;

  // Los dos límites se cuentan sin filtrar por negocio: quien quiera quemarnos
  // el saldo puede ir rotando de barbería, y el saldo es de la plataforma.
  const [{ data: delNumero, error }, { data: deLaConexion }] = await Promise.all([
    supabase
      .from('otp_codes')
      .select('created_at')
      .eq('phone', telefono)
      .gte('created_at', haceUnaHora)
      .order('created_at', { ascending: false }),
    huellaIp
      ? supabase.from('otp_codes').select('id').eq('ip_hash', huellaIp).gte('created_at', haceUnaHora)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);

  if (error) {
    console.error('[otp] no se pudo revisar el límite:', { code: error.code, message: error.message });
    return { ok: false, error: 'No pudimos enviar el código. Intenta de nuevo.' };
  }

  // Reenvío: hay que esperar un minuto entre uno y otro.
  const ultimo = delNumero[0]?.created_at;
  if (ultimo) {
    const faltan = REENVIO_SEGUNDOS - Math.floor((ahora.getTime() - new Date(ultimo).getTime()) / 1000);
    if (faltan > 0) {
      return { ok: false, error: `Espera ${faltan} segundo${faltan === 1 ? '' : 's'} para pedir otro código` };
    }
  }

  if (delNumero.length >= ENVIOS_POR_NUMERO) {
    return { ok: false, error: 'Pediste demasiados códigos. Intenta dentro de una hora.' };
  }

  if ((deLaConexion ?? []).length >= ENVIOS_POR_IP) {
    return { ok: false, error: 'Demasiados intentos desde esta conexión. Intenta más tarde.' };
  }

  // Seis dígitos, con randomInt (criptográfico), no Math.random.
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');

  const { error: eGuardar } = await supabase.from('otp_codes').insert({
    business_id: negocio.id,
    phone: telefono,
    code_hash: huella(`${telefono}:${codigo}`),
    ip_hash: huellaIp,
    expires_at: new Date(ahora.getTime() + VIGENCIA_MINUTOS * 60_000).toISOString(),
  });

  if (eGuardar) {
    console.error('[otp] no se pudo guardar el código:', { code: eGuardar.code, message: eGuardar.message });
    return { ok: false, error: 'No pudimos enviar el código. Intenta de nuevo.' };
  }

  await notificar({
    businessId: negocio.id,
    para: telefono,
    plantilla: 'auth_otp',
    variables: [codigo, String(VIGENCIA_MINUTOS)],
  });

  return { ok: true, enmascarado: enmascarar(telefono), puedeReenviarEnSegundos: REENVIO_SEGUNDOS };
}

/**
 * Revisa el código y, si está bien, devuelve el permiso para terminar de
 * reservar.
 *
 * Solo vale el último código pedido para ese número: si alguien pidió dos, el
 * viejo deja de servir en cuanto sale el nuevo. Es lo que la gente espera y
 * evita que un código viejo siga vivo diez minutos.
 */
export async function verificarCodigo(input: {
  negocio: NegocioPublico;
  telefono: string;
  codigo: string;
  ahora?: Date;
}): Promise<ResultadoVerificacion> {
  const { negocio, telefono, codigo } = input;
  const ahora = input.ahora ?? new Date();
  const supabase = createAdminClient();

  const { data: vigente, error } = await supabase
    .from('otp_codes')
    .select('id, code_hash, attempts, expires_at')
    .eq('business_id', negocio.id)
    .eq('phone', telefono)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[otp] no se pudo leer el código:', { code: error.code, message: error.message });
    return { ok: false, error: 'No pudimos verificar el código. Intenta de nuevo.' };
  }

  if (!vigente || new Date(vigente.expires_at) <= ahora) {
    return { ok: false, error: 'Ese código venció. Pide uno nuevo.' };
  }

  if (vigente.attempts >= INTENTOS_MAX) {
    return { ok: false, error: 'Demasiados intentos. Pide un código nuevo.' };
  }

  if (!iguales(vigente.code_hash, huella(`${telefono}:${codigo}`))) {
    await supabase.from('otp_codes').update({ attempts: vigente.attempts + 1 }).eq('id', vigente.id);
    const quedan = INTENTOS_MAX - vigente.attempts - 1;

    return {
      ok: false,
      error: quedan > 0 ? `Ese código no es. Te quedan ${quedan} intento${quedan === 1 ? '' : 's'}.` : 'Demasiados intentos. Pide un código nuevo.',
    };
  }

  // Un código sirve una sola vez.
  await supabase.from('otp_codes').update({ consumed_at: ahora.toISOString() }).eq('id', vigente.id);

  // El cliente es de ESTE negocio, no global: el mismo número puede ser cliente
  // nuevo en una barbería y de toda la vida en otra. Ver docs/05.
  const { data: cliente } = await supabase
    .from('customers')
    .select('name, is_blocked')
    .eq('business_id', negocio.id)
    .eq('phone', telefono)
    .maybeSingle();

  if (cliente?.is_blocked) {
    // Sin detalles: quién está bloqueado y por qué es asunto del negocio.
    return { ok: false, error: 'No pudimos continuar con este número. Comunícate con el negocio.' };
  }

  return {
    ok: true,
    token: firmarToken({ businessId: negocio.id, telefono, vence: ahora.getTime() + TOKEN_MINUTOS * 60_000 }),
    esClienteNuevo: !cliente,
    nombre: cliente?.name ?? null,
  };
}

/** El teléfono que hay detrás de un token vigente, o null si no sirve. */
export function telefonoDelToken(token: string, businessId: string, ahora = new Date()): string | null {
  const partes = token.split('.');
  if (partes.length !== 2) return null;

  const [cuerpo, firma] = partes;
  if (!iguales(firma, huella(cuerpo))) return null;

  try {
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString()) as {
      businessId: string;
      telefono: string;
      vence: number;
    };

    if (datos.businessId !== businessId) return null;
    if (datos.vence <= ahora.getTime()) return null;

    return datos.telefono;
  } catch {
    return null;
  }
}

/**
 * El token es firmado, no guardado: no necesita tabla ni limpieza, y no se
 * puede falsificar sin la llave. Vale para un negocio, un número y veinte
 * minutos.
 */
function firmarToken(datos: { businessId: string; telefono: string; vence: number }): string {
  const cuerpo = Buffer.from(JSON.stringify(datos)).toString('base64url');

  return `${cuerpo}.${huella(cuerpo)}`;
}

/**
 * HMAC con la llave secreta de Supabase.
 *
 * Se reutiliza esa llave en vez de pedir otra variable de entorno más: ya es
 * secreta, ya vive solo en el servidor y ya es obligatoria para que la
 * aplicación arranque. Lo que se guarda en `otp_codes.code_hash` es esto,
 * nunca el código en claro.
 */
function huella(valor: string): string {
  return createHmac('sha256', serverEnv().SUPABASE_SECRET_KEY).update(valor).digest('hex');
}

/** Comparación en tiempo constante: comparar hashes con === filtra información. */
function iguales(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);

  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * '+573001234567' → '+57 300 *** 4567'.
 *
 * Lo justo para que el cliente reconozca su número sin que la pantalla lo
 * muestre entero: la página se abre en un celular, muchas veces con alguien al
 * lado.
 */
export function enmascarar(telefono: string): string {
  if (telefono.length < 8) return telefono;

  const fin = telefono.slice(-4);

  // Colombia es el caso normal y se lee mucho mejor separado por grupos.
  if (telefono.startsWith('+57') && telefono.length === 13) {
    return `+57 ${telefono.slice(3, 6)} *** ${fin}`;
  }

  return `${telefono.slice(0, -7)} *** ${fin}`;
}
