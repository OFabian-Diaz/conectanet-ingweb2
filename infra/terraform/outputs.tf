output "url_aplicacion" {
  description = "URL pública de ConectaNet"
  value       = "https://${azurerm_container_app.frontend.ingress[0].fqdn}"
}

output "postgres_fqdn" {
  description = "Servidor PostgreSQL"
  value       = azurerm_postgresql_flexible_server.db.fqdn
}

output "key_vault" {
  description = "Key Vault que guarda db-password y jwt-secret"
  value       = azurerm_key_vault.kv.name
}

# Los secretos NO se muestran: para consultarlos usar Key Vault
#   az keyvault secret show --vault-name <key_vault> --name jwt-secret --query value -o tsv
