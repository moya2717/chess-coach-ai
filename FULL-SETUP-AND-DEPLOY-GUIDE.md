# ChessCoach AI — Complete Setup & Deployment Guide
## Mac + Windows Instructions · Share with Friends

---

# Part 1: Setting Up Your Development Environment

This part gets the app running on YOUR computer so you can develop and test it.

---

## 1A: Install Node.js

Node.js is the engine that lets your computer run JavaScript applications. Think of it like installing a kitchen before you can cook — you only do it once.

### On Windows:

1. Open your browser and go to **https://nodejs.org**
2. Click the big green **LTS** button ("Recommended For Most Users")
3. Run the downloaded `.msi` file
4. Click **Next** on every screen — all the defaults are correct
5. Make sure the checkbox **"Automatically install necessary tools"** is checked
6. Click Install and wait for it to finish

**Verify it worked:**
- Press `Win + R`, type `cmd`, press Enter
- Type: `node --version` → you should see something like `v20.x.x`
- Type: `npm --version` → you should see something like `10.x.x`

### On Mac:

**Option A — Direct download (simplest):**
1. Go to **https://nodejs.org**
2. Click the **LTS** button
3. Run the downloaded `.pkg` file
4. Follow the installer steps

**Option B — Using Homebrew (if you have it):**
1. Open **Terminal** (press `Cmd + Space`, type "Terminal", press Enter)
2. Type: `brew install node`

**Verify it worked:**
- Open Terminal
- Type: `node --version` → you should see `v20.x.x`
- Type: `npm --version` → you should see `10.x.x`

> **If you see "command not found":** Close the terminal completely and open a new one. Sometimes the system needs a fresh window to recognize newly installed programs.

---

## 1B: Install Git (needed for deployment later)

Git is a version control tool. Think of it like "Track Changes" in Word, but for code.

### On Windows:
1. Go to **https://git-scm.com/download/win**
2. Download and run the installer
3. Click **Next** on every screen (defaults are fine)
4. Verify: open Command Prompt and type `git --version`

### On Mac:
1. Open Terminal
2. Type: `git --version`
3. If Git isn't installed, macOS will prompt you to install it — click **Install**
4. If that doesn't work: `brew install git`

---

## 1C: Set Up the Project

These steps are identical on Mac and Windows. The only difference is:
- **Windows:** Use **Command Prompt** or **PowerShell** or the **VS Code terminal**
- **Mac:** Use **Terminal** or the **VS Code terminal**

I recommend using the VS Code terminal for both platforms since it works the same way.

### Step 1: Download and extract the project

1. Download the `chess-coach-app.zip` file I gave you
2. Extract it to a location you'll remember:
   - **Windows:** `C:\Users\YourName\Documents\chess-coach-app`
   - **Mac:** `~/Documents/chess-coach-app`

### Step 2: Open in VS Code

1. Open VS Code
2. Go to **File → Open Folder**
3. Navigate to your `chess-coach-app` folder and click **Select Folder** (Windows) or **Open** (Mac)
4. You should see all the project files in the left sidebar

### Step 3: Open the Terminal in VS Code

