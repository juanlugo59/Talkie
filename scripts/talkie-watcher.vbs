Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c npm run generate --prefix ""F:\Dropbox\Claude Code\Talkie"" -- --watch", 0, False
