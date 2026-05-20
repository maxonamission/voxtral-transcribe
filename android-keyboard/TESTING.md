# Voxtral Voice — testhandleiding

Stap-voor-stap, voor wie nieuw is met Android-development. Aangenomen: je
hebt een **Android-telefoon** (Android 9 / API 28 of nieuwer) en wilt
**Android Studio** gebruiken.

> **Eerlijke verwachting**: in de huidige staat draait de IME met een
> **Stub-engine** die een hardcoded tekst ("dit is een teststring uit de stub
> engine. ") streamed alsof het transcriptie is. De echte ExecuTorch +
> Voxtral-wiring (story 027) vereist een Snapdragon-toestel en is nog
> niet device-geverifieerd. Wat je dus kunt testen is: of het toetsenbord
> verschijnt, of de mic werkt, of de tekst correct in een veld komt, of de
> instellingen werken — niet of het correct transcribeert.

## 1. Telefoon klaarzetten — eenmalig (~5 min)

Android verbergt developer-opties standaard. Je moet ze eerst aanzetten en
USB-debugging inschakelen.

1. **Settings** (Instellingen) → scroll naar onderen → **About phone** /
   **Over de telefoon**.
2. Vind **Build number** / **Buildnummer** (vaak onder "Software information").
3. **Tap er 7 keer op**. Je krijgt een telnotificatie en daarna "You are now
   a developer".
4. Ga terug naar Settings → **System** → **Developer options**.
5. Zet **USB debugging** aan.
6. Steek nu een USB-kabel in de telefoon én de laptop. **Belangrijk**:
   gebruik een **data-kabel**, niet een charge-only kabel. (Charge-only
   kabels herken je doordat de telefoon laadt maar de PC niets ziet.)
7. Op de telefoon verschijnt een dialoog **"Allow USB debugging from this
   computer?"** — vink "Always allow" aan en tik **Allow**.

Tip: als de dialoog niet verschijnt, trek de kabel uit en steek hem opnieuw
in. Verschijnt hij dan nog niet, controleer of je in Developer options
**USB debugging** aan staat (#5).

## 2. Android Studio installeren — eenmalig (~30 min, vooral wachten)

1. Ga naar <https://developer.android.com/studio> en download de versie voor
   jouw OS.
2. Installeer met de defaults. Bij eerste start kiest Android Studio
   automatisch de "Standard" setup, downloadt de Android SDK + emulator
   componenten (~3-5 GB). Laat dit z'n gang gaan.
3. Wanneer de welcome-scherm zichtbaar is: kies **Open** (niet "New
   project") en navigeer naar de map
   `voxtral-transcribe/android-keyboard/`.

Studio gaat nu **"Gradle sync"** doen — het downloadt de juiste Android
Gradle Plugin, Kotlin compiler, en al onze dependencies (Compose, OkHttp,
ExecuTorch, etc.). Eerste keer duurt dit 3-10 minuten. Volg de voortgang in
de balk onderaan.

> **Verwacht een paar prompts** rechtsboven om SDK-componenten te installeren
> (zoals "Android 15.0 Platform" en "Android SDK Build-Tools 35.0.0"). Klik
> telkens op de "Install missing platforms"-link en accepteer de licenties.

Als sync succesvol is zie je in de Project-view links:
```
voxtral-voice-keyboard
├── app        (Android IME application)
└── core       (pure Kotlin library)
```

## 3. Telefoon koppelen aan Studio

Bovenin Studio zit een dropdown met "device selector". Als je telefoon goed
gekoppeld is verschijnt hij daar (bijv. "Samsung SM-G990 (Android 14)").

Niet zichtbaar? Open een terminal in Studio (View → Tool Windows →
Terminal) en typ:

```bash
adb devices
```

Verwachte output:
```
List of devices attached
ABC123XYZ    device
```

Als je `unauthorized` ziet: kijk op je telefoon naar de USB-debugging
dialoog (zie stap 1.7).

Geen `adb`? Het zit in `~/Android/Sdk/platform-tools/` (of op macOS
`~/Library/Android/sdk/platform-tools/`). Voeg toe aan je PATH of gebruik
het pad direct.

## 4. App bouwen + installeren

In Android Studio:

1. Selecteer rechtsboven je telefoon in de device-dropdown.
2. Zorg dat naast die dropdown **app** is geselecteerd (niet `core`).
3. Klik op het groene ▶ play-icoon, of druk `Ctrl+R` (macOS: `Cmd+R`).

Studio bouwt nu de debug-APK en installeert die op de telefoon. Duur eerste
keer ~2-3 minuten (cold gradle build). De app **Voxtral Voice** opent
automatisch.

> **Als de build faalt** met "Could not resolve plugin com.android.application"
> of vergelijkbaar: dat betekent dat de SDK-download nog niet compleet is.
> Wacht tot Studio z'n background tasks klaar zijn (balk onderaan), of
> probeer **File → Sync Project with Gradle Files**.

## 5. Onboarding doorlopen op de telefoon

Het scherm dat opent toont drie checklist-stappen:

1. **Activeer Voxtral Voice in Instellingen** — tap de knop.
   Android opent **Settings → Languages & input → Manage keyboards** (of
   vergelijkbaar). Zet de **Voxtral Voice**-switch aan. Android waarschuwt
   dat een 3rd-party IME "may collect all the text you type". Bevestig
   (we sturen niets weg — alles blijft on-device).

2. Ga terug naar de Voxtral Voice-app. De eerste stap heeft nu een ✓.

3. **Kies Voxtral Voice als toetsenbord** — tap de knop. Er verschijnt een
   keyboard-picker met al je geïnstalleerde IME's. Kies **Voxtral Voice**.

4. **Geef toegang tot de microfoon** — tap de knop. Standaard
   permissie-dialoog. Tik **While using the app**.

5. **Download het Voxtral-model** — verschijnt nu. ⚠️ **Dit faalt op dit
   moment**: de URL in `ModelRegistry.kt` is een placeholder (story 036 zet
   de echte hosting op). Negeer voor nu — de IME werkt ook zonder model
   omdat we de Stub-engine gebruiken.

## 6. Het toetsenbord testen

1. Open een tekst-app waar je vrij kunt typen: **Messages**, **Notes**,
   **Chrome adresbalk**, etc.
2. Tik in een tekstveld zodat het toetsenbord verschijnt. Je krijgt waarschijnlijk
   eerst Gboard (of wat je default IME is).
3. Tap op het **toetsenbord-switcher icoon** rechtsonder (lijkt op een
   klein tooltje) of swipe op de spacebar. Kies **Voxtral Voice**.
4. Je ziet nu het Voxtral-toetsenbord: candidate-strip bovenaan, grote
   blauwe mic-knop in het midden, status-regel onderaan ("NL · CPU/NPU"
   afhankelijk van je toestel) en een globe-icoon om terug te wisselen.

### Wat te testen

- **Mic-knop tap** → knop wordt rood, level-meter beweegt mee met je stem.
- **Praat 1-2 seconden** → na ~40 ms verschijnt "dit is een teststring uit
  de stub engine. " als preview (composing text, vaak onderlijnd) in het
  tekstveld.
- **Wacht 700 ms stil** → de tekst wordt definitief in het veld geplaatst
  en de cycle herhaalt. Dit bewijst dat de hele pipeline werkt
  (mic → audio → engine → pipeline → InputConnection).
- **Tap mic-knop opnieuw** → audio stopt, knop wordt blauw, candidate-strip
  toont "Tap de microfoon om te dicteren…".
- **Lange-druk op de mic-knop** → opent de Voxtral Voice instellingen-activity.
- **Tap het globe-icoon rechtsonder** → opent de IME-picker zodat je terug
  kunt naar Gboard.

### Edge cases om te testen

- **Wachtwoordveld** (bijv. een banking-app of de Android Settings →
  Security → Screen lock change-pin): mic-knop dimt, candidate-strip toont
  een melding dat dicteren in wachtwoordvelden geblokkeerd is.
- **Dark mode**: schakel systeem-dark-mode aan (Settings → Display) en
  open het toetsenbord opnieuw — kleuren passen zich aan.
- **Settings**: open Voxtral Voice instellingen (lange-druk mic of via de
  hoofd-app), wissel **Taal NL ↔ EN**, **Backend Auto/NPU/CPU**, en
  **Streaming delay**. NL/EN beïnvloedt welke voice-commands worden
  herkend.

### Wat je *niet* kunt testen (yet)

- **Echte transcriptie**: de stub-engine herhaalt z'n script ongeacht wat
  je zegt. Dit verandert pas als 027 (ExecuTorch JNI) device-geverifieerd
  is.
- **Voice commands** ("nieuwe alinea", "stop opname", etc): de
  CommandMatcher draait wél, maar omdat de stub-tekst nooit een command-
  pattern bevat zul je het effect niet zien. Pas relevant met echte
  transcriptie.
- **Model download**: placeholder URL → 404. Komt goed met story 036.

## 7. Wijzigingen testen (development cycle)

Wanneer je later een wijziging in de code maakt:

1. Sla op met `Ctrl+S` / `Cmd+S`.
2. Klik op ▶ (of `Ctrl+R` / `Cmd+R`). Studio doet een incrementele build —
   meestal 5-15 sec — en herinstalleert. De IME blijft enabled in Android,
   je hoeft alleen het toetsenbord opnieuw te openen om de wijziging te
   zien.

Tip: **Apply Changes** (de blauwe bliksem rechts van ▶) probeert hot-reload
zonder restart — soms werkt het, vaak niet voor IME-services. Bij twijfel:
gewoon ▶ gebruiken.

### Logs lezen

Onderin Studio zit **Logcat**. Filter op `package:io.github.maxonamission.voxtral.keyboard`
om alleen onze logs te zien. Onze tag is `VoxtralIME` (in `KeyboardService.kt`).
Bij elke commit zie je bijvoorbeeld:
```
I/VoxtralIME: commit: dit is een teststring uit de stub engine.
```

## 8. Troubleshooting

| Symptoom | Oplossing |
|---|---|
| Telefoon staat niet in device-dropdown | `adb devices` in terminal; check USB-debugging op telefoon (stap 1) |
| "INSTALL_FAILED_USER_RESTRICTED" | Op telefoon: Settings → Developer options → "Install via USB" aan |
| Voxtral Voice staat niet in keyboard-picker | App geïnstalleerd? Check Settings → Apps → "Voxtral Voice". Daarna stap 5.1 opnieuw |
| Mic-knop reageert niet | Mic-permissie verleend? Settings → Apps → Voxtral Voice → Permissions |
| Geen tekst verschijnt na praten | Check Logcat op `VoxtralIME`. Als je `commit:` regels ziet maar geen tekst: de host-app accepteert geen composing text — probeer Messages/Notes |
| Build faalt op `INSTANTIATION_EXCEPTION` voor KeyboardService | Stub-engine load mislukt? Check Logcat — meestal een import-issue die incrementeel build mist. Rebuild via Build → Clean Project, dan ▶ |
| Status-regel toont "CPU" terwijl je een Snapdragon hebt | Backend-detectie gebruikt `Build.SOC_MANUFACTURER` (API 31+). Op Android 11 of lager valt het terug op heuristieken die kunnen falen. Forceer in Voxtral Voice instellingen → Backend → "Force NPU" |
| Compose-rendering errors in Studio | Studio's Preview is lastig — gewoon de app draaien is betrouwbaarder |

## 9. Wat ik nog graag van jou hoor

Zodra je dit doorlopen hebt, ben ik benieuwd:

- Op welke telefoon (merk + Android-versie)?
- Komt de status-regel correct uit ("NPU" op Snapdragon, "CPU" elders)?
- Werkt de hele cycle (mic → stub-tekst in veld → commit)?
- Welke text-apps werken goed, welke gedragen zich raar?
- Eventuele crashes — stuur dan een Logcat-stuk (kopieer-plak vanuit Studio).

Daarmee weet ik welke device-only stories ik volgende ronde concreet kan
oppakken (027 ExecuTorch wiring vooral).
