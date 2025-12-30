# Script para criar a pasta public e copiar o ícone
if (-not (Test-Path "public")) {
    New-Item -ItemType Directory -Path "public"
    Write-Host "Pasta public criada"
}

if (Test-Path "icone-rosa.png") {
    Copy-Item "icone-rosa.png" "public\icone-rosa.png" -Force
    Write-Host "Arquivo icone-rosa.png copiado para public/"
} else {
    Write-Host "Arquivo icone-rosa.png não encontrado na raiz"
}

