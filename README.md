# ConectaNet

Plataforma web para una empresa local de internet y televisión: consulta de planes, registro e inicio de sesión, visualización del plan contratado y pago mensual simulado.

Proyecto de curso — Ingeniería Web 2, Universidad Manuela Beltrán.
Integrantes: Manuel Osorio Feo, Oscar Fabián Forero Díaz.

| Versión | Contenido |
|---|---|
| `v1.0.0` — Corte 1 | API REST, JWT, Sequelize, OWASP, React, Swagger, Postman |
| `v2.0.0` — Corte 2 | GitFlow, Docker, CI/CD, Kubernetes, Terraform (Azure), Prometheus y Grafana |

## Estructura

```
conectanet/
├── backend/                     API REST (Node.js + Express + Sequelize)
│   ├── Dockerfile               Imagen de producción (no root, healthcheck)
│   ├── src/
│   │   ├── app.js               Express, helmet, CORS, Swagger, /metrics, rutas, errores
│   │   ├── server.js            Arranque: conexión BD, sync y siembra de planes
│   │   ├── config.js            Variables de entorno
│   │   ├── metricas.js          Métricas Prometheus (prom-client)
│   │   ├── seed.js              Crea tablas y planes de ejemplo (también es el Job de Kubernetes)
│   │   ├── models/index.js      Usuario, Plan, Suscripcion, Pago y relaciones
│   │   ├── middleware/          auth.js (JWT), validar.js (express-validator)
│   │   ├── routes/              auth, planes, usuarios, pagos
│   │   └── docs/openapi.yaml    Especificación OpenAPI 3.0
│   └── tests/api.test.js        21 pruebas de integración (node --test + supertest)
├── frontend/                    React + Vite; Dockerfile multietapa con Nginx
├── postman/                     Colección Postman con scripts de prueba
├── docker-compose.yml           db + backend + frontend + Prometheus + Grafana
├── monitoreo/                   Configuración de Prometheus (alertas) y Grafana (dashboard)
├── k8s/                         Manifiestos de Kubernetes (Minikube / kind)
├── infra/terraform/             Infraestructura en Azure
├── .github/workflows/ci.yml     CI/CD con GitHub Actions
└── scripts/generar-env.js       Genera .env con secretos aleatorios
```

## Cómo ejecutarlo

### Opción 1 — Docker Compose (recomendada)

Requisitos: Docker Desktop (o Docker Engine con Compose v2) y Node.js para generar los secretos.

```bash
node scripts/generar-env.js        # crea .env con secretos aleatorios (no se versiona)
docker compose up -d --build
docker compose ps                  # db, backend y frontend deben aparecer "healthy"
```

| Servicio | URL | Publicado |
|---|---|---|
| Aplicación (Nginx + React) | http://localhost:8080 | Sí (único puerto de la app) |
| Swagger | http://localhost:8080/api/docs | A través de Nginx |
| Grafana | http://localhost:3000 (usuario `admin`, clave `GRAFANA_ADMIN_PASSWORD` del `.env`) | Solo en 127.0.0.1 |
| Prometheus | http://localhost:9090 | Solo en 127.0.0.1 |
| Backend y PostgreSQL | — | No: solo en redes internas |

Los datos de PostgreSQL, Prometheus y Grafana persisten en los volúmenes `pgdata`, `prometheusdata` y `grafanadata`. Para detener todo: `docker compose down`. Para borrar también los datos: `docker compose down -v`.

Redes: `frontend` (Nginx ↔ backend), `backend` (backend ↔ PostgreSQL, marcada `internal`, sin salida a internet) y `monitoreo` (Prometheus ↔ backend ↔ Grafana).

### Opción 2 — Kubernetes local (Minikube o kind)

Requisitos: `kubectl`, Docker y Minikube **o** kind.

```bash
# 1. Construir las imágenes
docker build -t conectanet-backend:latest ./backend
docker build -t conectanet-frontend:latest ./frontend

# 2a. Minikube
minikube start
minikube image load conectanet-backend:latest
minikube image load conectanet-frontend:latest

# 2b. o kind (publica el NodePort 30080 en localhost:8080)
kind create cluster --name conectanet --config k8s/kind-config.yaml
kind load docker-image conectanet-backend:latest conectanet-frontend:latest --name conectanet

# 3. Secret (con los valores del .env; nunca se escribe en un archivo del repo)
kubectl create namespace conectanet
kubectl create secret generic conectanet-secretos -n conectanet \
  --from-literal=DB_PASSWORD="<POSTGRES_PASSWORD del .env>" \
  --from-literal=JWT_SECRET="<JWT_SECRET del .env>"

# 4. Desplegar todo
kubectl apply -k k8s/
kubectl get pods -n conectanet -w

# 5. Abrir la aplicación
minikube service frontend -n conectanet     # Minikube
# kind: http://localhost:8080
```

| Objeto | Archivo | Función |
|---|---|---|
| Namespace | `namespace.yaml` | Aísla los recursos de ConectaNet |
| ConfigMap | `configmap.yaml` | Configuración no sensible (host de BD, puerto, `DB_SYNC=false`) |
| Secret | `secret.example.yaml` (plantilla) | `DB_PASSWORD` y `JWT_SECRET`, creado con `kubectl` |
| StatefulSet + Service headless | `postgres.yaml` | PostgreSQL con un volumen persistente de 1 Gi |
| Job | `migracion-job.yaml` | Crea tablas y planes una sola vez (evita carreras entre réplicas) |
| Deployment + Service ClusterIP | `backend.yaml` | 2 réplicas, sondas liveness/readiness, límites y usuario no root |
| Deployment + Service NodePort | `frontend.yaml` | 2 réplicas de Nginx expuestas en el puerto 30080 |

