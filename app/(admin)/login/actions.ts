'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

export type EstadoLogin = { error: string | null };

const esquema = z.object({
  email: z.email('Escribe un correo válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
  volver: z.string().optional(),
});

export async function iniciarSesion(
  _anterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const datos = esquema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    volver: formData.get('volver') ?? undefined,
  });

  if (!datos.success) {
    return { error: datos.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: datos.data.email,
    password: datos.data.password,
  });

  if (error) {
    // El motivo real solo se registra en desarrollo. Al usuario no se le
    // distingue entre "el correo no existe" y "la contraseña está mal":
    // decirlo permitiría averiguar qué correos están registrados.
    if (process.env.NODE_ENV === 'development') {
      console.error('[login] falló:', error.status, error.code, error.message);
    }
    return { error: 'Correo o contraseña incorrectos' };
  }

  // Solo se aceptan rutas internas: un 'volver' con URL completa permitiría
  // mandar a alguien a un sitio ajeno después de iniciar sesión.
  const volver = datos.data.volver;
  const destino = volver?.startsWith('/') && !volver.startsWith('//') ? volver : '/panel';

  redirect(destino);
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
