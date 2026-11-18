import { useEffect, useMemo, useState } from 'react';
import { api, sesion, pesos } from './api.js';

// Nota de seguridad (XSS): React escapa todo el texto que se renderiza con {llaves}.
// En este proyecto no se usa dangerouslySetInnerHTML en ningún lugar.

const ETIQUETA_TIPO = { internet: 'Internet', tv: 'Televisión', combo: 'Internet + TV' };
const ETIQUETA_METODO = { pse: 'PSE', tarjeta: 'Tarjeta', efectivo: 'Efectivo' };
const FILTROS = [
  { id: 'todos', texto: 'Todos los planes' },
  { id: 'internet', texto: 'Internet' },
  { id: 'tv', texto: 'Televisión' },
  { id: 'combo', texto: 'Combos' },
];

export default function App() {
  const [vista, setVista] = useState(sesion.obtener() ? 'cuenta' : 'planes');
  const [autenticado, setAutenticado] = useState(Boolean(sesion.obtener()));
  const [planElegido, setPlanElegido] = useState(null);

  function ir(destino) {
    setVista(destino);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function entrar(token) {
    sesion.guardar(token);
    setAutenticado(true);
    ir('cuenta');
  }

  function salir() {
    sesion.cerrar();
    setAutenticado(false);
    ir('planes');
  }

  function elegirPlan(plan) {
    setPlanElegido(plan);
    ir(autenticado ? 'cuenta' : 'registro');
  }

  return (
    <div className="sitio">
      <div className="franja-superior">
        <div className="contenedor franja-contenido">
          <span>Atención en línea las 24 horas</span>
          <span className="franja-separador" aria-hidden="true">·</span>
          <span>Paga tu mensualidad sin salir de casa</span>
          <span className="franja-separador solo-escritorio" aria-hidden="true">·</span>
          <span className="solo-escritorio">Internet de fibra y televisión para tu municipio</span>
        </div>
      </div>

      <header className="encabezado">
        <div className="contenedor encabezado-contenido">
          <button className="marca" onClick={() => ir('planes')} aria-label="ConectaNet, ir al inicio">
            <Logo />
            <span>Conecta<b>Net</b></span>
          </button>
          <nav className="navegacion" aria-label="Principal">
            <button className={vista === 'planes' ? 'activo' : ''} onClick={() => ir('planes')}>Planes</button>
            {autenticado ? (
              <>
                <button className={vista === 'cuenta' ? 'activo' : ''} onClick={() => ir('cuenta')}>Mi cuenta</button>
                <button className="boton-contorno" onClick={salir}>Cerrar sesión</button>
              </>
            ) : (
              <>
                <button className={vista === 'login' ? 'activo' : ''} onClick={() => ir('login')}>Ingresar</button>
                <button className="boton-accion" onClick={() => ir('registro')}>Registrarse</button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {vista === 'planes' && <Inicio onElegir={elegirPlan} />}
        {vista === 'registro' && <Registro planElegido={planElegido} onListo={entrar} irALogin={() => ir('login')} />}
        {vista === 'login' && <Login onListo={entrar} irARegistro={() => ir('registro')} />}
        {vista === 'cuenta' && autenticado && (
          <MiCuenta planElegido={planElegido} limpiarPlanElegido={() => setPlanElegido(null)} onSesionExpirada={salir} irAPlanes={() => ir('planes')} />
        )}
      </main>

      <Pie irA={ir} autenticado={autenticado} />
    </div>
  );
}

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="currentColor" />
      <path d="M11 22a12 12 0 0 1 18 0" fill="none" stroke="#FFB020" strokeWidth="3" strokeLinecap="round" />
      <path d="M14.5 25.5a7 7 0 0 1 11 0" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      <circle cx="20" cy="29.5" r="2.4" fill="#FFB020" />
    </svg>
  );
}

/* ---------------- Inicio: banner, planes y beneficios ---------------- */
function Inicio({ onElegir }) {
  const [planes, setPlanes] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    api.planes().then(setPlanes).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, []);

  const masRapido = useMemo(() => {
    const conVelocidad = planes.filter((p) => p.velocidad);
    return conVelocidad.sort((a, b) => parseInt(b.velocidad, 10) - parseInt(a.velocidad, 10))[0];
  }, [planes]);
  const desde = planes.length ? Math.min(...planes.map((p) => Number(p.precio))) : null;
  const visibles = planes.filter((p) => filtro === 'todos' || p.tipo === filtro);

  function verPlanes() {
    document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <>
      <section className="banner">
        <div className="banner-fondo" aria-hidden="true">
          <span className="onda onda-1" /><span className="onda onda-2" /><span className="onda onda-3" />
        </div>
        <div className="contenedor banner-contenido">
          <div className="banner-texto">
            <p className="banner-ceja">Fibra óptica para tu hogar</p>
            <h1>Conéctate a la velocidad que tu familia necesita</h1>
            <p className="banner-sub">Elige tu plan de internet o televisión, regístrate en un minuto y paga tu mensualidad en línea, cuando quieras.</p>
            <div className="banner-acciones">
              <button className="boton-accion grande" onClick={verPlanes}>Ver planes</button>
              {desde !== null && <span className="banner-desde">Desde <b>{pesos(desde)}</b> al mes</span>}
            </div>
          </div>
          {masRapido && (
            <aside className="banner-oferta">
              <span className="oferta-etiqueta">Nuestro plan más rápido</span>
              <p className="oferta-nombre">{masRapido.nombre}</p>
              <p className="oferta-velocidad">{masRapido.velocidad}</p>
              <div className="oferta-precio">
                <span>Desde</span>
                <b>{pesos(masRapido.precio)}</b>
                <span>al mes</span>
              </div>
              <button className="boton-accion ancho" onClick={() => onElegir(masRapido)}>Lo quiero</button>
            </aside>
          )}
        </div>
      </section>

      <section className="seccion" id="planes">
        <div className="contenedor">
          <div className="titulo-seccion">
            <h2>Elige el plan que más te guste</h2>
            <p>Todos incluyen pago mensual en línea e historial de pagos en tu cuenta.</p>
          </div>

          <div className="filtros" role="tablist" aria-label="Filtrar planes">
            {FILTROS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filtro === f.id} className={filtro === f.id ? 'activo' : ''} onClick={() => setFiltro(f.id)}>
                {f.texto}
              </button>
            ))}
          </div>

          {cargando && <p className="nota centrada">Cargando planes…</p>}
          {error && <p className="alerta">{error}</p>}

          <div className="rejilla-planes">
            {visibles.map((plan) => (
              <TarjetaPlan key={plan.id} plan={plan} destacado={plan.tipo === 'combo'} onElegir={onElegir} />
            ))}
          </div>
          {!cargando && !error && visibles.length === 0 && <p className="nota centrada">No hay planes en esta categoría.</p>}
        </div>
      </section>

      <section className="seccion seccion-suave">
        <div className="contenedor">
          <div className="titulo-seccion">
            <h2>Todo desde tu cuenta</h2>
            <p>Sin filas ni llamadas: maneja tu servicio desde el celular o el computador.</p>
          </div>
          <div className="beneficios">
            <Beneficio icono="pago" titulo="Paga en línea" texto="PSE, tarjeta o efectivo. El valor es siempre el de tu plan." />
            <Beneficio icono="reloj" titulo="Disponible 24 horas" texto="Consulta tu plan y tus pagos a cualquier hora." />
            <Beneficio icono="escudo" titulo="Datos protegidos" texto="Tu contraseña se guarda cifrada y tu sesión es privada." />
            <Beneficio icono="cambio" titulo="Cambia de plan" texto="Sube o baja de plan desde tu cuenta cuando lo necesites." />
          </div>
        </div>
      </section>
    </>
  );
}

