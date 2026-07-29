# Behavior Bible — marry-ai.preview.emergentagent.com

## Interactive Behaviors & Trigger Mechanisms

### 1. Header Scroll Elevation
- **Trigger**: Window scroll position > 40px.
- **Behavior**: Nav bar transitions to `background: rgba(251, 246, 236, 0.94)`, `box-shadow: 0 4px 20px rgba(126, 37, 44, 0.08)`, and `border-bottom: 1px solid rgba(200, 162, 83, 0.3)`.

### 2. Tap-to-Open Phone Gate
- **Trigger**: Click / Touch on Wax Seal (`#wax-seal`) or Phone Screen.
- **Behavior**:
  - Plays audio bell chime.
  - Wax seal scales up and fades out (`transform: scale(1.4); opacity: 0`).
  - Left door slides left (`transform: translateX(-100%)`).
  - Right door slides right (`transform: translateX(100%)`).
  - Main invitation content fades up into view.

### 3. Festivity Ritual Gestures
- **Haldi (Rub)**: Mouse drag / Touch swipe over canvas removes yellow turmeric opacity layer via `globalCompositeOperation = 'destination-out'`. At 60% completion, triggers confetti explosion and reveals ceremony details.
- **Mehndi (Trace)**: Mouse drag along heart guide path calculates distance to points. Completing the loop fills henna pattern with gold sparkles.
- **Sangeet (Tap)**: Click / Tap on Dhol drum triggers Web Audio API oscillator synthesis (low punch frequency 120Hz down to 40Hz) and visual scale bounce.
- **Diya (Light)**: Drag flame to lamp wick triggers particle flame bloom and glowing ambient radial gradient.

### 4. Team Bride vs Groom Selector
- **Trigger**: Click on `Team Bride` or `Team Groom` button.
- **Behavior**: Button gains gradient glow, text updates with team message, and 40 colored confetti pieces burst from button center.

### 5. WhatsApp RSVP Generator
- **Trigger**: Click `Send RSVP on WhatsApp`.
- **Behavior**: Form collects guest name, attendance count, and selected ceremonies, formatting an encoded URL string: `https://wa.me/?text=...`.
