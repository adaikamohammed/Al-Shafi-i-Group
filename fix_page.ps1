$file = 'src\app\management\sheikh-monitoring\page.tsx'
$lines = Get-Content $file -Encoding UTF8
# Delete lines 946-1077 (0-indexed: 945-1076)
$keep = $lines[0..944] + $lines[1077..($lines.Length - 1)]
Set-Content $file $keep -Encoding UTF8
Write-Host "Done. Total lines:" $keep.Length
