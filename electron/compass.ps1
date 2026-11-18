# Helper kompas untuk Dynamic Island.
# Membaca sensor kompas Windows (Windows.Devices.Sensors.Compass).
# Sensor ini hanya ada di sebagian perangkat (tablet, 2-in-1, beberapa laptop);
# kebanyakan PC desktop tidak punya, dan helper melapor "no_sensor" lalu berhenti.
#
# Keluaran : satu baris JSON per perubahan arah (stdout)
#   { "ok": true,  "heading": 123.4, "accuracy": "high" }   heading = derajat dari utara, searah jarum jam
#   { "ok": false, "error": "no_sensor" | "api_unavailable" }
# Masukan  : tidak ada perintah. Proses berhenti sendiri kalau stdin ditutup (Electron mematikannya).

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Emit($obj) {
    [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 3))
    [Console]::Out.Flush()
}

$sensor = $null
try {
    $null = [Windows.Devices.Sensors.Compass, Windows.Devices.Sensors, ContentType = WindowsRuntime]
    $sensor = [Windows.Devices.Sensors.Compass]::GetDefault()
} catch {
    Emit ([ordered]@{ ok = $false; error = 'api_unavailable' })
    exit 0
}

if ($null -eq $sensor) {
    Emit ([ordered]@{ ok = $false; error = 'no_sensor' })
    exit 0
}

$reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$cmdTask = $reader.ReadLineAsync()

$lastHeading = -999.0
$lastEmit = [DateTime]::MinValue

while ($true) {
    # stdin ditutup = Electron keluar
    if ($cmdTask.IsCompleted -and $null -eq $cmdTask.Result) { break }

    try {
        $r = $sensor.GetCurrentReading()
        if ($null -ne $r) {
            # Utamakan utara sejati; kalau tidak tersedia pakai utara magnetik
            $h = $r.HeadingTrueNorth
            if ($null -eq $h) { $h = $r.HeadingMagneticNorth }
            $h = [double]$h
            $now = [DateTime]::UtcNow

            # Kirim hanya kalau berubah >= 1 derajat, atau paling lama tiap 2 detik
            $diff = [math]::Abs((($h - $lastHeading + 540) % 360) - 180)
            if ($diff -ge 1.0 -or (($now - $lastEmit).TotalSeconds -ge 2)) {
                Emit ([ordered]@{
                    ok       = $true
                    heading  = [math]::Round($h, 1)
                    accuracy = $r.HeadingAccuracy.ToString().ToLower()
                })
                $lastHeading = $h
                $lastEmit = $now
            }
        }
    } catch { }

    Start-Sleep -Milliseconds 100
}
