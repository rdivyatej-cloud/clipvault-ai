$proc = Start-Process -FilePath "C:\Users\Dell\anaconda3\python.exe" -ArgumentList "main.py" -WorkingDirectory "c:\Users\Dell\Desktop\CLIPVAULT-AI\clipvault-ai\ai-engine" -PassThru -NoNewWindow
Start-Sleep -Seconds 4
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 5
    Write-Host "HEALTH_RESULT:"
    $res | ConvertTo-Json
} catch {
    Write-Host "HEALTH_ERROR: $_"
} finally {
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}

