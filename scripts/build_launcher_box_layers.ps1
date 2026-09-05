param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$drawingAssemblies = @(
  [System.Drawing.Bitmap].Assembly.Location,
  [System.Drawing.Point].Assembly.Location,
  (Join-Path (Split-Path ([System.Drawing.Bitmap].Assembly.Location) -Parent) 'System.Private.Windows.GdiPlus.dll'),
  (Join-Path (Split-Path ([System.Drawing.Bitmap].Assembly.Location) -Parent) 'System.Private.Windows.Core.dll')
) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -Unique
Add-Type -ReferencedAssemblies $drawingAssemblies -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class LauncherBoxLayerBuilder
{
    private const int Scale = 4;

    private static Bitmap BuildMask(int width, int height, Point[] points, bool dilate)
    {
        using (var large = new Bitmap(width * Scale, height * Scale, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(large))
        {
            graphics.Clear(Color.Transparent);
            graphics.CompositingMode = CompositingMode.SourceCopy;
            graphics.CompositingQuality = CompositingQuality.HighQuality;
            graphics.SmoothingMode = SmoothingMode.AntiAlias;
            graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;

            var scaled = new Point[points.Length];
            for (var index = 0; index < points.Length; index += 1)
            {
                scaled[index] = new Point(points[index].X * Scale, points[index].Y * Scale);
            }

            using (var path = new GraphicsPath())
            {
                path.AddPolygon(scaled);
                graphics.FillPath(Brushes.White, path);
                if (dilate)
                {
                    using (var pen = new Pen(Color.White, 4 * Scale))
                    {
                        pen.LineJoin = LineJoin.Round;
                        graphics.DrawPath(pen, path);
                    }
                }
            }

            var result = new Bitmap(width, height, PixelFormat.Format32bppArgb);
            using (var resultGraphics = Graphics.FromImage(result))
            {
                resultGraphics.Clear(Color.Transparent);
                resultGraphics.CompositingMode = CompositingMode.SourceCopy;
                resultGraphics.CompositingQuality = CompositingQuality.HighQuality;
                resultGraphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                resultGraphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                resultGraphics.DrawImage(large, new Rectangle(0, 0, width, height), 0, 0, large.Width, large.Height, GraphicsUnit.Pixel);
            }
            return result;
        }
    }

    private static Bitmap Composite(Bitmap cover, Bitmap frame)
    {
        var result = new Bitmap(frame.Width, frame.Height, PixelFormat.Format32bppArgb);
        using (var graphics = Graphics.FromImage(result))
        {
            graphics.Clear(Color.Transparent);
            graphics.CompositingMode = CompositingMode.SourceOver;
            graphics.CompositingQuality = CompositingQuality.HighQuality;
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            graphics.DrawImage(cover, 0, 0, result.Width, result.Height);
            graphics.DrawImage(frame, 0, 0, result.Width, result.Height);
        }
        return result;
    }

    private static Bitmap ApplyMask(Bitmap source, Bitmap mask, bool invert)
    {
        var sourceRect = new Rectangle(0, 0, source.Width, source.Height);
        var output = source.Clone(sourceRect, PixelFormat.Format32bppArgb);
        var sourceData = output.LockBits(sourceRect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var maskData = mask.LockBits(sourceRect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            var sourceBytes = new byte[Math.Abs(sourceData.Stride) * source.Height];
            var maskBytes = new byte[Math.Abs(maskData.Stride) * mask.Height];
            Marshal.Copy(sourceData.Scan0, sourceBytes, 0, sourceBytes.Length);
            Marshal.Copy(maskData.Scan0, maskBytes, 0, maskBytes.Length);

            for (var y = 0; y < source.Height; y += 1)
            {
                var sourceRow = y * Math.Abs(sourceData.Stride);
                var maskRow = y * Math.Abs(maskData.Stride);
                for (var x = 0; x < source.Width; x += 1)
                {
                    var sourceOffset = sourceRow + x * 4;
                    var maskOffset = maskRow + x * 4;
                    var maskAlpha = maskBytes[maskOffset + 3];
                    if (invert) maskAlpha = (byte)(255 - maskAlpha);
                    var alpha = (sourceBytes[sourceOffset + 3] * maskAlpha + 127) / 255;
                    if (alpha <= 2) alpha = 0;
                    sourceBytes[sourceOffset + 3] = (byte)alpha;
                    if (alpha == 0)
                    {
                        sourceBytes[sourceOffset] = 0;
                        sourceBytes[sourceOffset + 1] = 0;
                        sourceBytes[sourceOffset + 2] = 0;
                    }
                }
            }

            Marshal.Copy(sourceBytes, 0, sourceData.Scan0, sourceBytes.Length);
        }
        finally
        {
            output.UnlockBits(sourceData);
            mask.UnlockBits(maskData);
        }
        return output;
    }

    public static void Build(string coverPath, string framePath, string lidPath, string shellPath, Point[] points)
    {
        using (var cover = new Bitmap(coverPath))
        using (var frame = new Bitmap(framePath))
        {
            if (cover.Width != frame.Width || cover.Height != frame.Height)
                throw new InvalidOperationException("Cover and frame dimensions do not match.");

            using (var frontMask = BuildMask(frame.Width, frame.Height, points, false))
            using (var shellCutMask = BuildMask(frame.Width, frame.Height, points, true))
            using (var combined = Composite(cover, frame))
            using (var lid = ApplyMask(combined, frontMask, false))
            using (var shell = ApplyMask(frame, shellCutMask, true))
            {
                lid.Save(lidPath, ImageFormat.Png);
                shell.Save(shellPath, ImageFormat.Png);
            }
        }
    }
}
'@

$assetRoot = Join-Path $ProjectRoot 'public\images\game_launcher'
$games = @(
  @{
    Id = 'card'
    Cover = 'launcher_card_cover_perspective_v2.png'
    Frame = 'launcher_card_box_frame_cutout_v1.png'
    Points = @(@(50, 133), @(935, 162), @(930, 1360), @(50, 1295))
  },
  @{
    Id = 'board'
    Cover = 'launcher_board_cover_logo_perspective_v5.png'
    Frame = 'launcher_board_box_frame_cutout_v1.png'
    Points = @(@(43, 109), @(939, 142), @(932, 1350), @(43, 1289))
  },
  @{
    Id = 'chess'
    Cover = 'launcher_chess_cover_logo_perspective_v5.png'
    Frame = 'launcher_chess_box_frame_cutout_v1.png'
    Points = @(@(47, 110), @(938, 142), @(932, 1400), @(47, 1337))
  }
)

foreach ($game in $games) {
  $coverPath = Join-Path $assetRoot $game.Cover
  $framePath = Join-Path $assetRoot $game.Frame
  $lidPath = Join-Path $assetRoot ("launcher_{0}_lid_front_panel_v1.png" -f $game.Id)
  $shellPath = Join-Path $assetRoot ("launcher_{0}_box_shell_fixed_v1.png" -f $game.Id)
  foreach ($path in @($coverPath, $framePath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing source asset: $path" }
  }
  foreach ($path in @($lidPath, $shellPath)) {
    if ((Test-Path -LiteralPath $path) -and -not $Force) { throw "Output already exists (use -Force to rebuild): $path" }
  }

  $points = foreach ($point in $game.Points) { [System.Drawing.Point]::new($point[0], $point[1]) }
  [LauncherBoxLayerBuilder]::Build($coverPath, $framePath, $lidPath, $shellPath, $points)
  Write-Output ("BUILT {0}: {1}, {2}" -f $game.Id, (Split-Path $lidPath -Leaf), (Split-Path $shellPath -Leaf))
}
