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

## Flujo de trabajo con Git (GitFlow)

El repositorio sigue **GitFlow**, con dos ramas permanentes y ramas temporales por tarea:

| Rama | Propósito | Se crea desde | Se integra en |
|---|---|---|---|
| `main` | Código en producción. Cada versión entregada lleva una etiqueta (`v1.0.0` = Corte 1, `v2.0.0` = Corte 2). | — | — |
| `develop` | Integración: aquí se juntan las funcionalidades terminadas. | `main` | `release/*` |
| `feature/<tema>` | Una funcionalidad o tema (p. ej. `feature/docker`, `feature/metricas`). | `develop` | `develop` |
| `release/<versión>` | Preparar una entrega: ajustes finales, versión y documentación. | `develop` | `main` y `develop` |
| `hotfix/<problema>` | Corrección urgente sobre producción. | `main` | `main` y `develop` |

```
main     ──●────────────────────────────────────────●── v2.0.0
            \ v1.0.0                               /
develop      ●──────●──────●──────●──────●───────●
              \    /  \   /  \   /  \   /  \    /
feature/*      ●──●    ●─●    ●─●    ●─●    ●──●
             gitflow  docker  ci/cd  k8s   terraform, metricas...
```

Comandos del flujo (sin la extensión git-flow, solo Git):

```bash
# 1. Empezar una funcionalidad
git switch develop
git switch -c feature/mi-tema

# 2. Trabajar y hacer commits pequeños (Conventional Commits: feat:, fix:, docs:, ci:, chore:)
git add -A
git commit -m "feat: descripción del cambio"

# 3. Terminarla: integrar en develop conservando la historia de la rama
git switch develop
git merge --no-ff feature/mi-tema
git branch -d feature/mi-tema

# 4. Publicar una versión
git switch -c release/2.0.0 develop
#   ...ajustes finales...
git switch main && git merge --no-ff release/2.0.0 && git tag -a v2.0.0 -m "Entrega Corte 2"
git switch develop && git merge --no-ff release/2.0.0
git branch -d release/2.0.0
```

En GitHub se recomienda proteger `main` y `develop`: los cambios entran solo por *pull request*, con la integración continua en verde (ver sección CI/CD) y la revisión del compañero.

Para subir el repositorio a GitHub:

```bash
git remote add origin https://github.com/<usuario>/conectanet.git
git push -u origin main develop --tags
```

## Despliegue en la nube: proveedor y modelo de servicio

### Proveedor elegido: Microsoft Azure

| Criterio | Azure | AWS | Google Cloud |
|---|---|---|---|
| Crédito para estudiantes | **Azure for Students: USD 100 con el correo institucional, sin tarjeta de crédito** | AWS Educate / Free Tier (requiere tarjeta para la capa gratuita) | USD 300 de prueba (requiere tarjeta) |
| Contenedores sin administrar servidores | Container Apps (escala a cero, HTTPS incluido) | App Runner / ECS Fargate (más configuración de red e IAM) | Cloud Run (equivalente) |
| PostgreSQL gestionado | Flexible Server desde ~USD 13/mes (B1ms) | RDS | Cloud SQL |
| Gestión de secretos | Key Vault + identidad administrada | Secrets Manager + IAM Role | Secret Manager + Service Account |
| Proveedor de Terraform | `azurerm` oficial de HashiCorp | `aws` | `google` |

Los tres proveedores ofrecen servicios equivalentes para ConectaNet. Elegimos **Azure** por una razón práctica: es el único que da crédito a estudiantes sin pedir tarjeta de crédito, con lo que el equipo puede desplegar sin costo propio. Además, Container Apps exige la menor cantidad de infraestructura (no hay que definir VPC, balanceadores ni clústeres), algo adecuado para una empresa pequeña sin personal dedicado a infraestructura.

### Modelo de servicio: PaaS

| Modelo | Quién administra qué | ¿Lo usamos? |
|---|---|---|
| **IaaS** (máquinas virtuales) | El proveedor da el hardware virtual; nosotros instalamos y parchamos el sistema operativo, Node.js, PostgreSQL, copias de seguridad y escalado. | No: exige administrar servidores, algo que una empresa local pequeña no puede sostener. |
| **PaaS** (plataforma) | El proveedor administra SO, parches, escalado, HTTPS y copias de seguridad; nosotros solo entregamos el contenedor y la configuración. | **Sí** |
| **SaaS** (software terminado) | Se usa una aplicación ya hecha (p. ej. un sistema de facturación en línea). | No para el núcleo, que es software propio. Sí indirectamente: GitHub (repositorio y CI/CD) es SaaS. |

Servicios PaaS usados:

- **Azure Container Apps**: ejecuta las imágenes Docker del frontend y el backend, con réplicas de 1 a 3 según la carga y HTTPS automático.
- **Azure Database for PostgreSQL — Flexible Server**: base de datos gestionada, con copias de seguridad diarias (7 días), parches automáticos y conexión TLS obligatoria.
- **Azure Key Vault**: guarda `JWT_SECRET` y la contraseña de la base de datos.

Kubernetes (carpeta `k8s/`) se usa en local con Minikube o kind para practicar la orquestación. En producción, Container Apps, que funciona sobre Kubernetes administrado por Azure, nos ahorra operar el clúster.

### Desplegar con Terraform

Requisitos: [Terraform](https://developer.hashicorp.com/terraform/install) 1.6 o superior, [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) y las imágenes publicadas en ghcr.io por el CI (paquetes públicos o con acceso configurado).

```bash
az login
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # nombres de las imágenes; aquí no van secretos
terraform init
terraform plan
terraform apply
terraform output url_aplicacion
```

Para eliminar todo y no consumir crédito: `terraform destroy`.

### Manejo de secretos

| Entorno | Dónde viven `JWT_SECRET` y la contraseña de la BD | Qué se versiona |
|---|---|---|
| Desarrollo local | `backend/.env` | `backend/.env.example` (sin valores reales) |
| Docker Compose | `.env` de la raíz, generado con `node scripts/generar-env.js` | `.env.example` |
| Kubernetes | `Secret` creado con `kubectl create secret` | `k8s/secret.example.yaml` (plantilla) |
| Azure | Key Vault; Terraform los genera con `random_password` y las Container Apps los leen con identidad administrada de solo lectura | Nada: ni en `.tf` ni en `.tfvars` |
| GitHub Actions | `GITHUB_TOKEN` automático para publicar imágenes | — |

El estado de Terraform (`terraform.tfstate`) contiene los valores generados, por eso está en `.gitignore`. En equipo se guarda en un backend remoto cifrado (Azure Storage), con el bloque `backend "azurerm"` comentado en `versions.tf`.

## Alcance

El pago es simulado: no se integra pasarela real ni se solicitan datos bancarios. No se incluyen facturación electrónica ni atención al cliente en tiempo real.
