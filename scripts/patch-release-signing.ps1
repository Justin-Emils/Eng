<#
  给 android/app/build.gradle 打"正式签名"补丁（P0-3）。

  为什么需要补丁脚本:`expo prebuild` 每次都会**重新生成** android/ 目录,
  直接改 build.gradle 会在下次打包时被覆盖。所以把改动写成幂等脚本,
  在 prebuild 之后、gradle 之前跑一次。

  密钥与密码放在 `.artifacts/signing/`(已被 .gitignore 忽略),**不进仓库**。
  没有 keystore.properties 时自动回退到 debug 签名 —— 脚本本身不会让构建失败。

  用法:powershell -NoProfile -ExecutionPolicy Bypass -File scripts\patch-release-signing.ps1
#>
$ErrorActionPreference = 'Stop'

$repo = Split-Path $PSScriptRoot -Parent
$gradle = Join-Path $repo 'android\app\build.gradle'
$propsFile = Join-Path $repo '.artifacts\signing\keystore.properties'

if (-not (Test-Path $gradle)) {
  Write-Output "[skip] 没有 android/app/build.gradle(先跑 prebuild)"
  exit 0
}

$text = [System.IO.File]::ReadAllText($gradle)
$marker = '[release-signing]'

if ($text.Contains($marker)) {
  Write-Output '[ok] 已经打过补丁,跳过'
  exit 0
}

# ① 在 android { 之前加载 signing 配置
$propsBlock = @'
// [release-signing] 正式签名配置:密钥不进仓库(见 scripts/patch-release-signing.ps1)
def keystorePropsFile = rootProject.file("../.artifacts/signing/keystore.properties")
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) {
    keystoreProps.load(new FileInputStream(keystorePropsFile))
}

'@ -replace "`r`n", "`n"

$androidIdx = $text.IndexOf("android {")
if ($androidIdx -lt 0) {
  Write-Output '[fail] 找不到 android { 块'
  exit 1
}
$text = $text.Insert($androidIdx, $propsBlock)

# ② 在 signingConfigs { 里加 release 配置
$signingIdx = $text.IndexOf('signingConfigs {')
if ($signingIdx -lt 0) {
  Write-Output '[fail] 找不到 signingConfigs 块'
  exit 1
}
$insertAt = $text.IndexOf("`n", $signingIdx) + 1
$releaseBlock = @'
        // [release-signing]
        release {
            if (keystorePropsFile.exists()) {
                storeFile new File(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
'@ -replace "`r`n", "`n"
$text = $text.Insert($insertAt, $releaseBlock + "`n")

# ③ 把 release 构建类型的签名换成"有配置就用 release,否则 debug"
$buildTypesIdx = $text.IndexOf('buildTypes {')
$releaseTypeIdx = $text.IndexOf('release {', $buildTypesIdx)
if ($releaseTypeIdx -lt 0) {
  Write-Output '[fail] 找不到 buildTypes 里的 release {'
  exit 1
}
$debugSigningIdx = $text.IndexOf('signingConfig signingConfigs.debug', $releaseTypeIdx)
if ($debugSigningIdx -lt 0) {
  Write-Output '[fail] 找不到 release 里的 signingConfig 行'
  exit 1
}
$lineEnd = $text.IndexOf("`n", $debugSigningIdx)
$replacement = 'signingConfig keystorePropsFile.exists() ? signingConfigs.release : signingConfigs.debug  // [release-signing]'
$text = $text.Remove($debugSigningIdx, $lineEnd - $debugSigningIdx).Insert($debugSigningIdx, $replacement)

[System.IO.File]::WriteAllText($gradle, $text, (New-Object System.Text.UTF8Encoding($false)))

if (Test-Path $propsFile) {
  Write-Output '[ok] 已打补丁,将使用**正式签名**(keystore.properties 存在)'
} else {
  Write-Output '[ok] 已打补丁,但没找到 keystore.properties → 仍回退 debug 签名'
}
