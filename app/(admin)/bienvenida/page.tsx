import { redirect } from 'next/navigation';

import { FormularioAltaNegocio } from '@/components/admin/formulario-alta-negocio';
import { MarcoAcceso } from '@/components/admin/marco-acceso';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { getContextoNegocio } from '@/lib/tenant';

export const metadata = { title: 'Crea tu negocio' };

/**
 * Donde nace el negocio: el dueño ya tiene cuenta y sesión, y le falta decir
 * qué tipo de negocio es y cuál es su link.
 *
 * Se llega acá después de registrarse, al confirmar el correo, o desde
 * requireNegocio() cuando alguien con sesión todavía no tiene negocio. Si ya lo
 * tiene, no hay nada que hacer acá.
 */
export default async function BienvenidaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?volver=/bienvenida');

  if (await getContextoNegocio()) redirect('/panel');

  // Guardados al registrarse. Son solo para prellenar: el dueño los puede
  // cambiar y se vuelven a validar en el servidor al enviar.
  const metadatos = user.user_metadata as { nombre_negocio?: unknown; celular?: unknown };
  const nombre = typeof metadatos.nombre_negocio === 'string' ? metadatos.nombre_negocio : '';
  const celular = typeof metadatos.celular === 'string' ? metadatos.celular : '';

  return (
    <MarcoAcceso
      titulo="Ya casi"
      descripcion="Dos datos más y tu negocio queda creado. Todo lo demás lo puedes completar después."
    >
      <FormularioAltaNegocio
        nombreInicial={nombre}
        celularInicial={celular}
        dominio={new URL(env.NEXT_PUBLIC_APP_URL).host}
      />
    </MarcoAcceso>
  );
}
