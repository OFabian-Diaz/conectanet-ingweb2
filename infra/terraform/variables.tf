variable "ubicacion" {
  description = "Región de Azure. Las suscripciones de estudiante pueden tener regiones restringidas."
  type        = string
  default     = "eastus2"
}

variable "proyecto" {
  description = "Prefijo para nombrar los recursos"
  type        = string
  default     = "conectanet"
}

variable "imagen_backend" {
  description = "Imagen del backend publicada por GitHub Actions en ghcr.io"
  type        = string
  # Ejemplo: ghcr.io/<usuario>/conectanet-backend:main
}

variable "imagen_frontend" {
  description = "Imagen del frontend publicada por GitHub Actions en ghcr.io"
  type        = string
}

variable "postgres_sku" {
  description = "Tamaño del servidor PostgreSQL (B1ms es el más económico)"
  type        = string
  default     = "B_Standard_B1ms"
}

variable "etiquetas" {
  description = "Etiquetas comunes para todos los recursos"
  type        = map(string)
  default = {
    proyecto   = "ConectaNet"
    curso      = "Ingenieria Web 2 - UMB"
    gestionado = "terraform"
  }
}
