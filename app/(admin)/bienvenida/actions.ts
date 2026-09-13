'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import {
  alternativasDeSlug,
  erroresPorCampo,
  esquemaAltaNegocio,
  esquemaSlug,
} from '@/lib/validation/negocio';

export type EstadoAltaNegocio = {
  error: string | null;
  campos: Record<string, string>;
  valores: Record<string, string>;
};

export type DisponibilidadSlug =
  | { estado: 'disponible' }
  | { estado: 'invalido'; mensaje: string }
  | { estado: 'tomado'; sugerencia: string | null }
  /** No se pudo revisar. La interfaz no bloquea: create_business valida al enviar. */
  | { estado: 'desconocido' };

/**
 * Revisión en vivo del link mientras el dueño lo escribe (tarea B3).
 *
 * Es solo una ayuda: entre esta respuesta y el envío otro negocio puede tomar
 * el mismo slug. La garantía la da el índice único al crear el negocio.
 */
export async function verificarSlug(slug: string): Promise<DisponibilidadSlug> {
  const formato = esquemaSlug.safeParse(slug);
  if (!formato.success) {
    return { estado: 'invalido', mensaje: formato.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: disponible, error } = await supabase.rpc('slug_disponible', {
    p_slug: formato.data,
  });

  // Sin sesión la función no se puede ejecutar y llega como error: tampoco hay
  // nada que revisar, el envío del formulario lo manda a iniciar sesión.
  if (error) return { estado: 'desconocido' };
  if (disponible) return { estado: 'disponible' };

  // Dentro de una sola acción se puede consultar en paralelo. Desde el
  // navegador no: Next despacha las Server Actions de a una.
  const candidatos = alternativasDeSlug(formato.data);
  const respuestas = await Promise.all(
    candidatos.map((c) => supabase.rpc('slug_disponible', { p_slug: c })),
  );
  const libre = candidatos.find((_, i) => respuestas[i].data === true) ?? null;

  return { estado: 'tomado', sugerencia: libre };
}

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
