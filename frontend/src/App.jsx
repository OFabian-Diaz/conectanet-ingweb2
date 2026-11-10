import { useEffect, useState } from 'react';
import { api, sesion, pesos } from './api.js';

// Nota de seguridad (XSS): React escapa todo el texto que se renderiza con {llaves}.
// En este proyecto no se usa dangerouslySetInnerHTML en ningún lugar.

const ETIQUETA_TIPO = { internet: 'Internet', tv: 'Televisión', combo: 'Internet + TV' };

export default function App() {
  const [vista, setVista] = useState(sesion.obtener() ? 'cuenta' : 'planes');
  const [autenticado, setAutenticado] = useState(Boolean(sesion.obtener()));
  const [planElegido, setPlanElegido] = useState(null);

  function entrar(token) {
    sesion.guardar(token);
    setAutenticado(true);
    setVista('cuenta');
  }

  function salir() {
    sesion.cerrar();
    setAutenticado(false);
    setVista('planes');
  }

  function elegirPlan(plan) {
    setPlanElegido(plan);
    setVista(autenticado ? 'cuenta' : 'registro');
  }

  return (
    <>
      <header className="barra">
        <button className="marca" onClick={() => setVista('planes')}>
          Conecta<span>Net</span>
        </button>
        <nav>
          <button className={vista === 'planes' ? 'activo' : ''} onClick={() => setVista('planes')}>Planes</button>
          {autenticado ? (
            <>
              <button className={vista === 'cuenta' ? 'activo' : ''} onClick={() => setVista('cuenta')}>Mi cuenta</button>
              <button onClick={salir}>Cerrar sesión</button>
            </>
          ) : (
            <>
              <button className={vista === 'login' ? 'activo' : ''} onClick={() => setVista('login')}>Ingresar</button>
              <button className={`primario ${vista === 'registro' ? 'activo' : ''}`} onClick={() => setVista('registro')}>Registrarse</button>
            </>
          )}
        </nav>
      </header>

      <main>
        {vista === 'planes' && <Planes onElegir={elegirPlan} />}
        {vista === 'registro' && <Registro planElegido={planElegido} onListo={entrar} irALogin={() => setVista('login')} />}
        {vista === 'login' && <Login onListo={entrar} irARegistro={() => setVista('registro')} />}
        {vista === 'cuenta' && autenticado && (
          <MiCuenta planElegido={planElegido} limpiarPlanElegido={() => setPlanElegido(null)} onSesionExpirada={salir} />
        )}
      </main>

      <footer>ConectaNet · Proyecto Ingeniería Web 2 · UMB · Pagos simulados con fines académicos</footer>
    </>
  );
}

