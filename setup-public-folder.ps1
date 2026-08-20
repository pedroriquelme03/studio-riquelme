# Script para criar a pasta public e copiar o ícone
if (-not (Test-Path "public")) {
    New-Item -ItemType Directory -Path "public"
    Write-Host "Pasta public criada"
}

if (Test-Path "icone-dourado.png") {
    Copy-Item "icone-dourado.png" "public\icone-dourado.png" -Force
    Write-Host "Arquivo icone-dourado.png copiado para public/"
} else {
    Write-Host "Arquivo icone-dourado.png não encontrado na raiz"
}

