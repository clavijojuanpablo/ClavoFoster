'use server';

import { redirect } from 'next/navigation';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { erroresPorCampo, esquemaRegistro } from '@/lib/validation/negocio';

export type EstadoRegistro = {
  error: string | null;
  campos: Record<string, string>;
  /** Si Supabase exige confirmar el correo, a dónde se mandó el enlace. */
  enviadoA: string | null;
  /** Lo que escribió, para devolverlo al formulario. Nunca la contraseña. */
  valores: Record<string, string>;
};

/**
 * Paso 1 del flujo 6 (docs/02-usuarios-y-flujos.md): crear la cuenta del dueño.
 *
 * El negocio NO se crea acá. Si el proyecto de Supabase exige confirmar el
 * correo, en este punto todavía no hay sesión, y create_business() necesita
 * auth.uid(). Por eso el nombre del negocio y el celular viajan en los
 * metadatos del usuario y se usan para prellenar /bienvenida, donde el negocio
 * nace de verdad.
 *
 * Funciona con la confirmación de correo encendida o apagada: si Supabase
 * devuelve sesión, se sigue directo; si no, se le pide revisar el correo.
 */
export async function registrarse(
  _anterior: EstadoRegistro,
  formData: FormData,
): Promise<EstadoRegistro> {
  const valores = {
    email: String(formData.get('email') ?? ''),
    nombreNegocio: String(formData.get('nombreNegocio') ?? ''),
    celular: String(formData.get('celular') ?? ''),
  };

  const datos = esquemaRegistro.safeParse({ ...valores, password: formData.get('password') });

  if (!datos.success) {
    return { error: null, campos: erroresPorCampo(datos.error), enviadoA: null, valores };
  }

  const { email, password, nombreNegocio, celular } = datos.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirmar`,
      data: { nombre_negocio: nombreNegocio, celular },
    },
  });

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[registro] falló:', error.status, error.code, error.message);
    }
    return { enviadoA: null, valores, ...mensajeDeError(error.code) };
  }

  if (data.session) {
    redirect('/bienvenida');
  }

  // Sin sesión: hay que confirmar el correo. Supabase responde igual cuando el
  // correo ya estaba registrado (sin mandar nada), para no revelar qué correos
  // existen. Se le muestra lo mismo en ambos casos.
  return { error: null, campos: {}, enviadoA: email, valores };
}

function mensajeDeError(codigo: string | undefined): Pick<EstadoRegistro, 'error' | 'campos'> {
  switch (codigo) {
    case 'user_already_exists':
    case 'email_exists':
      return {
        error: null,
        campos: { email: 'Ya hay una cuenta con este correo. Entra con tu contraseña' },
      };
    case 'weak_password':
      return {
        error: null,
        campos: { password: 'Esa contraseña es muy fácil de adivinar. Prueba con otra' },
      };
    case 'email_address_invalid':
      return { error: null, campos: { email: 'No podemos enviar correos a esa dirección' } };
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return {
        error: 'Hubo demasiados intentos seguidos. Espera unos minutos y vuelve a intentar',
        campos: {},
      };
    case 'signup_disabled':
      return { error: 'El registro de negocios está cerrado por ahora', campos: {} };
    default:
      return { error: 'No pudimos crear la cuenta. Intenta de nuevo en un momento', campos: {} };
  }
}
