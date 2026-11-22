<#
.SYNOPSIS
    MindRush AI - Ollama Candidate Model & Environment Verification Script
.DESCRIPTION
    Checks whether Ollama CLI is installed, whether the local daemon is reachable,
    inspects locally installed model tags, inspects candidate model metadata,
    and enforces human approval gates (zero automatic model downloads or pulls).
#>

$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " MindRush AI - Ollama Candidate Model Verification (T002)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Ollama CLI
$defaultOllamaBin = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
if (Test-Path $defaultOllamaBin) {
    $ollamaDir = "$env:LOCALAPPDATA\Programs\Ollama"
    if ($env:Path -notlike "*$ollamaDir*") {
        $env:Path = "$ollamaDir;$env:Path"
    }
}

$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollamaCmd) {
    Write-Host "[FAIL] Ollama CLI ('ollama') was not found in system PATH or LocalAppData." -ForegroundColor Red
    Write-Host "       Please ensure Ollama is installed from https://ollama.com" -ForegroundColor Yellow
    exit 1
} else {
    $versionOutput = & $ollamaCmd.Source --version 2>&1
    Write-Host "[PASS] Ollama CLI detected: $versionOutput" -ForegroundColor Green
    Write-Host "       Binary Path: $($ollamaCmd.Source)" -ForegroundColor Gray
}

# 2. Check Local Daemon Status (Port 11434)
$daemonUrl = "http://127.0.0.1:11434"
Write-Host "`nChecking Ollama daemon connectivity at $daemonUrl..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$daemonUrl/api/tags" -Method Get -TimeoutSec 5 -ErrorAction Stop
    Write-Host "[PASS] Ollama local daemon is ACTIVE and responding." -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Cannot connect to Ollama daemon at $daemonUrl." -ForegroundColor Red
    Write-Host "       Ensure the Ollama service/app is started ('ollama serve')." -ForegroundColor Yellow
    exit 2
}

# 3. Inspect Locally Available Models
Write-Host "`nInspecting installed model tags..." -ForegroundColor Cyan
$installedModels = $response.models
if (-not $installedModels -or $installedModels.Count -eq 0) {
    Write-Host "[WARN] No models are currently installed in the local Ollama instance." -ForegroundColor Yellow
} else {
    Write-Host "Installed models count: $($installedModels.Count)" -ForegroundColor Green
    foreach ($m in $installedModels) {
        $sizeGB = [math]::Round($m.size / 1GB, 2)
        Write-Host " - Name: $($m.name) | Size: ${sizeGB} GB | Quant: $($m.details.quantization_level) | Family: $($m.details.family)" -ForegroundColor Gray
    }
}

# 4. Check for Candidate Model: qwen3.5:4b (or variants)
$candidateTag = "qwen3.5:4b"
$candidateFound = $false
foreach ($m in $installedModels) {
    if ($m.name -eq $candidateTag -or $m.name -like "$candidateTag*") {
        $candidateFound = $true
        $candidateTag = $m.name
        break
    }
}

Write-Host "`nCandidate Model Status ($candidateTag):" -ForegroundColor Cyan
if ($candidateFound) {
    Write-Host "[PASS] Candidate model '$candidateTag' is installed locally." -ForegroundColor Green
    
    # Inspect model details via /api/show
    try {
        $showPayload = @{ name = $candidateTag } | ConvertTo-Json
        $showDetails = Invoke-RestMethod -Uri "$daemonUrl/api/show" -Method Post -Body $showPayload -ContentType "application/json" -TimeoutSec 5
        
        Write-Host "`n--- Model Metadata ---" -ForegroundColor Yellow
        Write-Host "Family:        $($showDetails.details.family)"
        Write-Host "Format:        $($showDetails.details.format)"
        Write-Host "Quantization:  $($showDetails.details.quantization_level)"
        Write-Host "Parameter Size: $($showDetails.details.parameter_size)"
        
        if ($showDetails.license) {
            Write-Host "`n--- License Notice ---" -ForegroundColor Yellow
            $licSnippet = $showDetails.license.Substring(0, [math]::Min(300, $showDetails.license.Length))
            Write-Host $licSnippet
        } else {
            Write-Host "License: [Review external model card / Apache 2.0 / Qwen Community License]" -ForegroundColor Gray
        }
    } catch {
        Write-Host "[WARN] Could not retrieve extended model details: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "[NOTICE] Candidate model '$candidateTag' is NOT installed locally." -ForegroundColor Yellow
    Write-Host "         [GOVERNANCE POLICY]: Auto-download is strictly disabled." -ForegroundColor Magenta
    Write-Host "         Approval is required before downloading or pulling any model." -ForegroundColor Magenta
    Write-Host "         To pull upon explicit user approval: 'ollama pull $candidateTag'" -ForegroundColor Gray
}

# 5. Hardware Suitability Note
Write-Host "`n--- Hardware Suitability Gate ---" -ForegroundColor Cyan
Write-Host "Hardware Profile Target: NVIDIA RTX 3050 Ti Laptop GPU (4 GB VRAM limit)" -ForegroundColor Gray
Write-Host "Rule: Metadata alone does not prove 4 GB VRAM suitability." -ForegroundColor Gray
Write-Host "      Real-world generation load test (T022) with concurrency=1 and context limit 2048" -ForegroundColor Gray
Write-Host "      is required to verify peak VRAM allocation and prevent CUDA out-of-memory." -ForegroundColor Gray

Write-Host "`nVerification complete." -ForegroundColor Green
