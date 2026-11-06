# The same smoke test as run.sh, from PowerShell: builds a copy of index.html with test/smoke.js
# appended, runs it in headless Edge, and prints the PASS/FAIL lines.
#   powershell -File test/run.ps1
#   powershell -File test/run.ps1 -Shot parent   # screenshot of test/shot.js's #parent instead (shot.png)
# Edge gets its own profile folder, so it runs even while Edge is open.
param([string]$Shot = '')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot)
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$profileDir = Join-Path $env:TEMP 'spellit-edge-test'
$page = 'smoke-test.html'
$script = if ($Shot) { 'test/shot.js' } else { 'test/smoke.js' }
$out = if ($Shot) { '' } else { '<pre id="out">RUNNING</pre>' }
(Get-Content index.html -Raw -Encoding utf8) -replace '</body>', "$out<script src=`"$script`"></script></body>" | Set-Content -Encoding utf8 $page
$url = "file:///$((Get-Location).Path -replace '\\', '/')/$page"
try {
  if ($Shot) {
    $png = Join-Path (Get-Location) 'shot.png'
    Start-Process $edge -ArgumentList '--headless=new', '--disable-gpu', "--user-data-dir=$profileDir", '--hide-scrollbars',
      '--window-size=820,1180', '--virtual-time-budget=3000', "--screenshot=$png", "$url#$Shot" -Wait
    "Saved $png"
  } else {
    $dom = Join-Path $profileDir 'dom.txt'
    New-Item -ItemType Directory -Force $profileDir | Out-Null
    Start-Process $edge -ArgumentList '--headless=new', '--disable-gpu', "--user-data-dir=$profileDir",
      '--virtual-time-budget=3000', '--dump-dom', $url -RedirectStandardOutput $dom -Wait
    $text = [regex]::Match((Get-Content $dom -Raw), '(?s)<pre id="out">(.*?)</pre>').Groups[1].Value
    [System.Net.WebUtility]::HtmlDecode($text)
    $fails = ($text -split "`n" | Where-Object { $_ -notlike 'PASS*' -and $_.Trim() }).Count
    "$(($text -split "`n" | Where-Object { $_ -like 'PASS*' }).Count) passed, $fails failed"
    if ($fails) { exit 1 }
  }
} finally { Remove-Item $page -ErrorAction SilentlyContinue }
