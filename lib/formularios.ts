import { startTransition, type FormEvent } from 'react';

type Accion = (datos: FormData) => void;

/**
 * Manejador de envío para los formularios del panel que usan useActionState.
 *
 * Por qué no `<form action={accion}>`: React 19 reinicia el formulario cuando
 * la acción termina, también cuando devuelve errores de validación. Los radios y
 * checkboxes vuelven en pantalla a su valor inicial aunque el estado de React
 * diga otra cosa, y el siguiente envío manda lo que se ve, no lo que el dueño
 * escogió (se guardaba otro color, otra categoría, la página publicada u
 * oculta). Con onSubmit no hay reinicio.
 *
 * Un botón con `data-accion="clave"` dispara `otras[clave]` en vez de la
 * principal (por ejemplo, Desactivar dentro del formulario de edición).
 */
export function enviarSinReiniciar(principal: Accion, otras: Record<string, Accion> = {}) {
  return (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const boton = (evento.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const clave = boton?.dataset.accion;
    const accion = (clave && otras[clave]) || principal;
    const datos = new FormData(evento.currentTarget);
    startTransition(() => accion(datos));
  };
}
