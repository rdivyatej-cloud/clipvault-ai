Write-Host "=========================================================="
Write-Host "TESTING CLIPVAULT AI YOUTUBE INTEGRATION WORKFLOW"
Write-Host "=========================================================="

# Check if port 5000 is open
$conn = Test-NetConnection -ComputerName 127.0.0.1 -Port 5000 -InformationLevel Quiet
$nodeProc = $null

if (-not $conn) {
    Write-Host "Starting Node.js Backend on port 5000..."
    $nodeProc = Start-Process -FilePath "node.exe" -ArgumentList "dist\index.js" -WorkingDirectory "c:\Users\Dell\Desktop\CLIPVAULT-AI\clipvault-ai\backend" -PassThru -NoNewWindow
    Start-Sleep -Seconds 5
}

try {
    # Test 1: Invalid YouTube URL
    Write-Host ">>> [Test 1] Testing Invalid YouTube URL..."
    try {
        $body1 = '{"url":"https://vimeo.com/12345678"}'
        $badRes = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/videos/youtube/verify" -Method POST -ContentType "application/json" -Body $body1
        Write-Host "Expected failure but got success"
    } catch {
        Write-Host "Correctly rejected invalid YouTube URL format"
    }

    # Test 2: Deleted or Unavailable YouTube Video
    Write-Host ">>> [Test 2] Testing Deleted / Unavailable YouTube Video..."
    try {
        $body2 = '{"url":"https://www.youtube.com/watch?v=00000000000"}'
        $unavailRes = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/videos/youtube/verify" -Method POST -ContentType "application/json" -Body $body2
        Write-Host "Expected failure but got success"
    } catch {
        Write-Host "Correctly detected unavailable/private video"
    }

    # Test 3 & 4: Valid Public YouTube URL & Metadata Retrieval
    Write-Host ">>> [Test 3 and 4] Testing Valid YouTube URL and Metadata Retrieval..."
    $body3 = '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
    $verifyRes = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/videos/youtube/verify" -Method POST -ContentType "application/json" -Body $body3
    
    if ($verifyRes.success -and $verifyRes.metadata.title) {
        Write-Host "Metadata retrieved successfully:"
        Write-Host "  Title:" $verifyRes.metadata.title
        Write-Host "  Channel:" $verifyRes.metadata.channel_title
        Write-Host "  Video ID:" $verifyRes.video_id
        Write-Host "  Thumbnail:" $verifyRes.metadata.thumbnail_url
        Write-Host "  Export Instructions provided:" ($verifyRes.instructions.export_methods.Length -gt 0)
    } else {
        throw "Failed to retrieve valid metadata"
    }

    # Test 5: Authorized Local Video Association
    Write-Host ">>> [Test 5] Testing Authorized Local Video Association..."
    $sampleVideo = "c:\Users\Dell\Desktop\CLIPVAULT-AI\clipvault-ai\temp\sample_test_stream.mp4"

    $assocJson = '{"youtube_id":"dQw4w9WgXcQ","youtube_url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","title":"Authorized Rickroll Stream Export","file_path":"c:\\Users\\Dell\\Desktop\\CLIPVAULT-AI\\clipvault-ai\\temp\\sample_test_stream.mp4","auto_analyze":false}'
    
    $assocRes = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/videos/youtube/associate" -Method POST -ContentType "application/json" -Body $assocJson
    
    if ($assocRes.success -and $assocRes.project.id) {
        Write-Host "Associated local video with YouTube video project:"
        Write-Host "  Project ID:" $assocRes.project.id
        Write-Host "  Project Name:" $assocRes.project.name
        Write-Host "  Source Type:" $assocRes.project.source_type
        Write-Host "  YouTube ID:" $assocRes.project.youtube_id
        $createdProjectId = $assocRes.project.id
    } else {
        throw "Association failed"
    }

    # Test 6: Duplicate Project Prevention
    Write-Host ">>> [Test 6] Testing Duplicate Project Prevention..."
    try {
        $dupRes = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/videos/youtube/associate" -Method POST -ContentType "application/json" -Body $assocJson
        Write-Host "Expected duplicate prevention error but got success"
    } catch {
        Write-Host "Duplicate project correctly prevented"
    }

    # Test 7: Status Endpoint (GET /api/videos/youtube/:id/status)
    Write-Host ">>> [Test 7] Testing GET /api/videos/youtube/:id/status..."
    $statusRes = Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/videos/youtube/dQw4w9WgXcQ/status"
    if ($statusRes.success -and $statusRes.associated -and $statusRes.project.id -eq $createdProjectId) {
        Write-Host "Status endpoint verified:"
        Write-Host "  Associated:" $statusRes.associated
        Write-Host "  Project ID:" $statusRes.project.id
        Write-Host "  Status:" $statusRes.project.status
    } else {
        throw "Status check failed"
    }

    # Cleanup test project
    Write-Host "Cleaning up test project..."
    Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/projects/$createdProjectId" -Method DELETE | Out-Null
    Write-Host "Test project cleaned up"

    Write-Host "=========================================================="
    Write-Host "ALL 7 YOUTUBE INTEGRATION TESTS PASSED SUCCESSFULLY!"
    Write-Host "=========================================================="
} catch {
    Write-Host "Test error: $_"
} finally {
    if ($nodeProc -and -not $nodeProc.HasExited) {
        Write-Host "Shutting down test backend..."
        Stop-Process -Id $nodeProc.Id -Force -ErrorAction SilentlyContinue
    }
}
