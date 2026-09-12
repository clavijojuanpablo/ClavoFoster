import { FormularioRegistro } from '@/components/admin/formulario-registro';

export const metadata = { title: 'Registra tu negocio' };

export default function RegistroPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-xl font-semibold">Registra tu negocio</h1>
      <p className="mt-1 mb-8 text-sm text-neutral-600 dark:text-neutral-400">
        14 días gratis, sin tarjeta. Tus clientes reservan solos desde tu link.
      </p>

      <FormularioRegistro />
    </main>
  );
}
