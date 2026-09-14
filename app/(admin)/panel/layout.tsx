import { BarraInferior } from '@/components/admin/barra-inferior';
import { MenuLateral } from '@/components/admin/menu-lateral';
import type { DatosMenu } from '@/components/admin/tipos-menu';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { requireNegocio } from '@/lib/tenant';

/**
 * Estructura del panel: menú lateral en escritorio, barra inferior en celular.
 *
 * requireNegocio() acá solo alimenta el menú. Cada página lo vuelve a llamar
 * para sus propios datos (memorizado por petición): un layout no se re-ejecuta
 * en cada navegación, así que no puede ser la única verificación de acceso.
 */
export default async function PanelLayout({ children }: LayoutProps<'/panel'>) {
  const { negocio, rol } = await requireNegocio();

  const datos: DatosMenu = {
    negocio: { nombre: negocio.name, slug: negocio.slug, publicada: negocio.is_published },
    plan: rol === 'owner' ? await textoDelPlan() : null,
    urlPublica: `${env.NEXT_PUBLIC_APP_URL}/${negocio.slug}`,
    rol,
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <MenuLateral {...datos} />
      <div className="min-w-0 pb-32 lg:pb-0">{children}</div>
      <BarraInferior {...datos} />
    </div>
  );
}

/** El estado de la suscripción en palabras de dueño. RLS solo deja leerla al dueño. */
async function textoDelPlan(): Promise<DatosMenu['plan']> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  switch (data.status) {
    case 'trialing': {
      if (!data.trial_ends_at) return { texto: 'Prueba gratis', alerta: false };
      const dias = Math.ceil((new Date(data.trial_ends_at).getTime() - Date.now()) / 86_400_000);
      if (dias <= 0) return { texto: 'Prueba terminada', alerta: true };
      return { texto: `Prueba gratis · ${dias} ${dias === 1 ? 'día' : 'días'}`, alerta: dias <= 3 };
    }
    case 'active':
      return { texto: 'Plan activo', alerta: false };
    case 'past_due':
      return { texto: 'Pago pendiente', alerta: true };
    case 'suspended':
      return { texto: 'Suspendido', alerta: true };
    case 'cancelled':
      return { texto: 'Cancelado', alerta: true };
  }
}
