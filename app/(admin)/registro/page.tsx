import { FormularioRegistro } from '@/components/admin/formulario-registro';
import { MarcoAcceso } from '@/components/admin/marco-acceso';

export const metadata = { title: 'Registra tu negocio' };

export default function RegistroPage() {
  return (
    <MarcoAcceso
      titulo="Registra tu negocio"
      descripcion="14 días gratis, sin tarjeta. Tus clientes reservan solos desde tu link."
    >
      <FormularioRegistro />
    </MarcoAcceso>
  );
}