function TarjetaPlan({ plan, destacado, onElegir }) {
  return (
    <article className={`plan ${destacado ? 'plan-destacado' : ''}`}>
      <div className={`plan-pestana plan-pestana-${plan.tipo}`}>{ETIQUETA_TIPO[plan.tipo]}</div>
      {destacado && <span className="plan-sello">Más completo</span>}
      <div className="plan-cabeza">
        <p className="plan-nombre">{plan.nombre}</p>
        <p className="plan-velocidad">{plan.velocidad || 'TV'}</p>
        <p className="plan-descripcion">{plan.descripcion}</p>
      </div>
      <div className="plan-precio">
        <span className="plan-flecha" aria-hidden="true" />
        <span className="plan-desde">Desde:</span>
        <span className="plan-valor">{pesos(plan.precio)}</span>
        <span className="plan-mes">Al mes</span>
        <button className="boton-accion ancho" onClick={() => onElegir(plan)}>Elegir este plan</button>
      </div>
      <p className="plan-nota">Pago mensual en línea · Se activa con el primer pago</p>
    </article>
  );
}

function Beneficio({ icono, titulo, texto }) {
  return (
    <div className="beneficio">
      <span className="beneficio-icono"><Icono nombre={icono} /></span>
      <h3>{titulo}</h3>
      <p>{texto}</p>
    </div>
  );
}

