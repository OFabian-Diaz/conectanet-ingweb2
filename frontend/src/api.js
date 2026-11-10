// Cliente HTTP de la API. El JWT viaja en la cabecera Authorization (no en cookies),
// así que el navegador no lo envía solo en peticiones de otros sitios: protege contra CSRF.

const BASE = import.meta.env.VITE_API_URL || '/api';
const CLAVE_TOKEN = 'conectanet_token';

// sessionStorage: el token se borra al cerrar la pestaña (reduce el tiempo de exposición).
export const sesion = {
  obtener: () => sessionStorage.getItem(CLAVE_TOKEN),
  guardar: (token) => sessionStorage.setItem(CLAVE_TOKEN, token),
  cerrar: () => sessionStorage.removeItem(CLAVE_TOKEN),
};

async function peticion(ruta, { metodo = 'GET', cuerpo, auth = false } = {}) {
  const cabeceras = { 'Content-Type': 'application/json' };
  if (auth) cabeceras.Authorization = `Bearer ${sesion.obtener()}`;

  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && auth) sesion.cerrar();
    const error = new Error(datos.detalles?.map((d) => d.mensaje).join('. ') || datos.error || 'Error de conexión');
    error.estado = res.status;
    throw error;
  }
  return datos;
}

export const api = {
  planes: () => peticion('/planes'),
  registro: (datos) => peticion('/auth/registro', { metodo: 'POST', cuerpo: datos }),
  login: (datos) => peticion('/auth/login', { metodo: 'POST', cuerpo: datos }),
  miCuenta: () => peticion('/usuarios/mi-cuenta', { auth: true }),
  cambiarPlan: (planId) => peticion('/usuarios/mi-cuenta/plan', { metodo: 'PUT', cuerpo: { planId }, auth: true }),
  pagar: (metodo) => peticion('/pagos', { metodo: 'POST', cuerpo: { metodo }, auth: true }),
  historial: () => peticion('/pagos/historial', { auth: true }),
};

export const pesos = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor));
