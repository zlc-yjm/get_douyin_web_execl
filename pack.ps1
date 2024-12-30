 # 创建临时目录
$tempDir = "douyin_video_extension"
New-Item -ItemType Directory -Force -Path $tempDir

# 复制所有必要文件
Copy-Item "manifest.json" -Destination $tempDir
Copy-Item "popup.html" -Destination $tempDir
Copy-Item "popup.js" -Destination $tempDir
Copy-Item "content.js" -Destination $tempDir
Copy-Item "background.js" -Destination $tempDir
Copy-Item "README.md" -Destination $tempDir
Copy-Item "images" -Destination "$tempDir\images" -Recurse -Force

# 创建zip文件
$date = Get-Date -Format "yyyyMMdd"
$zipFile = "douyin_video_extension_${date}.zip"
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipFile -Force

# 清理临时目录
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "打包完成！生成文件：$zipFile"
Write-Host "请按照以下步骤安装："
Write-Host "1. 打开Chrome浏览器，进入 chrome://extensions/"
Write-Host "2. 开启右上角的"开发者模式""
Write-Host "3. 解压 $zipFile"
Write-Host "4. 点击"加载已解压的扩展程序"，选择解压后的文件夹""