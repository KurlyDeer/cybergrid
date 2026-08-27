param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\assets")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function New-CyberGridBitmap([int]$Size) {
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $scale = $Size / 1024.0

  function P([double]$value) { return [single]($value * $scale) }
  function New-Pen([string]$color, [double]$width) {
    $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($color), (P $width))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    return $pen
  }

  $background = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = P 448
  $background.AddArc(0, 0, $diameter, $diameter, 180, 90)
  $background.AddArc((P 576), 0, $diameter, $diameter, 270, 90)
  $background.AddArc((P 576), (P 576), $diameter, $diameter, 0, 90)
  $background.AddArc(0, (P 576), $diameter, $diameter, 90, 90)
  $background.CloseFigure()
  $backgroundBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#0b1220"))
  $graphics.FillPath($backgroundBrush, $background)

  $gridPen = New-Pen "#64748b" 28
  $gridPen.Color = [System.Drawing.Color]::FromArgb(184, $gridPen.Color)
  $graphics.DrawLine($gridPen, (P 224), (P 224), (P 800), (P 224))
  $graphics.DrawLine($gridPen, (P 224), (P 800), (P 800), (P 800))
  $graphics.DrawLine($gridPen, (P 224), (P 224), (P 224), (P 800))
  $graphics.DrawLine($gridPen, (P 800), (P 224), (P 800), (P 800))

  $nodeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#cbd5e1"))
  foreach ($point in @(@(224,224), @(800,224), @(224,800), @(800,800))) {
    $graphics.FillEllipse($nodeBrush, (P ($point[0] - 42)), (P ($point[1] - 42)), (P 84), (P 84))
  }

  $cPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $cPath.StartFigure()
  $cPath.AddLine((P 700), (P 328), (P 492), (P 328))
  $cPath.AddBezier((P 492), (P 328), (P 360), (P 328), (P 278), (P 399), (P 278), (P 512))
  $cPath.AddBezier((P 278), (P 512), (P 278), (P 625), (P 360), (P 696), (P 492), (P 696))
  $cPath.AddLine((P 492), (P 696), (P 700), (P 696))
  $monogramPen = New-Pen "#f8fafc" 72
  $graphics.DrawPath($monogramPen, $cPath)

  $gPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $gPath.AddLine((P 700), (P 512), (P 548), (P 512))
  $gPath.AddLine((P 548), (P 512), (P 548), (P 654))
  $gPath.AddLine((P 548), (P 654), (P 700), (P 654))
  $gPen = New-Pen "#94a3b8" 72
  $graphics.DrawPath($gPen, $gPath)

  $gPen.Dispose(); $gPath.Dispose(); $monogramPen.Dispose(); $cPath.Dispose()
  $nodeBrush.Dispose(); $gridPen.Dispose(); $backgroundBrush.Dispose(); $background.Dispose(); $graphics.Dispose()
  return $bitmap
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$pngPath = Join-Path $OutputDirectory "icon.png"
$icoPath = Join-Path $OutputDirectory "icon.ico"

$master = New-CyberGridBitmap 1024
$master.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$master.Dispose()

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = foreach ($size in $sizes) {
  $bitmap = New-CyberGridBitmap $size
  $stream = [System.IO.MemoryStream]::new()
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  [pscustomobject]@{ Size = $size; Bytes = $stream.ToArray() }
  $stream.Dispose()
}

$file = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$writer = [System.IO.BinaryWriter]::new($file)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$images.Count)
$offset = 6 + (16 * $images.Count)
foreach ($image in $images) {
  $writer.Write([byte]$(if ($image.Size -ge 256) { 0 } else { $image.Size }))
  $writer.Write([byte]$(if ($image.Size -ge 256) { 0 } else { $image.Size }))
  $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$image.Bytes.Length); $writer.Write([uint32]$offset)
  $offset += $image.Bytes.Length
}
foreach ($image in $images) { $writer.Write($image.Bytes) }
$writer.Dispose(); $file.Dispose()

Write-Output "Generated $pngPath"
Write-Output "Generated $icoPath"
