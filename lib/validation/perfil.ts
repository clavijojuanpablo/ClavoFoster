import { z } from 'zod';

import { CATEGORIAS, type Categoria } from '@/lib/validation/negocio';
import { normalizarCelular } from '@/lib/validation/telefono';

/**
 * Validación del perfil del negocio (tarea B4).
 *
 * Igual que en el alta, la base repite lo importante: coordenadas completas,
 * zona horaria real y máximo de fotos
 * (supabase/migrations/20260912140001_perfil_del_negocio.sql).
 */

export const ZONA_HORARIA_POR_DEFECTO = 'America/Bogota';
export const MAX_FOTOS = 10;

/** Nombre de archivo que genera la subida: `<uuid>.jpg`. */
const ARCHIVO_FOTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

export function esZonaHorariaValida(zona: string): boolean {
  try {
    new Intl.DateTimeFormat('es-CO', { timeZone: zona });
    return true;
  } catch {
    // Intl lanza RangeError con una zona que no conoce: eso ES la respuesta.
    return false;
  }
}

/** Texto opcional: vacío se guarda como null, no como ''. */
const textoOpcional = (max: number, mensaje: string) =>
  z
    .string()
    .trim()
    .max(max, mensaje)
    .transform((v) => (v === '' ? null : v));

/** Número opcional que llega como texto desde un input oculto. */
const coordenada = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: 'La ubicación no es válida. Vuelve a marcarla en el mapa' });
        return z.NEVER;
      }
      // numeric(10,7) en la base: más decimales que eso son ruido del GPS.
      return Math.round(n * 1e7) / 1e7;
    });

/**
 * Construye el esquema para un negocio concreto: las fotos solo pueden estar en
 * la carpeta de ESE negocio. El businessId viene de la sesión, nunca del
 * formulario.
 */
export function esquemaPerfil(businessId: string) {
  const prefijo = `${businessId}/`;

  return z
    .object({
      nombreNegocio: z
        .string()
        .trim()
        .min(2, 'Escribe el nombre del negocio')
        .max(80, 'El nombre puede tener hasta 80 caracteres'),
      categoria: z.enum(
        CATEGORIAS.map((c) => c.valor) as [Categoria, ...Categoria[]],
        'Escoge el tipo de negocio',
      ),
      celular: z.string().transform((valor, ctx) => {
        const normalizado = normalizarCelular(valor);
        if (!normalizado) {
          ctx.addIssue({ code: 'custom', message: 'Escribe un celular válido, por ejemplo 300 123 4567' });
          return z.NEVER;
        }
        return normalizado;
      }),
      // Checkbox: el navegador manda 'on' si está marcado y nada si no.
      publicada: z
        .string()
        .optional()
        .transform((v) => v === 'on'),
      direccion: textoOpcional(200, 'La dirección puede tener hasta 200 caracteres'),
      ciudad: textoOpcional(80, 'La ciudad puede tener hasta 80 caracteres'),
      latitud: coordenada(-90, 90),
      longitud: coordenada(-180, 180),
      zonaHoraria: z
        .string()
        .trim()
        .refine(esZonaHorariaValida, 'Escoge una zona horaria de la lista'),
      fotos: z
        .string()
        .transform((v, ctx) => {
          try {
            const lista: unknown = JSON.parse(v || '[]');
            if (Array.isArray(lista)) return lista;
          } catch {
            // Cae al error de abajo: un JSON roto es una lista inválida.
          }
          ctx.addIssue({ code: 'custom', message: 'No pudimos leer la lista de fotos. Recarga la página' });
          return z.NEVER;
        })
        .pipe(
          z
            .array(
              z
                .string()
                .refine(
                  (ruta) => ruta.startsWith(prefijo) && ARCHIVO_FOTO.test(ruta.slice(prefijo.length)),
                  'Una de las fotos no pertenece a este negocio',
                ),
            )
            .max(MAX_FOTOS, `Puedes tener hasta ${MAX_FOTOS} fotos`),
        ),
    })
    .refine((d) => (d.latitud === null) === (d.longitud === null), {
      message: 'La ubicación quedó incompleta. Vuelve a marcarla en el mapa',
      path: ['latitud'],
    });
}

/** Zonas que se ofrecen en el selector: las de América, más la de España. */
export function zonasHorariasDisponibles(): string[] {
  const todas = Intl.supportedValuesOf('timeZone');
  const zonas = todas.filter((z) => z.startsWith('America/') || z === 'Europe/Madrid');
  // Algunos entornos no listan la zona por defecto con su nombre canónico.
  return zonas.includes(ZONA_HORARIA_POR_DEFECTO) ? zonas : [ZONA_HORARIA_POR_DEFECTO, ...zonas];
}
