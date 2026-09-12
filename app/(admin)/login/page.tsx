import { FormularioLogin } from '@/components/admin/formulario-login';

export const metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-xl font-semibold">Entrar a tu negocio</h1>
      <p className="mt-1 mb-8 text-sm text-neutral-600 dark:text-neutral-400">
        Para administrar tu agenda y tus citas.
      </p>

      <FormularioLogin volver={volver} />
    </main>
  );
}
