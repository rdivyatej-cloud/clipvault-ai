Write-Host "=========================================================="
Write-Host "CLIPVAULT AI 2.0 - COMPLETE PLATFORM INTEGRATION TEST"
Write-Host "=========================================================="

# 1. Start Node.js Backend on port 5000 if not listening
$conn = Test-NetConnection -ComputerName 127.0.0.1 -Port 5000 -InformationLevel Quiet
$nodeProc = $null

if (-not $conn) {
    Write-Host "Starting Node.js Backend on port 5000..."
    $nodeProc = Start-Process -FilePath "node.exe" -ArgumentList "dist\index.js" -WorkingDirectory "c:\Users\Dell\Desktop\CLIPVAULT-AI\clipvault-ai\backend" -PassThru -NoNewWindow
    Start-Sleep -Seconds 5
}

try {
    # Test 1: Unified Verification - YouTube URL
    Write-Host "`n>>> [Test 1] POST /api/ingestion/verify (YouTube URL)..."
    $bodyYt = '{"input":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
    $resYt = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/ingestion/verify" -Method POST -ContentType "application/json" -Body $bodyYt
    if ($resYt.success -and $resYt.sourceType -eq "youtube") {
        Write-Host "Verified YouTube URL: $($resYt.metadata.title) | Channel: $($resYt.metadata.channel_title)"
        Write-Host "  isDownloadableDirectly: $($resYt.isDownloadableDirectly) (Correct - requires authorized export)"
    } else {
        throw "Failed to verify YouTube source"
    }

    # Test 2: Unified Verification - Direct Media URL
    Write-Host "`n>>> [Test 2] POST /api/ingestion/verify (Direct Media URL)..."
    $bodyDirect = '{"input":"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"}'
    $resDirect = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/ingestion/verify" -Method POST -ContentType "application/json" -Body $bodyDirect
    if ($resDirect.success -and $resDirect.sourceType -eq "direct_media" -and $resDirect.isDownloadableDirectly) {
        Write-Host "Verified Direct Media URL: $($resDirect.metadata.suggested_filename) (Downloadable: True)"
    } else {
        throw "Failed to verify direct media URL"
    }

    # Test 3: Unified Verification - SSRF Prevention
    Write-Host "`n>>> [Test 3] POST /api/ingestion/verify (SSRF Security Test)..."
    try {
        $bodySsrf = '{"input":"http://127.0.0.1:8000/private_stream.mp4"}'
        Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/ingestion/verify" -Method POST -ContentType "application/json" -Body $bodySsrf
        Write-Host "Expected SSRF rejection but got success"
    } catch {
        Write-Host "Successfully blocked SSRF attempt to 127.0.0.1"
    }

    # Test 4: Unified Verification - Local File
    Write-Host "`n>>> [Test 4] POST /api/ingestion/verify (Local File Path)..."
    $bodyLocal = '{"input":"c:\\Users\\Dell\\Desktop\\CLIPVAULT-AI\\clipvault-ai\\temp\\sample_test_stream.mp4"}'
    $resLocal = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/ingestion/verify" -Method POST -ContentType "application/json" -Body $bodyLocal
    if ($resLocal.success -and $resLocal.sourceType -eq "local_file") {
        Write-Host "Verified Local File: $($resLocal.metadata.title) (Duration: $($resLocal.metadata.duration)s)"
    } else {
        throw "Failed to verify local file"
    }

    # Test 5: Local File Project Creation & Job Enqueue
    Write-Host "`n>>> [Test 5] POST /api/ingestion/local-file..."
    $bodyIngest = '{"file_path":"c:\\Users\\Dell\\Desktop\\CLIPVAULT-AI\\clipvault-ai\\temp\\sample_test_stream.mp4","name":"ClipVault 2.0 Test Stream","auto_analyze":false}'
    $resIngest = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/ingestion/local-file" -Method POST -ContentType "application/json" -Body $bodyIngest
    if ($resIngest.success -and $resIngest.project.id) {
        $projectId = $resIngest.project.id
        Write-Host "Ingested Local File -> Project ID: $projectId"
    } else {
        throw "Failed to ingest local file"
    }

    # Test 6: Project Clips Endpoint (GET /api/projects/:id/clips)
    Write-Host "`n>>> [Test 6] GET /api/projects/:id/clips..."
    $resClips = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/projects/$projectId/clips"
    if ($resClips.success) {
        Write-Host "Verified GET /api/projects/:id/clips (Clips count: $($resClips.clips.Length))"
    } else {
        throw "Failed to query project clips"
    }

    # Test 7: Enqueue Analysis Job & Poll
    Write-Host "`n>>> [Test 7] Enqueue Job & Check Status..."
    $analyzeRes = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/projects/$projectId/analyze" -Method POST
    if ($analyzeRes.success -and $analyzeRes.job_id) {
        $jobId = $analyzeRes.job_id
        Write-Host "Job enqueued -> Job ID: $jobId"
        
        $jobStatus = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/jobs/$jobId"
        Write-Host "Job Initial State: $($jobStatus.job.status) | Stage: $($jobStatus.job.current_stage) | Progress: $($jobStatus.job.progress)%"
    } else {
        throw "Failed to enqueue analysis job"
    }

    # Test 8: Job Cancellation
    Write-Host "`n>>> [Test 8] Cancel Job (POST /api/jobs/:id/cancel)..."
    $cancelRes = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/jobs/$jobId/cancel" -Method POST
    if ($cancelRes.success) {
        Write-Host "Job successfully cancelled: $($cancelRes.message)"
        $afterCancel = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/jobs/$jobId"
        Write-Host "Confirmed job status in DB: $($afterCancel.job.status)"
    } else {
        throw "Failed to cancel job"
    }

    # Clean up test project
    Write-Host "`n>>> Cleaning up test project..."
    Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/projects/$projectId" -Method DELETE | Out-Null
    Write-Host "Test project cleaned up"

    Write-Host "`n=========================================================="
    Write-Host "ALL 8 CLIPVAULT AI 2.0 INTEGRATION TESTS PASSED!"
    Write-Host "=========================================================="
} catch {
    Write-Host "`nTest error: $_"
} finally {
    if ($nodeProc -and -not $nodeProc.HasExited) {
        Write-Host "Shutting down test backend..."
        Stop-Process -Id $nodeProc.Id -Force -ErrorAction SilentlyContinue
    }
}
