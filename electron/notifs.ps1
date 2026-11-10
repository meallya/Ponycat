# Baca notifikasi toast Windows (Gmail, WhatsApp, Telegram, dll.)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue

$asTaskOp = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } |
    Select-Object -First 1

function Await($op, [Type]$type) {
    try {
        $task = $asTaskOp.MakeGenericMethod($type).Invoke($null, @($op))
        if ($task.Wait(5000)) { return $task.Result }
    } catch { }
    return $null
}

function Get-TextFromToast($toast) {
    $lines = @()
    try {
        $binding = $toast.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
        if ($null -eq $binding) { return $lines }
        foreach ($el in $binding.GetTextElements()) {
            $txt = [string]$el.Text
            if ($txt -and $txt.Trim()) { $lines += $txt.Trim() }
        }
    } catch {}
    return $lines
}

function Classify-App($displayName, $appId) {
    $n = ("$displayName $appId").ToLowerInvariant()
    if ($n -match 'whatsapp') { return 'whatsapp' }
    if ($n -match 'telegram') { return 'telegram' }
    if ($n -match 'gmail|google\.android\.gm|mail\.google') { return 'gmail' }
    if ($n -match 'outlook|microsoft.?mail|windows.?mail|hxoutlook') { return 'gmail' }
    return 'other'
}

function Emit($obj) {
    $json = $obj | ConvertTo-Json -Compress -Depth 6
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
}

try {
    $null = [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications.Management, ContentType = WindowsRuntime]
} catch {
    Emit ([ordered]@{ ok = $false; error = 'api_unavailable'; items = @() })
    while ($true) { Start-Sleep -Seconds 60 }
}

$listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
$access = Await ($listener.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus])
$accessName = $access.ToString()

if ($accessName -ne 'Allowed') {
    Emit ([ordered]@{
        ok      = $false
        error   = 'access_denied'
        access  = $accessName
        items   = @()
        message = 'Izinkan akses notifikasi di Windows Settings > Privacy > Notifications'
    })
}

$reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$cmdTask = $reader.ReadLineAsync()
$lastSig = ''

while ($true) {
    # perintah: dismiss <id> | clear
    if ($cmdTask.IsCompleted) {
        $line = $cmdTask.Result
        if ($null -eq $line) { break }
        try {
            $parts = $line.Trim() -split '\s+', 2
            $cmd = $parts[0]
            if ($cmd -eq 'dismiss' -and $parts.Count -gt 1) {
                $nid = [uint32]$parts[1]
                $listener.RemoveNotification($nid)
            } elseif ($cmd -eq 'clear') {
                $all = Await ($listener.GetNotificationsAsync([Windows.UI.Notifications.Management.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.Management.UserNotification]])
                foreach ($n in $all) {
                    try { $listener.RemoveNotification($n.Id) } catch {}
                }
            }
        } catch {}
        $cmdTask = $reader.ReadLineAsync()
        $lastSig = '' # force refresh
    }

    try {
        if ($accessName -ne 'Allowed') {
            Start-Sleep -Seconds 5
            $access = Await ($listener.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus])
            $accessName = $access.ToString()
            if ($accessName -ne 'Allowed') {
                Emit ([ordered]@{ ok = $false; error = 'access_denied'; access = $accessName; items = @() })
                Start-Sleep -Seconds 10
                continue
            }
        }

        $all = Await ($listener.GetNotificationsAsync([Windows.UI.Notifications.Management.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.Management.UserNotification]])
        $items = @()
        foreach ($n in $all) {
            try {
                $app = $n.AppInfo
                $display = [string]$app.DisplayInfo.DisplayName
                $appId = [string]$app.AppUserModelId
                $kind = Classify-App $display $appId
                # prioritaskan pesan; tetap tampilkan other agar tidak kosong total
                $texts = Get-TextFromToast $n.Notification
                $from = if ($texts.Count -gt 0) { $texts[0] } else { $display }
                $body = if ($texts.Count -gt 1) { ($texts | Select-Object -Skip 1) -join ' · ' } else { '' }
                $items += [ordered]@{
                    id      = [int64]$n.Id
                    app     = $kind
                    appName = $display
                    appId   = $appId
                    from    = $from
                    body    = $body
                    time    = $n.CreationTime.ToLocalTime().ToString('o')
                }
            } catch {}
        }

        # urutkan: whatsapp/telegram/gmail dulu, lalu terbaru
        $prio = @{ whatsapp = 0; telegram = 1; gmail = 2; other = 3 }
        $items = $items | Sort-Object { $prio[$_.app] }, { $_.time } -Descending

        $sig = ($items | ForEach-Object { "$($_.id):$($_.from)" }) -join '|'
        if ($sig -ne $lastSig) {
            $lastSig = $sig
            Emit ([ordered]@{
                ok    = $true
                access = $accessName
                items = @($items | Select-Object -First 30)
            })
        }
    } catch {
        Emit ([ordered]@{ ok = $false; error = $_.Exception.Message; items = @() })
    }

    Start-Sleep -Milliseconds 1500
}
