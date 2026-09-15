/**
 * Reducción de imágenes en el navegador, antes de subirlas a Storage.
 *
 * Una foto de celular pesa 3-5 MB. Reducida queda en unos cientos de KB: la
 * transferencia de imágenes es de los mayores costos de infraestructura
 * (docs/10-costos-de-infraestructura.md) y la subida por datos móviles se
 * eterniza sin esto.
 *
 * Solo navegador: usa canvas.
 */

const CALIDAD_JPEG = 0.82;

/** Devuelve un JPEG cuyo lado más largo mide como máximo `ladoMaximoPx`. */
export async function reducirImagen(archivo: File, ladoMaximoPx: number): Promise<Blob> {
  // imageOrientation respeta la rotación EXIF: sin eso, las fotos verticales
  // del celular quedan acostadas.
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  const escala = Math.min(1, ladoMaximoPx / Math.max(imagen.width, imagen.height));

  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);

  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('El navegador no permite procesar imágenes');
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();

  return new Promise((resolver, rechazar) =>
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo convertir la imagen'))),
      'image/jpeg',
      CALIDAD_JPEG,
    ),
  );
}
