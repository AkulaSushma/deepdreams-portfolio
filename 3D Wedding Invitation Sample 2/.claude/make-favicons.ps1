Add-Type -AssemblyName System.Drawing
$root = 'D:\3D Antigravity invitation website'
$src = [System.Drawing.Image]::FromFile("$root\assets\stills\logo.png")
Write-Host "Source: $($src.Width)x$($src.Height)"

# Square crop tight on the spiral mark, excluding the DEEPDREAMS wordmark
$cropSize = 340
$cx = 506; $cy = 250
$rx = [int]($cx - $cropSize / 2)
$ry = [Math]::Max(0, [int]($cy - $cropSize / 2))
$rect = New-Object System.Drawing.Rectangle $rx, $ry, $cropSize, $cropSize

$targets = @(
  @{ Size = 512; Name = 'favicon-512.png' },
  @{ Size = 180; Name = 'apple-touch-icon.png' },
  @{ Size = 64;  Name = 'favicon.png' }
)
foreach ($t in $targets) {
  $s = $t.Size
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $dest = New-Object System.Drawing.Rectangle 0, 0, $s, $s
  $g.DrawImage($src, $dest, $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $out = Join-Path "$root\assets\stills" $t.Name
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $($t.Name) ($s x $s)"
}
$src.Dispose()
