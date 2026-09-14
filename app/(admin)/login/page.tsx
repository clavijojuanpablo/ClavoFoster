import Link from 'next/link';

import { FormularioLogin } from '@/components/admin/formulario-login';
import { MarcoAcceso } from '@/components/admin/marco-acceso';

export const metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string; aviso?: string }>;
}) {
  const { volver, aviso } = await searchParams;

  return (
    <MarcoAcceso titulo="Entrar a tu negocio" descripcion="Para administrar tu agenda y tus citas.">
      {/* Viene de /auth/confirmar cuando el enlace no se pudo canjear. Lo más
          común es que el correo sí quedó confirmado pero se abrió en otro
          navegador: entrando con la contraseña sigue normal. */}
      {aviso === 'enlace' && (
        <p className="rounded-xl bg-estado-espera-fondo px-4 py-3 text-sm text-estado-espera">
          Ese enlace ya no sirve o se abrió en otro navegador. Si ya confirmaste tu correo, entra con tu contraseña.
        </p>
      )}

      <FormularioLogin volver={volver} />

      <p className="text-center text-sm text-muted-foreground">
        ¿Todavía no tienes cuenta?{' '}
        <Link href="/registro" className="font-semibold text-tinta underline underline-offset-4">
          Registra tu negocio
        </Link>
      </p>
    </MarcoAcceso>
  );
}
