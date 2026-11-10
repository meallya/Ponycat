# Helper musik untuk Dynamic Island.
# Membaca Windows media session (SMTC), sama seperti panel media di Windows.
# Semua player yang tampil di panel itu ikut terbaca: Spotify, YouTube / YouTube Music
# di Chrome atau Edge, Windows Media Player, VLC, dll.
#
# Keluaran : satu baris JSON per perubahan (stdout)
# Masukan  : satu perintah per baris (stdin): play-pause | next | prev | vol-up | vol-down | vol-mute
# Proses ini berhenti sendiri kalau stdin ditutup (Electron keluar).

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]

$asTaskOp = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } |
    Select-Object -First 1

# Menunggu operasi async WinRT (maksimal 5 detik)
function Await($op, [Type]$type) {
    try {
        $task = $asTaskOp.MakeGenericMethod($type).Invoke($null, @($op))
        if ($task.Wait(5000)) { return $task.Result }
    } catch { }
    return $null
}

function Emit($obj) {
    [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 4))
    [Console]::Out.Flush()
}

$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
if ($null -eq $manager) {
    Emit ([ordered]@{ hasSession = $false; unsupported = $true })
    exit 0
}

# Utamakan session yang sedang Playing, kalau tidak ada pakai session aktif Windows
function Get-ActiveSession {
    foreach ($s in $manager.GetSessions()) {
        if ($s.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing') { return $s }
    }
    return $manager.GetCurrentSession()
}

function Get-Thumbnail($props) {
    try {
        if ($null -eq $props.Thumbnail) { return $null }
        $ras = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
        if ($null -eq $ras) { return $null }
        $size = [int]$ras.Size
        if ($size -lt 80) { try { $ras.Dispose() } catch {}; return $null }

        # Baca lewat DataReader (lebih andal daripada stream copy)
        $bytes = $null
        try {
            $input = $ras.GetInputStreamAt(0)
            $reader = [Windows.Storage.Streams.DataReader]::new($input)
            $null = Await ($reader.LoadAsync([uint32]$size)) ([uint32])
            $bytes = New-Object byte[] $size
            $reader.ReadBytes($bytes)
            $reader.Dispose()
        } catch {
            # fallback: copy stream
            $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($ras)
            $ms = New-Object System.IO.MemoryStream
            $net.CopyTo($ms)
            $bytes = $ms.ToArray()
            $ms.Dispose()
        }

        $mime = $ras.ContentType
        if (-not $mime -or $mime -eq '') { $mime = 'image/jpeg' }
        try { $ras.Dispose() } catch {}

        if ($null -eq $bytes -or $bytes.Length -lt 80) { return $null }

        # Simpan ke file temp supaya tidak membanjiri stdout JSON (base64 besar)
        $dir = Join-Path $env:TEMP 'dynamic-island-art'
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
        $ext = if ($mime -match 'png') { 'png' } elseif ($mime -match 'webp') { 'webp' } else { 'jpg' }
        $hash = [BitConverter]::ToString([System.Security.Cryptography.SHA1]::Create().ComputeHash($bytes)).Replace('-','').Substring(0,16)
        $path = Join-Path $dir "$hash.$ext"
        if (-not (Test-Path $path)) {
            [System.IO.File]::WriteAllBytes($path, $bytes)
        }
        # path Windows → file URL untuk Electron
        $url = 'file:///' + ($path -replace '\\', '/')
        return $url
    } catch {
        return $null
    }
}

$reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$cmdTask = $reader.ReadLineAsync()

$lastKey = ''
$lastTrackKey = ''
$thumb = $null
$thumbTries = 0
$lastEmit = [DateTime]::MinValue
$force = $false

while ($true) {
    # --- perintah dari Electron ---
    if ($cmdTask.IsCompleted) {
        $line = $cmdTask.Result
        if ($null -eq $line) { break }
        try {
            $cmd = $line.Trim()
            if ($cmd -eq 'vol-up' -or $cmd -eq 'vol-down' -or $cmd -eq 'vol-mute') {
                # Volume sistem (bukan per-app) lewat virtual key
                $shell = New-Object -ComObject WScript.Shell
                if ($cmd -eq 'vol-up')   { $shell.SendKeys([char]175) }
                if ($cmd -eq 'vol-down') { $shell.SendKeys([char]174) }
                if ($cmd -eq 'vol-mute') { $shell.SendKeys([char]173) }
            } else {
                $s = Get-ActiveSession
                if ($null -ne $s) {
                    switch ($cmd) {
                        'play-pause' { [void](Await ($s.TryTogglePlayPauseAsync()) ([bool])) }
                        'next'       { [void](Await ($s.TrySkipNextAsync()) ([bool])) }
                        'prev'       { [void](Await ($s.TrySkipPreviousAsync()) ([bool])) }
                    }
                }
            }
        } catch { }
        $force = $true
        $cmdTask = $reader.ReadLineAsync()
    }

    # --- baca status musik ---
    try {
        $s = Get-ActiveSession
        if ($null -eq $s) {
            if ($lastKey -ne 'none') {
                Emit ([ordered]@{ hasSession = $false })
                $lastKey = 'none'
                $lastTrackKey = ''
                $thumb = $null
            }
        } else {
            $props = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            $status = $s.GetPlaybackInfo().PlaybackStatus.ToString().ToLower()
            $app = [string]$s.SourceAppUserModelId
            $title = [string]$props.Title
            $artist = [string]$props.Artist
            $key = "$app|$title|$artist|$status"
            $trackKey = "$app|$title|$artist"

            if ($trackKey -ne $lastTrackKey) {
                $lastTrackKey = $trackKey
                $thumb = $null
                $thumbTries = 0
            }
            # Cover kadang telat muncul setelah judul berganti, jadi dicoba beberapa kali
            $thumbChanged = $false
            if ($null -eq $thumb -and $thumbTries -lt 20) {
                $thumbTries++
                # ambil props lagi — cover sering telat tersedia
                $props2 = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
                if ($null -ne $props2) { $props = $props2 }
                $thumb = Get-Thumbnail $props
                if ($null -ne $thumb) { $thumbChanged = $true }
            }

            $now = [DateTime]::UtcNow
            # Saat playing: refresh posisi tiap ~1s supaya lirik tidak drift.
            # Saat paused / metadata berubah: tetap emit segera.
            $interval = if ($status -eq 'playing') { 1.0 } else { 5.0 }
            if ($key -ne $lastKey -or $thumbChanged -or $force -or (($now - $lastEmit).TotalSeconds -ge $interval)) {
                $tl = $s.GetTimelineProperties()
                $duration = ($tl.EndTime - $tl.StartTime).TotalSeconds
                $pos = $tl.Position.TotalSeconds
                if ($status -eq 'playing') {
                    $age = ([DateTimeOffset]::UtcNow - $tl.LastUpdatedTime).TotalSeconds
                    if ($age -gt 0 -and $age -lt 21600) { $pos += $age }
                }
                if ($duration -lt 0) { $duration = 0 }
                if ($duration -gt 0 -and $pos -gt $duration) { $pos = $duration }
                if ($pos -lt 0) { $pos = 0 }

                Emit ([ordered]@{
                    hasSession = $true
                    app        = $app
                    title      = $title
                    artist     = $artist
                    album      = [string]$props.AlbumTitle
                    status     = $status
                    position   = [math]::Round($pos, 2)
                    duration   = [math]::Round($duration, 1)
                    thumbnail  = $thumb
                })
                $lastKey = $key
                $lastEmit = $now
                $force = $false
            }
        }
    } catch { }

    Start-Sleep -Milliseconds 250
}