function Icono({ nombre }) {
  const comun = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      {nombre === 'pago' && (<><rect x="3" y="6" width="18" height="12" rx="2" {...comun} /><path d="M3 10h18M7 15h4" {...comun} /></>)}
      {nombre === 'reloj' && (<><circle cx="12" cy="12" r="9" {...comun} /><path d="M12 7v5l3 2" {...comun} /></>)}
      {nombre === 'escudo' && (<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" {...comun} /><path d="M9 12l2 2 4-4" {...comun} /></>)}
      {nombre === 'cambio' && (<><path d="M4 8h13l-3-3M20 16H7l3 3" {...comun} /></>)}
    </svg>
  );
}

/* ---------------- Formularios de autenticación ---------------- */
function useFormulario(inicial) {
  const [datos, setDatos] = useState(inicial);
  const cambiar = (e) => setDatos({ ...datos, [e.target.name]: e.target.value });
  return [datos, cambiar];
}

function PanelAcceso({ titulo, texto, children }) {
  return (
    <section className="seccion">
      <div className="contenedor acceso">
        <aside className="acceso-lateral">
          <Logo />
          <h2>{titulo}</h2>
          <p>{texto}</p>
          <ul>
            <li>Consulta tu plan y su estado</li>
            <li>Paga tu mensualidad en línea</li>
            <li>Revisa tu historial de pagos</li>
          </ul>
        </aside>
        <div className="acceso-formulario">{children}</div>
      </div>
    </section>
  );
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
    <PanelAcceso titulo="Crea tu cuenta" texto="Afíliate en un minuto, sin ir a la oficina.">
      <form className="formulario" onSubmit={enviar}>
        <h1>Registro</h1>
        {planElegido && (
          <div className="plan-seleccionado">
            <span>Plan seleccionado</span>
            <b>{planElegido.nombre}</b>
            <span>{pesos(planElegido.precio)} al mes</span>
          </div>
        )}
        <label>Nombre completo<input name="nombre" value={datos.nombre} onChange={cambiar} required minLength={2} maxLength={100} /></label>
        <label>Correo electrónico<input name="correo" type="email" value={datos.correo} onChange={cambiar} required autoComplete="email" /></label>
        <label>
          Contraseña
          <input name="contrasena" type="password" value={datos.contrasena} onChange={cambiar} required minLength={8} maxLength={72} autoComplete="new-password" />
          <small>Mínimo 8 caracteres, con letras y números.</small>
        </label>
        <div className="dos-campos">
          <label>Teléfono<input name="telefono" type="tel" value={datos.telefono} onChange={cambiar} /></label>
          <label>Dirección<input name="direccion" value={datos.direccion} onChange={cambiar} maxLength={200} /></label>
        </div>
        {error && <p className="alerta">{error}</p>}
        <button className="boton-accion ancho grande" disabled={enviando}>{enviando ? 'Creando cuenta…' : 'Crear mi cuenta'}</button>
        <p className="nota">¿Ya tienes cuenta? <button type="button" className="enlace" onClick={irALogin}>Ingresa aquí</button></p>
      </form>
    </PanelAcceso>
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
    <PanelAcceso titulo="Bienvenido de nuevo" texto="Ingresa para ver tu plan y pagar tu mensualidad.">
      <form className="formulario" onSubmit={enviar}>
        <h1>Ingresar</h1>
        <label>Correo electrónico<input name="correo" type="email" value={datos.correo} onChange={cambiar} required autoComplete="email" /></label>
        <label>Contraseña<input name="contrasena" type="password" value={datos.contrasena} onChange={cambiar} required autoComplete="current-password" /></label>
        {error && <p className="alerta">{error}</p>}
        <button className="boton-accion ancho grande" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
        <p className="nota">¿No tienes cuenta? <button type="button" className="enlace" onClick={irARegistro}>Regístrate</button></p>
      </form>
    </PanelAcceso>
  );
}

