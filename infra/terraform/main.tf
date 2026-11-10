# Infraestructura de ConectaNet en Azure (modelo PaaS)
#
#   Internet ──HTTPS──► Container App "frontend" (Nginx)  ──/api──► Container App "backend" (interno)
#                                                                        │
#                         Key Vault (JWT_SECRET, DB_PASSWORD) ◄── identidad administrada
#                                                                        │ TLS
#                                                       Azure Database for PostgreSQL (Flexible Server)

data "azurerm_client_config" "actual" {}

# Sufijo aleatorio para nombres que deben ser únicos en todo Azure
resource "random_string" "sufijo" {
  length  = 6
  upper   = false
  special = false
}

locals {
  sufijo = random_string.sufijo.result
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-${var.proyecto}"
  location = var.ubicacion
  tags     = var.etiquetas
}

# ---------------------------------------------------------------------------
# Secretos: los genera Terraform; no se escriben en el código ni en .tfvars
# ---------------------------------------------------------------------------
resource "random_password" "db" {
  length  = 32
  special = false # evita problemas de escape en cadenas de conexión
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "azurerm_key_vault" "kv" {
  name                       = "kv-${var.proyecto}-${local.sufijo}"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  tenant_id                  = data.azurerm_client_config.actual.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = false
  tags                       = var.etiquetas
}

# Quien ejecuta Terraform puede escribir los secretos
resource "azurerm_key_vault_access_policy" "terraform" {
  key_vault_id       = azurerm_key_vault.kv.id
  tenant_id          = data.azurerm_client_config.actual.tenant_id
  object_id          = data.azurerm_client_config.actual.object_id
  secret_permissions = ["Get", "List", "Set", "Delete", "Purge", "Recover"]
}

# Identidad administrada de las Container Apps: solo puede LEER secretos
resource "azurerm_user_assigned_identity" "app" {
  name                = "id-${var.proyecto}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = var.etiquetas
}

resource "azurerm_key_vault_access_policy" "app" {
  key_vault_id       = azurerm_key_vault.kv.id
  tenant_id          = data.azurerm_client_config.actual.tenant_id
  object_id          = azurerm_user_assigned_identity.app.principal_id
  secret_permissions = ["Get"]
}

resource "azurerm_key_vault_secret" "db_password" {
  name         = "db-password"
  value        = random_password.db.result
  key_vault_id = azurerm_key_vault.kv.id
  depends_on   = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "jwt-secret"
  value        = random_password.jwt.result
  key_vault_id = azurerm_key_vault.kv.id
  depends_on   = [azurerm_key_vault_access_policy.terraform]
}

# ---------------------------------------------------------------------------
# Base de datos: Azure Database for PostgreSQL - Flexible Server (PaaS)
# ---------------------------------------------------------------------------
resource "azurerm_postgresql_flexible_server" "db" {
  name                          = "psql-${var.proyecto}-${local.sufijo}"
  location                      = azurerm_resource_group.rg.location
  resource_group_name           = azurerm_resource_group.rg.name
  version                       = "16"
  administrator_login           = "conectanet"
  administrator_password        = random_password.db.result
  sku_name                      = var.postgres_sku
  storage_mb                    = 32768
  backup_retention_days         = 7
  public_network_access_enabled = true
  tags                          = var.etiquetas

  lifecycle {
    ignore_changes = [zone] # Azure asigna la zona; evita cambios en cada plan
  }
}

resource "azurerm_postgresql_flexible_server_database" "conectanet" {
  name      = "conectanet"
  server_id = azurerm_postgresql_flexible_server.db.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Solo servicios de Azure (las Container Apps) pueden conectarse; las conexiones usan TLS.
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure" {
  name             = "permitir-servicios-azure"
  server_id        = azurerm_postgresql_flexible_server.db.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# ---------------------------------------------------------------------------
# Cómputo: Azure Container Apps (contenedores sin administrar servidores)
# ---------------------------------------------------------------------------
resource "azurerm_log_analytics_workspace" "logs" {
  name                = "log-${var.proyecto}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.etiquetas
}

resource "azurerm_container_app_environment" "env" {
  name                       = "cae-${var.proyecto}"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
  tags                       = var.etiquetas
}

resource "azurerm_container_app" "backend" {
  name                         = "backend" # el frontend lo alcanza como http://backend
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"
  tags                         = var.etiquetas

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  # Los valores se leen de Key Vault en tiempo de ejecución con la identidad administrada
  secret {
    name                = "db-password"
    key_vault_secret_id = azurerm_key_vault_secret.db_password.versionless_id
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "jwt-secret"
    key_vault_secret_id = azurerm_key_vault_secret.jwt_secret.versionless_id
    identity            = azurerm_user_assigned_identity.app.id
  }

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "backend"
      image  = var.imagen_backend
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "4000"
      }
      env {
        name  = "DB_DIALECT"
        value = "postgres"
      }
      env {
        name  = "DB_HOST"
        value = azurerm_postgresql_flexible_server.db.fqdn
      }
      env {
        name  = "DB_NAME"
        value = azurerm_postgresql_flexible_server_database.conectanet.name
      }
      env {
        name  = "DB_USER"
        value = azurerm_postgresql_flexible_server.db.administrator_login
      }
      env {
        name  = "DB_SSL"
        value = "true"
      }
      # Proxies delante de la API: ingress del frontend -> Nginx -> ingress interno del backend.
      # Verificar tras el primer despliegue que el límite de login distingue clientes
      # (el aviso ERR_ERL_UNEXPECTED_X_FORWARDED_FOR no debe aparecer en los logs).
      env {
        name  = "TRUST_PROXY"
        value = "3"
      }
      env {
        name        = "DB_PASSWORD"
        secret_name = "db-password"
      }
      env {
        name        = "JWT_SECRET"
        secret_name = "jwt-secret"
      }

      liveness_probe {
        transport = "HTTP"
        port      = 4000
        path      = "/api/salud"
      }

      readiness_probe {
        transport = "HTTP"
        port      = 4000
        path      = "/api/salud/lista"
      }
    }
  }

  ingress {
    external_enabled           = false # solo accesible desde el entorno (vía frontend)
    target_port                = 4000
    allow_insecure_connections = true # tráfico interno del entorno
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  depends_on = [azurerm_key_vault_access_policy.app]
}

resource "azurerm_container_app" "frontend" {
  name                         = "frontend"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"
  tags                         = var.etiquetas

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "frontend"
      image  = var.imagen_frontend
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "BACKEND_URL"
        value = "http://${azurerm_container_app.backend.name}"
      }
    }
  }

  ingress {
    external_enabled = true # HTTPS público con certificado gestionado por Azure
    target_port      = 8080
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}
