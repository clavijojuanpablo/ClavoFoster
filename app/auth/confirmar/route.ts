import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * Destino del enlace de confirmación de correo.
 *
 * Acepta las dos formas en que Supabase puede mandar el enlace:
 *
 *   - `?code=...` — la plantilla por defecto con flujo PKCE. Solo funciona en
 *     el mismo navegador donde se hizo el registro, porque el verificador vive
 *     en una cookie de ese navegador.
 *   - `?token_hash=...&type=...` — si la plantilla del correo se personaliza.
 *     Funciona desde cualquier dispositivo.
 *
 * Si el canje falla (enlace vencido, o abierto en el celular después de
 * registrarse en el computador), el correo igual pudo quedar confirmado: se le
 * manda a iniciar sesión con un aviso en vez de a una pantalla de error.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  const destino = request.nextUrl.clone();
  destino.search = '';

  if (ok) {
    destino.pathname = '/bienvenida';
  } else {
    destino.pathname = '/login';
    destino.searchParams.set('aviso', 'enlace');
  }

  return NextResponse.redirect(destino);
}