/* ---------------- Planes ---------------- */
function Planes({ onElegir }) {
  const [planes, setPlanes] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.planes().then(setPlanes).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, []);

  return (
    <section>
      <div className="hero">
        <h1>Internet y televisión para tu hogar</h1>
        <p>Elige tu plan, regístrate en un minuto y paga tu mensualidad en línea.</p>
      </div>
      {cargando && <p className="nota">Cargando planes…</p>}
      {error && <p className="alerta">{error}</p>}
      <div className="rejilla">
        {planes.map((plan) => (
          <article key={plan.id} className={`plan plan-${plan.tipo}`}>
            <span className="etiqueta">{ETIQUETA_TIPO[plan.tipo]}</span>
            <h2>{plan.nombre}</h2>
            {plan.velocidad && <p className="velocidad">{plan.velocidad}</p>}
            <p className="descripcion">{plan.descripcion}</p>
            <p className="precio">
              {pesos(plan.precio)} <small>/ mes</small>
            </p>
            <button className="primario" onClick={() => onElegir(plan)}>Elegir este plan</button>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Formularios de autenticación ---------------- */
function useFormulario(inicial) {
  const [datos, setDatos] = useState(inicial);
  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });
  return [datos, cambiar];
}

function Registro({ planElegido, onListo, irALogin }) {
  const [datos, cambiar] = useFormulario({ nombre: '', correo: '', contrasena: '', telefono: '', direccion: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const { token } = await api.registro({ ...datos, planId: planElegido?.id ?? null });
      onListo(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h1>Crear cuenta</h1>
      {planElegido && (
        <p className="nota">
          Plan seleccionado: <strong>{planElegido.nombre}</strong> ({pesos(planElegido.precio)}/mes)
        </p>
      )}
      <label>Nombre completo<input name="nombre" value={datos.nombre} onChange={cambiar} required minLength={2} maxLength={100} /></label>
      <label>Correo<input name="correo" type="email" value={datos.correo} onChange={cambiar} required autoComplete="email" /></label>
      <label>
        Contraseña
        <input name="contrasena" type="password" value={datos.contrasena} onChange={cambiar} required minLength={8} maxLength={72} autoComplete="new-password" />
        <small>Mínimo 8 caracteres, con letras y números.</small>
      </label>
      <label>Teléfono<input name="telefono" type="tel" value={datos.telefono} onChange={cambiar} /></label>
      <label>Dirección<input name="direccion" value={datos.direccion} onChange={cambiar} maxLength={200} /></label>
      {error && <p className="alerta">{error}</p>}
      <button className="primario" disabled={enviando}>{enviando ? 'Creando…' : 'Registrarme'}</button>
      <p className="nota">¿Ya tienes cuenta? <button type="button" className="enlace" onClick={irALogin}>Ingresa aquí</button></p>
    </form>
  );
}

function Login({ onListo, irARegistro }) {
  const [datos, cambiar] = useFormulario({ correo: '', contrasena: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const { token } = await api.login(datos);
      onListo(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h1>Ingresar</h1>
      <label>Correo<input name="correo" type="email" value={datos.correo} onChange={cambiar} required autoComplete="email" /></label>
      <label>Contraseña<input name="contrasena" type="password" value={datos.contrasena} onChange={cambiar} required autoComplete="current-password" /></label>
      {error && <p className="alerta">{error}</p>}
      <button className="primario" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
      <p className="nota">¿No tienes cuenta? <button type="button" className="enlace" onClick={irARegistro}>Regístrate</button></p>
    </form>
  );
}

/* ---------------- Mi cuenta ---------------- */
function MiCuenta({ planElegido, limpiarPlanElegido, onSesionExpirada }) {
  const [cuenta, setCuenta] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [metodo, setMetodo] = useState('pse');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function cargar() {
    try {
      const [c, h] = await Promise.all([api.miCuenta(), api.historial()]);
      setCuenta(c);
      setPagos(h);
    } catch (err) {
      if (err.estado === 401) onSesionExpirada();
      else setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function accion(fn, exito) {
    setError('');
    setMensaje('');
    setOcupado(true);
    try {
      await fn();
      setMensaje(exito);
      await cargar();
    } catch (err) {
      if (err.estado === 401) onSesionExpirada();
      else setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  if (!cuenta) return <p className="nota">{error || 'Cargando tu cuenta…'}</p>;

  const { usuario, suscripcion } = cuenta;
  const hoy = new Date();
  const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const mesPagado = pagos.some((p) => p.periodo === periodo && p.estado === 'aprobado' && p.plan === suscripcion?.plan.nombre);
  const ofrecerCambio = planElegido && planElegido.id !== suscripcion?.plan.id;

  return (
    <section className="cuenta">
      <h1>Hola, {usuario.nombre}</h1>
      {mensaje && <p className="exito">{mensaje}</p>}
      {error && <p className="alerta">{error}</p>}

      {ofrecerCambio && (
        <div className="tarjeta aviso">
          <p>
            ¿Quieres {suscripcion ? 'cambiar' : 'contratar'} el plan <strong>{planElegido.nombre}</strong> por {pesos(planElegido.precio)}/mes?
          </p>
          <div className="acciones">
            <button className="primario" disabled={ocupado} onClick={() => accion(() => api.cambiarPlan(planElegido.id), 'Plan actualizado. Realiza el pago para activarlo.').then(limpiarPlanElegido)}>
              Confirmar
            </button>
            <button onClick={limpiarPlanElegido}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="dos-columnas">
        <div className="tarjeta">
          <h2>Mi plan</h2>
          {suscripcion ? (
            <>
              <p className="plan-actual">{suscripcion.plan.nombre}</p>
              <p>{ETIQUETA_TIPO[suscripcion.plan.tipo]}{suscripcion.plan.velocidad ? ` · ${suscripcion.plan.velocidad}` : ''}</p>
              <p>Valor mensual: <strong>{pesos(suscripcion.plan.precio)}</strong></p>
              <p>Estado: <span className={`estado estado-${suscripcion.estado}`}>{suscripcion.estado}</span></p>
              <p className="nota">Desde {suscripcion.fechaInicio}</p>
            </>
          ) : (
            <p className="nota">Aún no tienes un plan. Ve a <strong>Planes</strong> y elige uno.</p>
          )}
        </div>

        <div className="tarjeta">
          <h2>Pago mensual</h2>
          {!suscripcion && <p className="nota">Contrata un plan para poder pagar.</p>}
          {suscripcion && mesPagado && <p className="exito">El mes {periodo} ya está pagado. ¡Gracias!</p>}
          {suscripcion && !mesPagado && (
            <>
              <p>Total a pagar ({periodo}): <strong>{pesos(suscripcion.plan.precio)}</strong></p>
              <label>
                Método de pago
                <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                  <option value="pse">PSE</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="efectivo">Efectivo (punto físico)</option>
                </select>
              </label>
              <button className="primario" disabled={ocupado} onClick={() => accion(() => api.pagar(metodo), 'Pago registrado con éxito.')}>
                {ocupado ? 'Procesando…' : 'Pagar ahora'}
              </button>
              <p className="nota">Pago simulado: no se solicita ni se guarda ningún dato bancario.</p>
            </>
          )}
        </div>
      </div>

      <div className="tarjeta">
        <h2>Historial de pagos</h2>
        {pagos.length === 0 ? (
          <p className="nota">Todavía no hay pagos registrados.</p>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Periodo</th><th>Plan</th><th>Método</th><th>Monto</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.fecha).toLocaleDateString('es-CO')}</td>
                    <td>{p.periodo}</td>
                    <td>{p.plan}</td>
                    <td>{p.metodo}</td>
                    <td>{pesos(p.monto)}</td>
                    <td><span className={`estado estado-${p.estado}`}>{p.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="tarjeta">
        <h2>Mis datos</h2>
        <p>Correo: {usuario.correo}</p>
        {usuario.telefono && <p>Teléfono: {usuario.telefono}</p>}
        {usuario.direccion && <p>Dirección: {usuario.direccion}</p>}
      </div>
    </section>
  );
}
