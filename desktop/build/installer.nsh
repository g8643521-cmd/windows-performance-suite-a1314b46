; ============================================================
; NOVYX - Custom NSIS installer script
; Viser en NOVYX-branded menu ved opstart hvor brugeren
; kan vælge mellem at installere, geninstallere eller afinstallere.
; ============================================================

!macro customInit
  ; Prøv at finde en eksisterende installation
  ReadRegStr $R0 HKLM "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
  ${If} $R0 == ""
    ReadRegStr $R0 HKCU "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
  ${EndIf}

  ${If} $R0 != ""
    ; NOVYX er allerede installeret → tilbyd valg
    MessageBox MB_YESNOCANCEL|MB_ICONQUESTION \
      "NOVYX er allerede installeret på denne computer.$\r$\n$\r$\n\
Vil du geninstallere / opdatere?$\r$\n$\r$\n\
   • Ja   = Geninstaller / opdater NOVYX$\r$\n\
   • Nej  = Afinstaller NOVYX$\r$\n\
   • Annuller = Afslut uden ændringer" \
      /SD IDYES IDYES novyx_continue IDNO novyx_uninstall
      Quit

    novyx_uninstall:
      ; Fjern anførselstegn omkring UninstallString og kør stille
      StrCpy $R1 $R0 1
      ${If} $R1 == '"'
        StrCpy $R0 $R0 "" 1
        StrCpy $R2 0
        ${Do}
          StrCpy $R1 $R0 1 $R2
          ${If} $R1 == '"'
            StrCpy $R0 $R0 $R2
            ${ExitDo}
          ${EndIf}
          IntOp $R2 $R2 + 1
        ${Loop}
      ${EndIf}
      ExecWait '"$R0" /S _?=$INSTDIR'
      Quit

    novyx_continue:
  ${EndIf}
!macroend
