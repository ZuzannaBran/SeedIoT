param(
    [string]$InputFile = ".\raporty\raport.docx",
    [string]$OutputDir = ".\raporty",
    [int]$WordTimeoutSec = 120
)

$ErrorActionPreference = 'Stop'

$repoRoot = git rev-parse --show-toplevel 2>$null
if ($repoRoot) {
    Set-Location $repoRoot
}

$inputPath = [System.IO.Path]::GetFullPath($InputFile)
$outputPath = [System.IO.Path]::GetFullPath($OutputDir)

if (-not (Test-Path $inputPath)) {
    throw "Nie znaleziono pliku wejściowego: $inputPath"
}

if (-not (Test-Path $outputPath)) {
    New-Item -ItemType Directory -Path $outputPath | Out-Null
}

$datePart = Get-Date -Format 'yy-MM-dd'
$targetPdf = Join-Path $outputPath "Raport_Z6_$datePart.pdf"
$tempPdf = Join-Path $outputPath 'raport.pdf'

$soffice = Get-Command soffice -ErrorAction SilentlyContinue

if ($soffice) {
    Write-Host "==> Generowanie PDF przez LibreOffice"
    & $soffice.Source --headless --convert-to pdf --outdir $outputPath $inputPath | Out-Host

    if (-not (Test-Path $tempPdf)) {
        throw "LibreOffice nie wygenerował pliku PDF."
    }
}
else {
    Write-Host "==> Generowanie PDF przez Microsoft Word"
    # Word automation can freeze on hidden dialogs (Protected View, add-ins, recovery prompts).
    # Run conversion in an isolated process with a timeout and kill it on hang.
    $workerPath = Join-Path $env:TEMP ("seediot-word-export-{0}.ps1" -f ([guid]::NewGuid().ToString("N")))
    $workerScript = @'
param(
  [string]$InPath,
  [string]$OutPath
)
$ErrorActionPreference = 'Stop'

try { Unblock-File -Path $InPath -ErrorAction SilentlyContinue } catch {}

$word = $null
$document = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.AutomationSecurity = 3

  $document = $word.Documents.Open($InPath, $false, $true)
  $document.ExportAsFixedFormat($OutPath, 17)
}
finally {
  if ($document) {
    try { $document.Close($false) } catch {}
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($document) | Out-Null
  }
  if ($word) {
    try { $word.Quit() } catch {}
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
'@

    Set-Content -LiteralPath $workerPath -Value $workerScript -Encoding UTF8
    $proc = $null
    try {
        $arguments = @(
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', $workerPath,
            '-InPath', $inputPath,
            '-OutPath', $tempPdf
        )
        $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -PassThru -WindowStyle Hidden
        $finished = $proc.WaitForExit($WordTimeoutSec * 1000)

        if (-not $finished) {
            try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
            Get-Process WINWORD -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            throw "Microsoft Word timeout po $WordTimeoutSec s. Zamknieto zawieszone procesy. Otworz raport.docx recznie i potwierdz ewentualne komunikaty Worda, potem uruchom skrypt ponownie."
        }

        if ($proc.ExitCode -ne 0 -or -not (Test-Path $tempPdf)) {
            throw "Microsoft Word nie wygenerowal pliku PDF (ExitCode=$($proc.ExitCode))."
        }
    }
    finally {
        if ($proc -and -not $proc.HasExited) {
            try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
        Remove-Item -LiteralPath $workerPath -Force -ErrorAction SilentlyContinue
    }
}

if (Test-Path $targetPdf) {
    Remove-Item $targetPdf -Force
}

Move-Item $tempPdf $targetPdf -Force
Write-Host "==> Gotowe: $targetPdf"
