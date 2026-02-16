# 🎓 ChessCoach AI — Setup Guide (Windows)

Welcome! This guide will walk you through getting the app running on your Windows computer. Follow each step in order — I've written this assuming you've never done this before.

---

## Step 1: Install Node.js

Node.js is the engine that powers your app. Think of it like installing the engine before you can drive a car.

1. Open your browser and go to: **https://nodejs.org**
2. Click the big green **LTS** button (the one that says "Recommended For Most Users")
3. Run the downloaded `.msi` installer
4. **Click "Next" on every screen** — the default settings are perfect
5. ✅ **Make sure** the checkbox "Automatically install necessary tools" is checked
6. Click "Install" and wait for it to finish

### Verify it worked:
1. Press `Windows Key + R`, type `cmd`, press Enter (this opens Command Prompt)
2. Type these two commands and press Enter after each:
   ```
   node --version
   ```
   You should see something like `v20.11.0` (the exact number doesn't matter)
   ```
   npm --version
   ```
   You should see something like `10.2.4`

**If you see version numbers, you're good! If you see an error, close Command Prompt and re-open it (sometimes Windows needs a fresh window to recognize new programs).**

---

## Step 2: Create the Project Folder

1. Open **File Explorer** (the folder icon in your taskbar)
2. Navigate to a place where you want your project to live (I recommend `Documents`)
3. Create a new folder called `chess-coach-app`
4. Copy ALL the files I gave you into this folder, maintaining the folder structure:

```
chess-coach-app/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── index.css
    ├── App.jsx
    ├── components/
    │   ├── SetupScreen.jsx
    │   ├── LoadingScreen.jsx
    │   ├── Dashboard.jsx
    │   ├── GameReview.jsx
    │   └── PuzzleTrainer.jsx
    ├── services/
    │   ├── chesscom-api.js
    │   ├── lichess-api.js
    │   ├── analysis.js
    │   └── coach.js
    └── utils/
        (empty for now)
```

---

## Step 3: Open the Project in VS Code

1. Open **VS Code**
2. Go to **File → Open Folder**
3. Navigate to your `chess-coach-app` folder and click "Select Folder"
4. You should see all the files in the left sidebar

---

## Step 4: Install Dependencies

This downloads all the libraries the app needs. Think of it like buying all the ingredients before cooking a recipe.

1. In VS Code, open the **Terminal**: go to **Terminal → New Terminal** (or press `` Ctrl+` ``)
2. You should see a command prompt at the bottom of VS Code
3. Make sure it says something like `C:\Users\YourName\Documents\chess-coach-app>`
4. Type this command and press Enter:

```
npm install
```

5. Wait for it to finish (might take 30-60 seconds). You'll see a progress bar and then a summary.
6. A new folder called `node_modules` will appear in your project — that's all the libraries.

**If you see warnings, that's normal. Only errors (red text) are a problem.**

---

## Step 5: Start the App

1. In the same terminal, type:

```
npm run dev
```

2. You should see output like:
```
  VITE v5.x.x  ready in 300ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

3. Your browser should open automatically to `http://localhost:3000`
4. You should see the ChessCoach AI setup screen!

**To stop the app:** press `Ctrl+C` in the terminal.
**To restart it:** type `npm run dev` again.

---

## Step 6: Try It Out!

1. Enter your **Chess.com** and/or **Lichess** username
2. Click "Analyze My Games"
3. The app will:
   - Connect to the Chess.com/Lichess APIs
   - Pull your recent games
   - Run each game through Stockfish analysis
   - Detect your patterns
   - Show you your personalized coaching dashboard

**Note:** The first analysis might take a minute or two because it's analyzing each game with the engine. Subsequent visits will be faster.

---

## Troubleshooting

### "npm is not recognized as a command"
→ Node.js didn't install correctly. Re-download from nodejs.org and reinstall. Make sure to **close and reopen** Command Prompt/VS Code after installing.

### "CORS error" or "Network error" in the browser console
→ Some APIs block requests from `localhost`. This is a known limitation for Chess-API.com. The Chess.com and Lichess APIs should work fine. If Chess-API.com is blocked, the app will use fallback analysis.

### The app shows but games don't load
→ Double-check your username spelling. Chess.com usernames are case-sensitive for the API.

### "Module not found" errors
→ Run `npm install` again. A dependency might not have installed properly.

---

## What's Next?

Once you have the app running, here are the next features we can build together:

1. **Claude API integration** — Replace the template-based coaching with dynamic, personalized AI explanations
2. **Puzzle API** — Connect to Lichess's puzzle database for real, themed puzzles
3. **Opening Explorer** — Show win/draw/loss statistics for your specific openings
4. **Progress tracking** — Store your analysis over time so the coach gets smarter
5. **Deploy online** — Put it on a real website URL so you can access it anywhere

Just come back and ask me to build any of these!

---

## File-by-File Explanation

| File | What it does | Analogy |
|------|-------------|---------|
| `package.json` | Lists all the tools/libraries needed | A recipe's ingredient list |
| `vite.config.js` | Configures the development server | The oven settings |
| `index.html` | The HTML shell that loads the app | The dinner plate |
| `src/main.jsx` | The entry point that starts React | Turning on the stove |
| `src/index.css` | All the visual styling | The table setting and decor |
| `src/App.jsx` | The main app logic and screen routing | The head chef |
| `src/components/*` | UI screens (dashboard, review, etc.) | Individual courses of the meal |
| `src/services/chesscom-api.js` | Fetches games from Chess.com | Calling the grocery store |
| `src/services/lichess-api.js` | Fetches games from Lichess | Calling a second grocery store |
| `src/services/analysis.js` | Runs Stockfish evaluation | The food tester |
| `src/services/coach.js` | Generates coaching explanations | The sommelier explaining the wine |
