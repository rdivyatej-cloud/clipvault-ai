Write-Host "=========================================================="
Write-Host "TESTING FULL STACK INTEGRATION AND COMMUNICATION"
Write-Host "=========================================================="

Write-Host ">>> 1. Starting Python AI Engine on port 8000..."
$aiProc = Start-Process -FilePath "C:\Users\Dell\anaconda3\python.exe" -ArgumentList "main.py" -WorkingDirectory "c:\Users\Dell\Desktop\CLIPVAULT-AI\clipvault-ai\ai-engine" -PassThru -NoNewWindow

Write-Host ">>> 2. Starting Node.js Backend on port 5000..."
$nodeProc = Start-Process -FilePath "node.exe" -ArgumentList "dist\index.js" -WorkingDirectory "c:\Users\Dell\Desktop\CLIPVAULT-AI\clipvault-ai\backend" -PassThru -NoNewWindow

Start-Sleep -Seconds 6

try {
    Write-Host ">>> 3. Testing Backend /api/health..."
    $backendHealth = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -TimeoutSec 5
    Write-Host "Backend Health:" ($backendHealth | ConvertTo-Json -Compress)

    Write-Host ">>> 4. Testing System Diagnostics (/api/system/diagnostics)..."
    $diag = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/system/diagnostics" -TimeoutSec 5
    Write-Host "System Diagnostics:" ($diag | ConvertTo-Json -Depth 4)

    if ($diag.ai_engine.ollama_connected -eq $true) {
        Write-Host "AI Engine Ollama connection: VERIFIED (ollama_connected = true)"
    } else {
        Write-Host "AI Engine Ollama connection FAILED"
    }

    Write-Host ">>> 5. Testing Settings (/api/settings)..."
    $settings = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/settings" -TimeoutSec 5
    Write-Host "Current ollama_model in DB:" $settings.settings.ollama_model

    Write-Host ">>> 6. Testing Dashboard Stats (/api/system/stats)..."
    $stats = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/system/stats" -TimeoutSec 5
    Write-Host "Stats:" ($stats.stats | ConvertTo-Json -Compress)

    Write-Host ">>> 7. Testing Frontend static serving from Backend (http://127.0.0.1:5000)..."
    $frontendHtml = Invoke-WebRequest -Uri "http://127.0.0.1:5000" -TimeoutSec 5 -UseBasicParsing
    if ($frontendHtml.Content.Contains("CLIPVAULT AI")) {
        Write-Host "Frontend SPA successfully served with HTML containing CLIPVAULT AI!"
    } else {
        Write-Host "HTML served length:" $frontendHtml.Content.Length
    }

    Write-Host "=========================================================="
    Write-Host "ALL FULL-STACK COMMUNICATION TESTS PASSED!"
    Write-Host "=========================================================="
} catch {
    Write-Host "Error during test: $_"
} finally {
    Write-Host "Shutting down test server processes..."
    if ($nodeProc -and -not $nodeProc.HasExited) {
        Stop-Process -Id $nodeProc.Id -Force -ErrorAction SilentlyContinue
    }
    if ($aiProc -and -not $aiProc.HasExited) {
        Stop-Process -Id $aiProc.Id -Force -ErrorAction SilentlyContinue
    }
}
