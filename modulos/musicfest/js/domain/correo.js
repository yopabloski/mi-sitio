// El correo institucional del estudiante: lógica pura, sin DOM y sin red.
//
// Es un campo opcional. Vacío significa "no lo dio", no "lo dio mal": entrar a
// la partida nunca depende de él. Pero si escribe algo, tiene que ser una
// dirección @udd.cl bien formada, porque el único uso de este dato es poder
// devolverle su trabajo a una persona concreta.
//
// Sólo @udd.cl exacto. Los subdominios (alumnos.udd.cl, correo.udd.cl) se
// rechazan a propósito: si algún día hay que aceptarlos, se agregan acá y en
// las pruebas, no repartidos por la interfaz.

export const DOMINIO = 'udd.cl';

// Parte local deliberadamente conservadora: letras, dígitos y . _ % + -
// sin punto al principio, al final, ni dos seguidos.
const LOCAL = /^[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*$/;

/** Trim y minúsculas. El correo es el mismo escrito como se escriba. */
export const normalizarCorreo = bruto => String(bruto ?? '').trim().toLowerCase();

/** ¿Está vacío? Un campo opcional en blanco no es un error. */
export const correoVacio = bruto => normalizarCorreo(bruto) === '';

/**
 * @param {string} bruto lo que escribió el estudiante
 * @returns {{ok:boolean, correo:string|null, error:string|null}}
 *   `ok:true, correo:null` es el caso legítimo de campo en blanco.
 */
export function validarCorreo(bruto) {
  const correo = normalizarCorreo(bruto);
  if (correo === '') return { ok: true, correo: null, error: null };

  const partes = correo.split('@');
  if (partes.length !== 2 || !partes[0] || !partes[1]) {
    return { ok: false, correo: null, error: 'Escribe un correo completo, con un solo @.' };
  }

  const [local, dominio] = partes;
  if (dominio !== DOMINIO) {
    return { ok: false, correo: null, error: `El correo debe terminar en @${DOMINIO}.` };
  }
  if (!LOCAL.test(local)) {
    return { ok: false, correo: null, error: 'Revisa la parte anterior al @: hay un carácter que no corresponde.' };
  }

  return { ok: true, correo, error: null };
}

/**
 * La pareja: dos correos, ambos opcionales. Trabajar solo es legítimo, y que
 * entre uno por los dos también, así que ninguno de los dos campos obliga.
 *
 * El único rechazo propio de la pareja es escribir el mismo correo dos veces:
 * no aporta un segundo integrante y ensucia el registro con un duplicado que
 * después hay que limpiar a mano.
 *
 * @param {Array<string>} brutos lo que escribió el estudiante, en orden de campo
 * @returns {{ok:boolean, correos:string[], error:string|null, indice:number|null}}
 *   `indice` es el campo que hay que enfocar cuando algo falla.
 */
export function validarCorreos(brutos = []) {
  const correos = [];

  for (let i = 0; i < brutos.length; i++) {
    const resultado = validarCorreo(brutos[i]);
    if (!resultado.ok) return { ok: false, correos: [], error: resultado.error, indice: i };
    if (!resultado.correo) continue;

    if (correos.includes(resultado.correo)) {
      return {
        ok: false,
        correos: [],
        error: 'Los dos correos son el mismo. Si trabajas solo o sola, deja el segundo en blanco.',
        indice: i
      };
    }
    correos.push(resultado.correo);
  }

  return { ok: true, correos, error: null, indice: null };
}