- Go to **Terminal → New Terminal** (or press `` Ctrl+` `` on Windows, `` Cmd+` `` on Mac)
- A terminal panel appears at the bottom of VS Code
- It should already be in your project folder (you'll see the path ending in `chess-coach-app`)

### Step 4: Install dependencies

Type this and press Enter:

```bash
npm install
```

This downloads all the libraries your app needs. It might take 30–60 seconds. You'll see a progress bar, then a summary. A new `node_modules` folder will appear.

> **Warnings are normal.** Only red ERROR messages are a problem. If you see errors, try running `npm install` a second time.

### Step 5: Start the development server

```bash
npm run dev
```

You should see:

```
  VITE v5.x.x  ready in 300ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
```

Your browser should open automatically. If it doesn't, open your browser and go to **http://localhost:3000**

You should see the ChessCoach AI welcome screen!

> **To stop the server:** Press `Ctrl+C` in the terminal
> **To restart:** Type `npm run dev` again

### Step 6: Test it

1. Enter your Chess.com and/or Lichess username
2. Click "Analyze My Games"
3. The app will connect to the real APIs and pull your games

---

# Part 2: Making It Available to Friends

Right now the app only runs on your computer. To let friends use it, we need to **deploy** it — which means putting it on a server that anyone can access via a URL.

Think of it like the difference between cooking dinner at home (localhost) vs. opening a restaurant (deployment).

I'll cover three options, from easiest to most flexible:

---

## Option A: Vercel (Easiest — Recommended)

Vercel is a free hosting platform built specifically for React apps. It's like renting a restaurant space that comes fully equipped — you just bring the food.

**Cost:** Free for personal projects
**URL you'll get:** `chess-coach-ai.vercel.app` (or a custom name)

### Step 1: Create a Vercel account

1. Go to **https://vercel.com**
2. Click **Sign Up**
3. Choose **Continue with GitHub** (you'll need a GitHub account — if you don't have one, go to **https://github.com** and create a free account first)

### Step 2: Push your code to GitHub

In your VS Code terminal, run these commands one at a time:

```bash
# Initialize a git repository (one-time setup)
git init

# Create a .gitignore file so we don't upload unnecessary files
echo node_modules > .gitignore
echo dist >> .gitignore

# Stage all your files
git add .

# Create your first commit (like saving a snapshot)
git commit -m "Initial chess coach app"
```

Now create a repository on GitHub:

1. Go to **https://github.com/new**
2. Name it `chess-coach-ai`
3. Leave it as **Public** (or Private if you prefer)
4. Do NOT check any boxes (no README, no .gitignore, no license)
5. Click **Create repository**
6. GitHub will show you commands. Copy and run the two lines that look like:

```bash
git remote add origin https://github.com/YOUR-USERNAME/chess-coach-ai.git
git branch -M main
git push -u origin main
```

(Replace `YOUR-USERNAME` with your actual GitHub username)

> **If prompted for credentials:** GitHub now uses personal access tokens instead of passwords. Go to GitHub → Settings → Developer settings → Personal access tokens → Generate new token. Use that token as your password.

### Step 3: Deploy on Vercel

1. Go to **https://vercel.com/dashboard**
2. Click **Add New → Project**
3. It will show your GitHub repositories — find `chess-coach-ai` and click **Import**
4. Leave all settings as default (Vercel auto-detects Vite/React)
5. Click **Deploy**
6. Wait 30-60 seconds
7. Vercel gives you a live URL like: **https://chess-coach-ai.vercel.app**

**That's it!** Share that URL with your friends and they can use the app immediately.

### Updating the app later:

Whenever you make changes to your code:

```bash
git add .
git commit -m "Description of what you changed"
git push
```

Vercel automatically detects the push and redeploys within 30 seconds. Your friends will see the update immediately.

---

## Option B: Netlify (Also Easy — Alternative)

Netlify is very similar to Vercel. It's another free hosting option.

### Step 1: Build the app

In your VS Code terminal:

```bash
npm run build
```

This creates a `dist` folder containing the optimized, ready-to-deploy files.

### Step 2: Deploy with drag-and-drop

1. Go to **https://app.netlify.com/drop**
2. Drag your `dist` folder from File Explorer/Finder directly onto the webpage
3. Netlify instantly deploys it and gives you a URL like: `random-name-123.netlify.app`
4. You can customize the name in the site settings

### Updating later:

Run `npm run build` again, then drag the new `dist` folder to your Netlify dashboard.

Or connect to GitHub for automatic deploys (same process as Vercel Step 2).

---

## Option C: GitHub Pages (Free, slightly more setup)

If you want to keep everything on GitHub.

### Step 1: Install the deployment tool

```bash
npm install --save-dev gh-pages
```

### Step 2: Add deploy scripts to package.json

Open `package.json` and add these to the `"scripts"` section:

```json
"predeploy": "npm run build",
"deploy": "gh-pages -d dist"
```

Also add this line at the top level of package.json:

```json
"homepage": "https://YOUR-USERNAME.github.io/chess-coach-ai"
```

### Step 3: Update vite.config.js

Add the `base` property:

```javascript
export default defineConfig({
  plugins: [react()],
  base: '/chess-coach-ai/',
  server: {
    port: 3000,
    open: true
  }
})
```

### Step 4: Deploy

```bash
npm run deploy
```

Your app will be live at: `https://YOUR-USERNAME.github.io/chess-coach-ai`

---

# Part 3: Sharing with Friends

Once deployed, sharing is simple. Send them the URL! But here are some tips:

### Quick share message:

> Hey! I built a chess coaching app. It analyzes your Chess.com/Lichess games and gives you personalized feedback. Try it here: [your URL]
>
> Just enter your Chess.com or Lichess username and click "Analyze My Games." It'll show you patterns in your play and coach you on your weaknesses.

### Things to tell friends:

- **No account needed** — the app just reads their public game data
- **Works on phone and desktop** — the app is responsive
- **Their data is safe** — the app doesn't store anything on a server, all analysis happens in their browser
- **It takes 1-2 minutes** for the first analysis (it's running Stockfish on each game)

---

# Part 4: Quick Reference Commands

Here's a cheat sheet you can come back to:

| What you want to do | Command | Where |
|---------------------|---------|-------|
| Install dependencies (first time) | `npm install` | VS Code terminal |
| Start local dev server | `npm run dev` | VS Code terminal |
| Stop the server | `Ctrl+C` | VS Code terminal |
| Build for production | `npm run build` | VS Code terminal |
| Save changes to Git | `git add . && git commit -m "message"` | VS Code terminal |
| Push to GitHub (triggers deploy) | `git push` | VS Code terminal |
| Check Node version | `node --version` | Any terminal |
| Check npm version | `npm --version` | Any terminal |

---

# Part 5: Troubleshooting

### "npm is not recognized" / "command not found"
**Fix:** Node.js didn't install correctly. Reinstall from nodejs.org. Close ALL terminal/command prompt windows and reopen them after installing.

### "EACCES permission denied" (Mac only)
**Fix:** Run: `sudo chown -R $(whoami) ~/.npm`

### "Port 3000 already in use"
**Fix:** Either close the other app using port 3000, or change the port in `vite.config.js`:
```javascript
server: { port: 3001, open: true }
```

### Games don't load / API errors
**Fix:**
- Double-check your username spelling (Chess.com is case-sensitive)
- Make sure your profile is public on Chess.com (Settings → Privacy)
- Lichess profiles are public by default

### "Module not found" error
**Fix:** Run `npm install` again. A dependency may not have installed properly.

### White screen / nothing loads
**Fix:** Open your browser's developer tools (press F12), go to the Console tab, and look for red error messages. These will tell you exactly what went wrong.

### Changes not showing up on the deployed site
**Fix:** Make sure you committed AND pushed:
```bash
git add .
git commit -m "your changes"
git push
```
Then wait 30-60 seconds for Vercel/Netlify to redeploy.

---

# What's Next?

Once you and your friends are using the app, here are features we can add:

1. **Claude API coaching** — Dynamic, personalized explanations for every move
2. **Real puzzle integration** — Connect to Lichess puzzle database for targeted training
3. **Opening explorer** — Show win/draw/loss stats for your specific openings
4. **Progress tracking** — Save analysis history so the coach learns over time
5. **Multiplayer comparisons** — Compare patterns between friends
6. **Custom domain** — Put it on your own URL like `chesscoach.com`

Come back to our chat anytime and I'll help you build any of these!