/* ---------------- Mi cuenta ---------------- */
function MiCuenta({ planElegido, limpiarPlanElegido, onSesionExpirada, irAPlanes }) {
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

  if (!cuenta) {
    return <section className="seccion"><div className="contenedor"><p className="nota centrada">{error || 'Cargando tu cuenta…'}</p></div></section>;
  }

  const { usuario, suscripcion } = cuenta;
  const hoy = new Date();
  const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const mesPagado = pagos.some((p) => p.periodo === periodo && p.estado === 'aprobado' && p.plan === suscripcion?.plan.nombre);
  const ofrecerCambio = planElegido && planElegido.id !== suscripcion?.plan.id;
  const primerNombre = usuario.nombre.split(' ')[0];

  return (
    <>
      <section className="cuenta-cabecera">
        <div className="contenedor">
          <p className="banner-ceja">Mi cuenta</p>
          <h1>Hola, {primerNombre}</h1>
          <p>{suscripcion ? `Tu plan ${suscripcion.plan.nombre} está ${suscripcion.estado}.` : 'Todavía no tienes un plan contratado.'}</p>
        </div>
      </section>

      <section className="seccion cuenta">
        <div className="contenedor cuenta-contenido">
          {mensaje && <p className="exito">{mensaje}</p>}
          {error && <p className="alerta">{error}</p>}

          {ofrecerCambio && (
            <div className="tarjeta aviso">
              <p>
                ¿Quieres {suscripcion ? 'cambiar al' : 'contratar el'} plan <b>{planElegido.nombre}</b> por {pesos(planElegido.precio)} al mes?
              </p>
              <div className="acciones">
                <button className="boton-accion" disabled={ocupado} onClick={() => accion(() => api.cambiarPlan(planElegido.id), 'Plan actualizado. Realiza el pago para activarlo.').then(limpiarPlanElegido)}>
                  Confirmar
                </button>
                <button className="boton-contorno oscuro" onClick={limpiarPlanElegido}>Cancelar</button>
              </div>
            </div>
          )}

          <div className="cuenta-rejilla">
            <div className="tarjeta tarjeta-plan">
              <h2>Mi plan</h2>
              {suscripcion ? (
                <>
                  <p className="plan-actual">{suscripcion.plan.nombre}</p>
                  <p className="dato">{ETIQUETA_TIPO[suscripcion.plan.tipo]}{suscripcion.plan.velocidad ? ` · ${suscripcion.plan.velocidad}` : ''}</p>
                  <div className="fila-datos">
                    <div><span>Valor mensual</span><b>{pesos(suscripcion.plan.precio)}</b></div>
                    <div><span>Estado</span><b className={`estado estado-${suscripcion.estado}`}>{suscripcion.estado}</b></div>
                    <div><span>Desde</span><b>{suscripcion.fechaInicio}</b></div>
                  </div>
                  <button className="enlace" onClick={irAPlanes}>Ver otros planes</button>
                </>
              ) : (
                <>
                  <p className="nota">Aún no tienes un plan.</p>
                  <button className="boton-accion" onClick={irAPlanes}>Ver planes</button>
                </>
              )}
            </div>

            <div className="tarjeta tarjeta-pago">
              <h2>Pago mensual</h2>
              {!suscripcion && <p className="nota">Contrata un plan para poder pagar.</p>}
              {suscripcion && mesPagado && (
                <div className="pago-listo">
                  <span className="pago-check" aria-hidden="true">✓</span>
                  <p>El mes <b>{periodo}</b> ya está pagado. ¡Gracias!</p>
                </div>
              )}
              {suscripcion && !mesPagado && (
                <>
                  <div className="total">
                    <span>Total a pagar · {periodo}</span>
                    <b>{pesos(suscripcion.plan.precio)}</b>
                  </div>
                  <label>
                    Método de pago
                    <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                      <option value="pse">PSE</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="efectivo">Efectivo (punto físico)</option>
                    </select>
                  </label>
                  <button className="boton-accion ancho grande" disabled={ocupado} onClick={() => accion(() => api.pagar(metodo), 'Pago registrado con éxito.')}>
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
                        <td>{ETIQUETA_METODO[p.metodo] || p.metodo}</td>
                        <td className="numero">{pesos(p.monto)}</td>
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
            <div className="fila-datos">
              <div><span>Nombre</span><b>{usuario.nombre}</b></div>
              <div><span>Correo</span><b>{usuario.correo}</b></div>
              {usuario.telefono && <div><span>Teléfono</span><b>{usuario.telefono}</b></div>}
              {usuario.direccion && <div><span>Dirección</span><b>{usuario.direccion}</b></div>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------------- Pie de página ---------------- */
function Pie({ irA, autenticado }) {
  return (
    <footer className="pie">
      <div className="contenedor pie-columnas">
        <div>
          <div className="marca marca-pie"><Logo /><span>Conecta<b>Net</b></span></div>
          <p>Internet y televisión para tu hogar, con atención y pagos en línea.</p>
        </div>
        <div>
          <h3>Planes</h3>
          <button className="enlace-pie" onClick={() => irA('planes')}>Internet</button>
          <button className="enlace-pie" onClick={() => irA('planes')}>Televisión</button>
          <button className="enlace-pie" onClick={() => irA('planes')}>Combos</button>
        </div>
        <div>
          <h3>Tu cuenta</h3>
          {autenticado ? (
            <button className="enlace-pie" onClick={() => irA('cuenta')}>Mi cuenta</button>
          ) : (
            <>
              <button className="enlace-pie" onClick={() => irA('login')}>Ingresar</button>
              <button className="enlace-pie" onClick={() => irA('registro')}>Registrarse</button>
            </>
          )}
        </div>
      </div>
      <div className="pie-legal">
        <div className="contenedor">ConectaNet · Proyecto de Ingeniería Web 2 · Universidad Manuela Beltrán · Pagos simulados con fines académicos</div>
      </div>
    </footer>
  );
}
