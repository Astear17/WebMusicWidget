[CmdletBinding()]
Param()

# Requires Windows 10
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media,ContentType=WindowsRuntime] | Out-Null
$sessionManager = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().GetResults()

if (-not $sessionManager) {
    # If GetResults fails, use reflection for GetAwaiter
    $task = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $awaiter = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'GetAwaiter' })[0].Invoke($null, @($task))
    $sessionManager = $awaiter.GetResult()
}

while ($true) {
    try {
        $session = $sessionManager.GetCurrentSession()
        if ($session) {
            $playback = $session.GetPlaybackInfo()
            $appId = $session.SourceAppUserModelId
            
            $result = @{
                player = $appId
                title = ''
                artist = ''
                state = if ($playback.PlaybackStatus -eq 'Playing') { 0 } elseif ($playback.PlaybackStatus -eq 'Paused') { 1 } else { 2 }
                duration = 0
                position = 0
            }
            
            [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media,ContentType=WindowsRuntime] | Out-Null
            $mediaPropsTask = $session.TryGetMediaPropertiesAsync()
            
            $asTaskMedia = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.ToString() -match 'AsTask.*IAsyncOperation' })[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            $mediaTask = $asTaskMedia.Invoke($null, @($mediaPropsTask))
            $mediaTask.Wait() | Out-Null
            $media = $mediaTask.Result
            
            $result.title = $media.Title
            $result.artist = $media.Artist
            
            $timeline = $session.GetTimelineProperties()
            if ($timeline) {
                $result.position = $timeline.Position.TotalSeconds
                $result.duration = $timeline.EndTime.TotalSeconds
            }
            
            $json = $result | ConvertTo-Json -Compress
            Write-Host $json
        } else {
            Write-Host '{"type":"clear"}'
        }
    } catch {
        Write-Host '{"type":"clear"}'
    }
    
    Start-Sleep -Seconds 1
}
