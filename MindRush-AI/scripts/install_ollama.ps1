$ErrorActionPreference = "Stop"

$installerPath = Join-Path $env:TEMP "OllamaSetup.exe"
$url = "https://ollama.com/download/OllamaSetup.exe"

Write-Host "Downloading Ollama installer from $url..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $url -OutFile $installerPath -UseBasicParsing

$fileSize = (Get-Item $installerPath).Length
Write-Host "Download complete: $fileSize bytes" -ForegroundColor Green

Write-Host "Executing silent installation of Ollama..." -ForegroundColor Cyan
$process = Start-Process -FilePath $installerPath -ArgumentList "/silent" -Wait -PassThru

Write-Host "Installer exited with code: $($process.ExitCode)" -ForegroundColor Green

# Refresh Path for current session
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$env:Path = "$userPath;$machinePath;$env:Path"

# Check standard installation locations
$defaultPath = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
if (Test-Path $defaultPath) {
    Write-Host "Ollama binary found at: $defaultPath" -ForegroundColor Green
} else {
    Write-Host "Searching for ollama.exe..." -ForegroundColor Yellow
    Get-ChildItem -Path "$env:LOCALAPPDATA\Programs" -Filter "ollama.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName
}
