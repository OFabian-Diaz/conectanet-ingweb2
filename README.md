# ConectaNet

Plataforma web para una empresa local de internet y televisión: consulta de planes, registro e inicio de sesión, visualización del plan contratado y pago mensual simulado.

Proyecto de curso — Ingeniería Web 2, Universidad Manuela Beltrán.
Integrantes: Manuel Osorio Feo, Oscar Fabián Forero Díaz.

## Estructura

```
conectanet/
├── backend/                 API REST (Node.js + Express + Sequelize)
│   ├── src/
│   │   ├── app.js           Express, helmet, CORS, Swagger, rutas, manejo de errores
│   │   ├── server.js        Arranque: conexión BD, sync y siembra de planes
│   │   ├── config.js        Variables de entorno
│   │   ├── seed.js          Planes de ejemplo (npm run seed)
│   │   ├── models/index.js  Usuario, Plan, Suscripcion, Pago y relaciones
│   │   ├── middleware/      auth.js (JWT), validar.js (express-validator)
│   │   ├── routes/          auth, planes, usuarios, pagos
│   │   └── docs/openapi.yaml  Especificación OpenAPI 3.0
│   └── tests/api.test.js    19 pruebas de integración (node --test + supertest)
├── frontend/                React + Vite (planes, registro, login, mi cuenta, pagos)
├── postman/                 Colección Postman con scripts de prueba
└── docker-compose.yml       PostgreSQL 17 (opcional)
```

## Cómo ejecutarlo

Requisitos: Node.js 20 o superior. PostgreSQL es opcional en desarrollo (se puede usar SQLite).

### 1. Base de datos

**Opción A — PostgreSQL (la del diseño del proyecto).** Con Docker: `docker compose up -d`. Si lo instalas a mano, crea la base `conectanet` y un usuario con contraseña.

**Opción B — SQLite (sin instalar nada).** Útil para desarrollo y demostraciones; Sequelize usa el mismo código para ambos motores.

### 2. Backend

```bash
cd backend
cp .env.example .env      # en Windows: copy .env.example .env
npm install
npm start                 # http://localhost:4000  ·  Swagger: http://localhost:4000/api/docs
```

En `.env` ajusta `DB_DIALECT` (`postgres` o `sqlite`), `DATABASE_URL` y un `JWT_SECRET` largo y aleatorio:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Al arrancar se crean las tablas y 5 planes de ejemplo si la tabla está vacía.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173 (reenvía /api al backend)
```

### 4. Pruebas

```bash
cd backend
npm test                  # usa SQLite en memoria, no toca tu base de datos
```

Postman: importa `postman/ConectaNet.postman_collection.json` y ejecútala completa con el **Collection Runner** (con el backend encendido). El registro genera un correo único y el login guarda el token en `{{token}}` automáticamente.

## Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/auth/registro` | Público | Crea el usuario (contraseña con bcrypt). `planId` opcional crea una suscripción `pendiente`. |
| POST | `/api/auth/login` | Público | Valida credenciales y devuelve el JWT. |
| GET | `/api/planes` | Público | Planes activos ordenados por precio. |
| GET | `/api/usuarios/mi-cuenta` | JWT | Perfil y plan vigente del usuario autenticado. |
| PUT | `/api/usuarios/mi-cuenta/plan` | JWT | Contratar o cambiar de plan (adicional al diseño original). |
| POST | `/api/pagos` | JWT | Pago mensual simulado: monto = precio del plan, un pago por mes, activa la suscripción. |
| GET | `/api/pagos/historial` | JWT | Historial de pagos del usuario. |

Las rutas protegidas usan la cabecera `Authorization: Bearer <token>`. La documentación interactiva completa está en `/api/docs`.

## Modelo de datos

- **Usuario**: id, nombre, correo (único), contrasena (hash bcrypt), telefono, direccion
- **Plan**: id, nombre, tipo (internet / tv / combo), velocidad, precio, descripcion, activo
- **Suscripcion**: id, usuario_id, plan_id, fecha_inicio, estado (pendiente / activa / cancelada)
- **Pago**: id, suscripcion_id, monto, fecha, periodo (AAAA-MM), metodo (tarjeta / pse / efectivo), estado (aprobado / rechazado)

Relaciones: Usuario 1—N Suscripcion N—1 Plan; Suscripcion 1—N Pago.

## Seguridad (OWASP Top 10)

| Riesgo | Medida aplicada | Dónde |
|---|---|---|
| A03 Inyección SQL | Todas las consultas pasan por Sequelize (consultas parametrizadas); no hay SQL concatenado. | `models/`, `routes/` |
| A03 Validación de entradas | `express-validator` en registro, login, pagos y cambio de plan; respuesta 400 con el detalle. Límite de 10 kB por petición. | `routes/*.js`, `app.js` |
| A03 XSS | Se rechazan `< > " ' \`` en nombre y dirección; React escapa todo lo que renderiza y no se usa `dangerouslySetInnerHTML`; CSP con helmet. | `validar.js`, `App.jsx`, `app.js` |
| A01 CSRF | El JWT viaja en la cabecera `Authorization`, no en cookies, así que el navegador no lo envía solo desde otro sitio. CORS limitado al origen del frontend. | `auth.js`, `app.js` |
| A01 Control de acceso | El id del usuario se toma siempre del token, nunca del cuerpo o la URL (evita IDOR). El monto del pago lo calcula el servidor. | `usuarios.js`, `pagos.js` |
| A02 Fallas criptográficas | Contraseñas con bcrypt (12 rondas); JWT HS256 con secreto en variable de entorno, algoritmo fijado y expiración de 2 h. | `auth.js` |
| A07 Fallas de autenticación | Límite de 20 intentos cada 15 min en login/registro; mismo mensaje si el correo no existe o la clave es incorrecta; contraseña mínima de 8 caracteres con letras y números. | `routes/auth.js` |
| A05 Configuración insegura | `helmet` (cabeceras de seguridad), sin `X-Powered-By`, errores sin trazas internas, `.env` fuera del control de versiones. | `app.js`, `.gitignore` |

## Alcance

El pago es simulado: no se integra pasarela real ni se solicitan datos bancarios. No se incluyen facturación electrónica ni atención al cliente en tiempo real.
