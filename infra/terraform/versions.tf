terraform {
  required_version = ">= 1.6"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Estado remoto (recomendado): el estado contiene los secretos generados, por eso
  # NO debe quedar en el repositorio ni en un portátil. Crear antes la cuenta de
  # almacenamiento (ver README) y descomentar:
  #
  # backend "azurerm" {
  #   resource_group_name  = "rg-conectanet-tfstate"
  #   storage_account_name = "stconectanettfstate"
  #   container_name       = "tfstate"
  #   key                  = "conectanet.tfstate"
  # }
}

provider "azurerm" {
  # La suscripción se toma de la variable de entorno ARM_SUBSCRIPTION_ID
  # o de "az login" (az account show). Nunca se escribe aquí.
  features {
    key_vault {
      purge_soft_delete_on_destroy = true
    }
  }
}
