# Sabah Bülteni — yerel sunucu
# Sağ tık → "PowerShell ile çalıştır" veya `pwsh ./serve.ps1`
$ErrorActionPreference = 'Stop'
$port = 8000
$root = $PSScriptRoot

Write-Host "Sabah Bülteni → http://localhost:$port" -ForegroundColor Cyan
Write-Host "Durdurmak için Ctrl+C" -ForegroundColor DarkGray
Write-Host ""

# Python varsa onu kullan (en kolay)
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
if ($py) {
  Set-Location $root
  Start-Process "http://localhost:$port"
  & $py.Source -m http.server $port
  exit
}

# Python yoksa: saf PowerShell HTTP sunucusu
Add-Type -AssemblyName System.Net.Http
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Start-Process "http://localhost:$port"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = [System.Web.HttpUtility]::UrlDecode($ctx.Request.Url.AbsolutePath)
    if ($path -eq '/') { $path = '/index.html' }
    $file = Join-Path $root $path.TrimStart('/')
    if (Test-Path $file -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  }
} finally {
  $listener.Stop()
}
