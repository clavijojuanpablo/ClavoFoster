import { NextResponse, type NextRequest } from 'next/server';

import { refrescarSesion } from '@/lib/supabase/proxy';

/**
 * proxy.ts — en Next.js 16 reemplaza a middleware.ts.
 *
 * Hace DOS cosas, y ninguna más:
 *
 *   1. Refresca la sesión de Supabase en cada petición.
 *   2. Un chequeo OPTIMISTA: si alguien va al panel sin sesión, lo manda a
 *      iniciar sesión.
 *
 * "Optimista" significa que solo mira si hay sesión, no qué permisos tiene.
 * La autorización de verdad la hacen las políticas de RLS en la base de datos
 * y las funciones de lib/tenant.ts.
 *
 * Esa separación no es un detalle de estilo: el proxy corre también en rutas
 * que el navegador precarga, así que meterle consultas de permisos lo
 * convertiría en un cuello de botella. Y si alguna vez se saltara, RLS
 * seguiría protegiendo los datos.
 */

const RUTAS_PRIVADAS = ['/panel'];

export async function proxy(request: NextRequest) {
  const { response, user } = await refrescarSesion(request);
  const ruta = request.nextUrl.pathname;

  const esPrivada = RUTAS_PRIVADAS.some((r) => ruta === r || ruta.startsWith(`${r}/`));

  if (esPrivada && !user) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/login';
    // Para devolverlo a donde iba después de entrar.
    destino.searchParams.set('volver', ruta);
    return NextResponse.redirect(destino);
  }

  // Con sesión activa no tiene sentido quedarse en el formulario de ingreso.
  if (ruta === '/login' && user) {
    const destino = request.nextUrl.clone();
    destino.pathname = '/panel';
    destino.search = '';
    return NextResponse.redirect(destino);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todo menos archivos estáticos e imágenes. Si el proxy corriera sobre
     * cada icono y cada hoja de estilos, se pagaría una llamada de refresco de
     * sesión por recurso.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
