# KG-Visualizer

Interaktiver Visualizer für Kontextfreie Grammatikern (CFGs) und Transformationen in die Chomsky Normal Form (CNF)

Hier kommst du direkt zur Web-Applikation:
https://github.com/BonsaiFicus/kg-visualizer

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Build](https://img.shields.io/badge/build-passing-success.svg)

## Features

- **Interaktiver Grammar Input**: Definiere deine CFG mit einem intuitiven Text interface
- **Step-by-Step Analyse**: Betrachte die Transformation im Detail
- **Automatische Suche nach produktiven Variablen**: automatische Identifikation von Produktiven Produktionen
- **CNF Transformation**: Gesamte Pipeline von CFG zu CNF
  - Epsilon-Eliminierung
  - Entfernen von Unit-Produktionen
  - Isolation von Terminalen
  - Binäre Kaskadierung (Aufspalten langer Produktionen)
- **Visualisierung durch Graphen**: Betrachte deine Grammatik als gerichteten Graphen
- **Eigenschaften der Sprachen erkennen**: Automatische Erkennung der Eigenschaften LEERE und ENDLICHKEIT

## Eigeninitiative

Hilf mir gerne dabei, meinen Code zu verbessern und zu erweitern! Beachte aber, dass die [LICENSE](LIZENZ) in stets drinnen bleibt.

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## User-Manual

1. Gebe in die linke Sidebar deine CFG-Grammatik ein oder nutze folgende Beispielgrammatik,
(click hierfür auf **"Beispiel laden"**):
```
S -> A | B | CD
A -> B | A | bCb
B -> S | c
C -> cC | eps
D -> dD | eps
```

2. Drücke auf **"Analysieren"**, um mit der Analyse zu beginnen
(Alternativ kannst du auf **"Ergebnis"** drücken, um direkt zum letzten Schritt zu springen)
3. Nutze die Controls im Footer, um durch die Transformation zu springen
4. Du kannst nähere Informationen zu dem Schritt auf der rechten Sidebar finden und jederzeit zwischen CNF und dem originalen Canvas springen. Drücke hierfür im Header auf **"ORIGINAL/CNF"**.

## Tech Stack

- **React 19** - UI Framework
- **Vite** - Build Tool & Dev Server
- **Canvas API** - Graph Rendering
- **Pure CSS** - Styling (keine frameworks)

## Projektstruktur

```
src/
├── components/      # UI Komponenten
├── algorithm/       # Kernalgorithmen
│   ├── visualization/  # Step generation
│   ├── rendering/      # Zeichenlogik
│   └── logging/        # UI helpers und Info-Logik
├── controls/        # Viewport & interaction controls
└── styles/          # CSS stylesheets
```

## Sicherheit

Diese Applikation ist **100%-client-sided** und bei Nutzung vollkommen sicher:
- Keine Code-executions durch Textfeld (nur String-parsing)
- Kein Backend und keine Datenbanken
- Nutzung von React auto-escaping
- Nutzer sind isoliert voneinender (pro Session)

## Formalitäten

MIT License - siehe [LICENSE](LIZENZ) für mehr Details



Gebaut im Rahmen einer Projektarbeit über formale Sprachen und Automatentheorie

---

Made with ❤️ using React + Vite

