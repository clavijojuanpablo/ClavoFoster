import Link from 'next/link';

import { FormularioLogin } from '@/components/admin/formulario-login';

export const metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string; aviso?: string }>;
}) {
  const { volver, aviso } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-xl font-semibold">Entrar a tu negocio</h1>
      <p className="mt-1 mb-8 text-sm text-neutral-600 dark:text-neutral-400">
        Para administrar tu agenda y tus citas.
      </p>

      {/* Viene de /auth/confirmar cuando el enlace no se pudo canjear. Lo más
          común es que el correo sí quedó confirmado pero se abrió en otro
          navegador: entrando con la contraseña sigue normal. */}
      {aviso === 'enlace' && (
        <p className="mb-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Ese enlace ya no sirve o se abrió en otro navegador. Si ya confirmaste tu correo, entra
          con tu contraseña.
        </p>
      )}

      <FormularioLogin volver={volver} />

      <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
        ¿Todavía no tienes cuenta?{' '}
        <Link href="/registro" className="underline underline-offset-2">
          Registra tu negocio
        </Link>
      </p>
    </main>
  );
}
