'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { erroresPorCampo, esquemaAltaNegocio } from '@/lib/validation/negocio';

export type EstadoAltaNegocio = {
  error: string | null;
  campos: Record<string, string>;
  valores: Record<string, string>;
};

/**
 * Crea el negocio del usuario autenticado.
 *
 * El dueño no se recibe del formulario: create_business() usa auth.uid(). Lo
 * único que llega del navegador son datos del negocio, y ninguno es un
 * identificador. Ver regla 2 de CLAUDE.md.
 */
export async function crearNegocio(
  _anterior: EstadoAltaNegocio,
  formData: FormData,
): Promise<EstadoAltaNegocio> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?volver=/bienvenida');

  const valores = {
    nombreNegocio: String(formData.get('nombreNegocio') ?? ''),
    celular: String(formData.get('celular') ?? ''),
    categoria: String(formData.get('categoria') ?? ''),
    slug: String(formData.get('slug') ?? ''),
  };

  const datos = esquemaAltaNegocio.safeParse(valores);

  if (!datos.success) {
    return { error: null, campos: erroresPorCampo(datos.error), valores };
  }

  const { error } = await supabase.rpc('create_business', {
    p_name: datos.data.nombreNegocio,
    p_slug: datos.data.slug,
    p_category: datos.data.categoria,
    p_phone: datos.data.celular,
  });

  if (error) {
    // Los casos esperados llevan un HINT fijo desde la base (migración
    // 20260912120001). Se reconocen por ahí, no por el texto del mensaje.
    switch (error.hint) {
      case 'slug_tomado':
        return {
          error: null,
          campos: { slug: 'Ese link ya lo tiene otro negocio. Prueba con otro' },
          valores,
        };
      case 'ya_tiene_negocio':
        redirect('/panel');
      case 'sin_sesion':
        redirect('/login?volver=/bienvenida');
    }

    console.error('[alta de negocio] falló:', error.code, error.message);
    return { error: 'No pudimos crear el negocio. Intenta de nuevo en un momento', campos: {}, valores };
  }

  redirect('/panel');
}
