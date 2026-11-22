; macros NSIS personalizadas do Kortex
; customCheckAppRunning: implementação própria da verificação "app em execução".
; Necessária no build em Linux sem wine: o desinstalador é gerado pelo próprio
; instalador (WriteUninstaller) e a implementação de origem (_CHECK_APP_RUNNING)
; chama GetProcessInfo → Call _GetProcessInfo, o que não compila no contexto
; un. quando o desinstalador não é pré-compilado numa passe separada.
!macro customCheckAppRunning
  !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
  ${While} $R0 == 0
    ${If} ${isUpdated}
      Sleep 1000
    ${EndIf}
    DetailPrint `A fechar o "${PRODUCT_NAME}" em execução...`
    nsExec::Exec `taskkill /im "${APP_EXECUTABLE_FILENAME}"`
    Sleep 500
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${If} $R0 == 0
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK
      Pop $0
      ${If} $0 == "IDCANCEL"
        Quit
      ${EndIf}
    ${EndIf}
  ${EndWhile}
!macroend