La sonda de *readiness* (`/api/salud/lista`) consulta la base de datos, así el backend no recibe tráfico hasta que el Job termine de crear las tablas. La de *liveness* (`/api/salud`) no toca la base, para que una caída de PostgreSQL no reinicie los pods de la API.

### Opción 3 — Desarrollo sin Docker

Requisitos: Node.js 20 o superior. PostgreSQL es opcional en desarrollo (se puede usar SQLite).

**Base de datos.** Opción A: PostgreSQL, instalado a mano con una base `conectanet` y un usuario con contraseña. Opción B: SQLite, sin instalar nada; Sequelize usa el mismo código para ambos motores.

#### Backend

```bash
cd backend
cp .env.example .env      # en Windows: copy .env.example .env
npm install
npm start                 # http://localhost:4000  ·  Swagger: http://localhost:4000/api/docs
```

En `.env` ajusta `DB_DIALECT` (`postgres` o `sqlite`), `DATABASE_URL` (o `DB_HOST`, `DB_USER`, `DB_PASSWORD`…) y un `JWT_SECRET` largo y aleatorio:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Al arrancar se crean las tablas y 5 planes de ejemplo si la tabla está vacía.

#### Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173 (reenvía /api al backend)
```

### Pruebas

```bash
cd backend
npm test                  # 21 pruebas; usa SQLite en memoria, no toca tu base de datos
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
| A05 Configuración insegura | `helmet` (cabeceras de seguridad), sin `X-Powered-By`, errores sin trazas internas, `.env` fuera del control de versiones; contenedores sin root y base de datos en red interna. | `app.js`, `.gitignore`, `Dockerfile`, `docker-compose.yml` |
| A06 Componentes vulnerables | `npm audit` en cada ejecución del CI. | `ci.yml` |
| A09 Registro y monitoreo | Métricas de errores y logins fallidos con alertas en Prometheus. | `metricas.js`, `alertas.yml` |

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

## Integración y entrega continua (GitHub Actions)

El workflow `.github/workflows/ci.yml` se ejecuta en cada *push* (a `main`, `develop`, `feature/*`, `release/*` y `hotfix/*`) y en cada *pull request* hacia `main` o `develop`:

| Trabajo | Qué hace |
|---|---|
| **Backend - pruebas** | `npm ci`, `npm test` (21 pruebas) y `npm audit` de dependencias de producción (falla si hay vulnerabilidades altas, OWASP A06) |
| **Frontend - build** | `npm ci` y `npm run build` |
| **Terraform y Kubernetes** | `terraform fmt -check`, `terraform validate` y `kubeconform` sobre `k8s/` contra los esquemas oficiales |
| **Imágenes Docker** | Valida `docker-compose.yml` y construye las imágenes de backend y frontend (con caché). Solo se ejecuta si los tres trabajos anteriores pasan. |
| **Publicación (CD)** | En *push* a `main` o `develop`, sube las imágenes a `ghcr.io/<usuario>/conectanet-{backend,frontend}` con etiquetas por rama, por *commit* (`sha-…`) y `latest` en `main`. |

Si se protegen `main` y `develop` exigiendo que el CI pase, ningún cambio que rompa las pruebas llega a esas ramas.

## Monitoreo (Prometheus y Grafana)

El backend expone `GET /metrics` en formato Prometheus con `prom-client`:

| Métrica | Tipo | Para qué sirve |
|---|---|---|
| `http_requests_total{metodo,ruta,estado}` | Contador | Tráfico y errores por endpoint |
| `http_request_duration_seconds{metodo,ruta,estado}` | Histograma | Latencia (p50, p95, p99) |
| `conectanet_registros_total` | Contador | Usuarios nuevos |
| `conectanet_logins_total{resultado}` | Contador | Inicios de sesión exitosos/fallidos (detección de fuerza bruta) |
| `conectanet_pagos_total{metodo}` | Contador | Pagos aprobados por método |
| `conectanet_recaudo_pesos_total` | Contador | Dinero recaudado (COP) |
| `process_*`, `nodejs_*` | Varias | CPU, memoria, event loop y GC de Node.js |

La etiqueta `ruta` usa la plantilla de Express (`/api/pagos/historial`) y no la URL real, para no crear una serie por cada valor distinto. `/metrics` está fuera de `/api`, así que Nginx no lo publica: solo Prometheus lo lee por la red interna `monitoreo`.

**Prometheus** (`monitoreo/prometheus/`) lee la API cada 15 s y evalúa cuatro alertas: backend caído, más del 5 % de errores 5xx, latencia p95 mayor a 1 s y más de 30 logins fallidos en 5 minutos.

**Grafana** arranca con el datasource y el dashboard **ConectaNet - API** ya provisionados:
- **Indicadores del negocio:** registros, pagos, recaudo y logins fallidos.
- **API:** peticiones por ruta, respuestas por código, latencia por percentiles y tasa de errores.
- **Negocio en el tiempo:** pagos por método e inicios de sesión.
- **Proceso Node.js:** memoria, CPU y retraso del event loop.

En Kubernetes, los pods del backend llevan las anotaciones `prometheus.io/scrape` para que un Prometheus instalado en el clúster los descubra automáticamente.

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
