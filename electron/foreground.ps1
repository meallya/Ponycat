# Helper "aplikasi di depan" untuk Dynamic Island.
# Memberi tahu apakah pengguna sedang memakai sebuah aplikasi (Chrome, Explorer, dll.) atau
# sedang berada di desktop kosong.
#
# Keluaran : satu baris JSON setiap status berubah (stdout)
#   { "state": "app" }       ada aplikasi di depan (atau jendela aplikasi lain masih terlihat)
#   { "state": "desktop" }   desktop kosong: tidak ada jendela aplikasi yang terlihat
#   { "ok": false, "error": "api_unavailable" }
# Masukan  : tidak ada perintah. Proses berhenti sendiri kalau stdin ditutup (Electron mematikannya).
# Argumen  : -SelfPid = PID proses Electron; jendela notch sendiri tidak dihitung sebagai aplikasi.

param(
    [int]$SelfPid = 0,
    [int]$IntervalMs = 300
)

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Emit($obj) {
    [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 3))
    [Console]::Out.Flush()
}

$src = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class IslandFg
{
    delegate bool EnumProc(IntPtr h, IntPtr l);

    [StructLayout(LayoutKind.Sequential)]
    struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder sb, int max);
    [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int idx);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int val, int size);

    // Desktop: wallpaper dan ikon desktop
    static readonly HashSet<string> DesktopCls = new HashSet<string>(new string[] {
        "Progman", "WorkerW"
    });

    // Bagian shell Windows (taskbar, menu Start, pencarian, pengalih jendela): bukan "aplikasi"
    static readonly HashSet<string> ShellCls = new HashSet<string>(new string[] {
        "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "TopLevelWindowForOverflowXamlIsland",
        "NotifyIconOverflowWindow", "Windows.UI.Core.CoreWindow", "XamlExplorerHostIslandWindow",
        "MultitaskingViewFrame", "ForegroundStaging", "Shell_InputSwitchTopLevelWindow",
        "TaskListThumbnailWnd", "TaskListOverlayWnd", "Shell_LightDismissOverlay"
    });

    static string Cls(IntPtr h)
    {
        StringBuilder sb = new StringBuilder(256);
        GetClassName(h, sb, 256);
        return sb.ToString();
    }

    static bool IsCloaked(IntPtr h)
    {
        int v;
        return DwmGetWindowAttribute(h, 14, out v, 4) == 0 && v != 0; // DWMWA_CLOAKED
    }

    // Jendela aplikasi sungguhan: terlihat, tidak diminimalkan, bukan jendela alat/overlay,
    // punya judul dan ukuran wajar, dan bukan milik proses notch sendiri.
    static bool IsAppWindow(IntPtr h, uint selfPid)
    {
        if (!IsWindowVisible(h) || IsIconic(h)) return false;
        if (IsCloaked(h)) return false;
        uint pid;
        GetWindowThreadProcessId(h, out pid);
        if (pid == selfPid) return false;
        int ex = GetWindowLong(h, -20);
        if ((ex & 0x80) != 0) return false;        // WS_EX_TOOLWINDOW
        if ((ex & 0x08000000) != 0) return false;  // WS_EX_NOACTIVATE
        if (GetWindowTextLength(h) == 0) return false;
        string c = Cls(h);
        if (DesktopCls.Contains(c) || ShellCls.Contains(c)) return false;
        RECT r;
        if (!GetWindowRect(h, out r)) return false;
        if (r.Right - r.Left < 120 || r.Bottom - r.Top < 60) return false;
        return true;
    }

    // "app" | "desktop" | "self" (jendela notch sendiri di depan: status tidak berubah)
    public static string State(uint selfPid)
    {
        IntPtr fg = GetForegroundWindow();
        if (fg != IntPtr.Zero)
        {
            uint pid;
            GetWindowThreadProcessId(fg, out pid);
            if (pid == selfPid) return "self";
            if (DesktopCls.Contains(Cls(fg))) return "desktop";
            if (IsAppWindow(fg, selfPid)) return "app";
        }

        // Yang di depan taskbar / menu Start / tidak ada apa-apa. Desktop dianggap kosong
        // hanya kalau tidak ada jendela aplikasi lain yang masih terlihat (tidak diminimalkan).
        bool any = false;
        EnumWindows(delegate (IntPtr h, IntPtr l)
        {
            if (IsAppWindow(h, selfPid)) { any = true; return false; }
            return true;
        }, IntPtr.Zero);
        return any ? "app" : "desktop";
    }
}
'@

try {
    Add-Type -TypeDefinition $src -Language CSharp -ErrorAction Stop
} catch {
    Emit ([ordered]@{ ok = $false; error = 'api_unavailable' })
    exit 0
}

$reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput())
$cmdTask = $reader.ReadLineAsync()

$last = ''

while ($true) {
    # stdin ditutup = Electron keluar
    if ($cmdTask.IsCompleted -and $null -eq $cmdTask.Result) { break }

    try {
        $s = [IslandFg]::State([uint32]$SelfPid)
        if ($s -ne 'self' -and $s -ne $last) {
            Emit ([ordered]@{ state = $s })
            $last = $s
        }
    } catch { }

    Start-Sleep -Milliseconds $IntervalMs
}
