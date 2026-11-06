const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const CONFIG = {
    winScore: 1500,
    startLives: 3,
    maxLives: 3,
    rewardMs: 30 * 60 * 1000,
    levelEvery: 80,
    speedPerLevel: 0.8,
    speedLevelCap: 10,
    missPenalty: 8,
    missPenaltyPerLevel: 0.5,
    lateZigzagLevel: 6,
    lookAlikeLevel: 5,
    basketShrinkPerLevel: 0.02,
    minBasketScale: 0.7,
    baseItems: 7,
    maxExtraItems: 6,
    baseBadChance: 0.25,
    badChancePerLevel: 0.05,
    maxBadChance: 0.5,
    powerUpChance: 0.04,
    goldenChance: 0.03,
    goldenPoints: 50,
    firstRushMs: 20000,
    rushMs: 4500,
    rushGapMs: 40000,
    rushMaxItems: 12,
    comboThreshold: 5,
    comboBonus: 5,
    restartDelayMs: 500,
    slowMs: 5000,
    basketInset: 0.12
};

const IMG_BASE = "https://raw.githubusercontent.com/0luwaseun10/coffee-bread-games/main/C&B_FreshCatch/Images/";
const basketImg = new Image();
basketImg.src = IMG_BASE + "basket.png";
const pupusaImg = new Image();
pupusaImg.src = IMG_BASE + "pupusa.png";

let score = 0, lives = CONFIG.startLives, combo = 0;
let gameOver = false, gameStarted = false, paused = false;
let gameOverAt = 0, lastTime = 0, slowUntil = 0, spawnCooldown = 0;
let shake = 0, flash = { color: null, life: 0 };
let maxLevel = 0, squash = 0, playTime = 0, rushUntil = 0, nextRushAt = CONFIG.firstRushMs, rushBanner = 0;
let ingredients = [], floaters = [];
let highScore = Number(safeGet("coffeeBreadHighScore")) || 0;
let muted = false;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function safeSet(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function beep(freq, dur, type = "sine", vol = 0.15, slide = 0) {
    if (muted || !AudioCtx) return;
    try {
        audioCtx = audioCtx || new AudioCtx();
        const t = audioCtx.currentTime;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t); o.stop(t + dur);
    } catch (e) {}
}
const sfx = {
    good: () => beep(660, 0.12, "sine", 0.15, 300),
    bad: () => beep(200, 0.3, "sawtooth", 0.15, -120),
    power: () => beep(500, 0.25, "triangle", 0.18, 500),
    win: () => { beep(523, 0.15); setTimeout(() => beep(659, 0.15), 150); setTimeout(() => beep(784, 0.3), 300); },
    lose: () => beep(300, 0.6, "square", 0.12, -200)
};

(function injectUI() {
    const style = document.createElement("style");
    style.textContent = `
        .cb-progress { height: 14px; margin: 0 auto 10px; background: #eee2d0; border-radius: 7px; overflow: hidden; }
        .cb-progress-bar { height: 100%; width: 0; background: linear-gradient(90deg, #e6392f, #f5a623); transition: width .25s; }
        .cb-mute { margin-top: 10px; padding: 6px 14px; border: 2px solid #5a3825; background: #fff; color: #5a3825;
                   border-radius: 8px; font-size: 15px; cursor: pointer; }
        .cb-best { font-weight: bold; margin-top: 12px !important; }
    `;
    document.head.appendChild(style);

    const info = document.querySelector(".game-info");
    const bar = document.createElement("div");
    bar.className = "cb-progress";
    bar.innerHTML = '<div class="cb-progress-bar" id="cbProgressBar"></div>';
    info.insertAdjacentElement("afterend", bar);

    const mute = document.createElement("button");
    mute.className = "cb-mute";
    mute.textContent = "🔊 Sound on";
    mute.addEventListener("click", () => {
        muted = !muted;
        mute.textContent = muted ? "🔇 Sound off" : "🔊 Sound on";
    });
    document.querySelector(".instructions").appendChild(mute);

    document.getElementById("score").setAttribute("aria-live", "polite");
    document.getElementById("lives").setAttribute("aria-live", "polite");
})();

function getRewardKey() { return "coffeeBreadReward_" + new Date().toLocaleDateString("en-CA"); }
function getReward() {
    try { return JSON.parse(safeGet(getRewardKey())); } catch (e) { return null; }
}
function saveReward(r) { safeSet(getRewardKey(), JSON.stringify(r)); }

function formatTime(ts) {
    return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function formatCountdown(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function showStartScreen(onStart) {
    const old = document.getElementById("startScreen");
    if (old) old.remove();
    const screen = document.createElement("div");
    screen.id = "startScreen";
    screen.className = "cb-reward-screen";
    screen.innerHTML = `
        <div class="cb-reward-card">
            <h2>FRESH CATCH</h2>
            <p>Catch the delicious food items!</p>
            <p>Avoid the spoiled items and gross food.</p>
            <p>❤️ restores a life. ⏱️ slows everything down.</p>
            <p>🌟 Golden items are worth 50 points!</p>
            <p>Missing good food costs points, and more at higher levels!</p>
            <p>Later on, spoiled food can look like good food. Look for the green tint!</p>
            <p>Reach <b>${CONFIG.winScore} points</b> to win your daily reward.</p>
            <p class="cb-best">Best score: ${highScore}</p>
            <button id="cbStartGame">START GAME</button>
        </div>`;
    document.body.appendChild(screen);
    const btn = document.getElementById("cbStartGame");
    btn.addEventListener("click", () => { screen.remove(); if (onStart) onStart(); });
    btn.focus();
}

function showRewardScreen(onPlayAgain) {
    const old = document.getElementById("coffeeBreadRewardScreen");
    if (old) old.remove();

    let reward = getReward();
    if (!reward) {
        const now = Date.now();
        reward = { completedAt: now, expiresAt: now + CONFIG.rewardMs, redeemed: false };
        saveReward(reward);
    }

    const screen = document.createElement("div");
    screen.id = "coffeeBreadRewardScreen";
    screen.className = "cb-reward-screen";
    document.body.appendChild(screen);
    let timer = null;

    function render() {
        if (timer) clearInterval(timer);
        const expired = Date.now() >= reward.expiresAt;

        if (reward.redeemed) {
            screen.innerHTML = `<div class="cb-reward-card">
                <h2>REWARD REDEEMED</h2>
                <p>Today's reward has been used.</p>
                <p>Please come back tomorrow!</p>
                <button id="cbPlayAgain">PLAY AGAIN</button></div>`;
        } else {
            screen.innerHTML = `<div class="cb-reward-card">
                <h2>GAME COMPLETED!</h2>
                <p class="cb-completed-time">Completed: ${formatTime(reward.completedAt)}</p>
                <p class="cb-countdown" id="cbCountdown"></p>
                <p>Show this live screen at the window for one</p>
                <p>free daily reward with a $10+ purchase.</p>
                <button id="cbPlayAgain">PLAY AGAIN</button></div>`;

            const countdown = screen.querySelector("#cbCountdown");
            const tick = () => {
                const left = reward.expiresAt - Date.now();
                countdown.textContent = left > 0 ? "CLAIM WITHIN " + formatCountdown(left) : "REWARD TIME EXPIRED";
            };
            tick();
            timer = setInterval(tick, 1000);

        }

        const again = screen.querySelector("#cbPlayAgain");
        again.addEventListener("click", () => {
            if (timer) clearInterval(timer);
            screen.remove();
            if (onPlayAgain) onPlayAgain();
        });
        again.focus();
    }
    render();
}

const player = { x: canvas.width / 2 - 65, y: canvas.height - 90, width: 130, height: 70, speed: 11 };
const keys = { left: false, right: false };
let targetX = player.x, isTouching = false, isMouseDown = false;

function canvasX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) * (canvas.width / rect.width);
}
function canPlay() { return gameStarted && !gameOver && !paused; }

canvas.addEventListener("touchstart", e => {
    if (!canPlay()) return;
    e.preventDefault();
    if (e.touches.length) { isTouching = true; targetX = canvasX(e.touches[0].clientX) - player.width / 2; }
}, { passive: false });
canvas.addEventListener("touchmove", e => {
    if (!canPlay()) return;
    e.preventDefault();
    if (e.touches.length && isTouching) targetX = canvasX(e.touches[0].clientX) - player.width / 2;
}, { passive: false });
canvas.addEventListener("touchend", e => { isTouching = false; handleRestart(e); });

canvas.addEventListener("mousedown", e => {
    if (!canPlay()) return;
    isMouseDown = true;
    targetX = canvasX(e.clientX) - player.width / 2;
});
window.addEventListener("mousemove", e => { if (isMouseDown) targetX = canvasX(e.clientX) - player.width / 2; });
window.addEventListener("mouseup", () => { isMouseDown = false; });
canvas.addEventListener("click", handleRestart);

document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
    if (e.key.toLowerCase() === "r") handleRestart(e);
});
document.addEventListener("keyup", e => {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
});

document.addEventListener("visibilitychange", () => {
    paused = document.hidden;
    lastTime = 0;
    if (paused) { keys.left = keys.right = false; isTouching = isMouseDown = false; }
});

const goodItems = [
    { name: "Tomato", emoji: "🍅", points: 10 },
    { name: "Bread", emoji: "🥖", points: 10 },
    { speedMul: 1.35, name: "Coffee", emoji: "☕", points: 15 },
    { name: "Beans", emoji: "🫘", points: 10 },
    { behavior: "zigzag", name: "Avocado", emoji: "🥑", points: 10 }
];
const pupusaItem = { name: "Pupusa", img: pupusaImg, points: 20, width: 110, height: 70 };
const badItems = [
    { name: "Rotten Tomato", emoji: "🤢" },
    { name: "Moldy Bread", emoji: "🦠" },
    { behavior: "zigzag", name: "Spoiled Food", emoji: "🪰" }
];
const powerItems = [
    { name: "Heart", emoji: "❤️", power: "life" },
    { name: "Slow", emoji: "⏱️", power: "slow" }
];
const goldenItem = { name: "Golden", emoji: "🌟", points: CONFIG.goldenPoints, golden: true, speedMul: 1.6 };

function getLevel() { return Math.floor(score / CONFIG.levelEvery); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickType() {
    const level = getLevel();
    const badChance = Math.min(CONFIG.baseBadChance + level * CONFIG.badChancePerLevel, CONFIG.maxBadChance);
    if (playTime < rushUntil) {
        const coffee = goodItems.find(g => g.name === "Coffee");
        return { ...(Math.random() < 0.5 ? coffee : pick(goodItems)), type: "good" };
    }
    const r = Math.random();
    let c = badChance;
    if (r < c) {
        const lookAlikeChance = level >= CONFIG.lookAlikeLevel
            ? Math.min(0.7, 0.2 + (level - CONFIG.lookAlikeLevel) * 0.1) : 0;
        if (Math.random() < lookAlikeChance) {
            const base = pick(goodItems);
            return { name: "Spoiled " + base.name, emoji: base.emoji, type: "bad", points: 0,
                     lookAlike: true, behavior: base.behavior, speedMul: base.speedMul };
        }
        return { ...pick(badItems), type: "bad", points: 0 };
    }
    c += CONFIG.powerUpChance;
    if (r < c) return { ...pick(powerItems), type: "power", points: 0 };
    c += CONFIG.goldenChance;
    if (r < c) return { ...goldenItem, type: "good" };
    c += 0.08;
    if (r < c) return { ...pupusaItem, type: "good" };
    return { ...pick(goodItems), type: "good" };
}

function createIngredient() {
    const t = pickType();
    const w = t.width || 60, h = t.height || 60;

    const lateChance = Math.min(0.6, Math.max(0, getLevel() - CONFIG.lateZigzagLevel + 1) * 0.1);
    const behavior = t.behavior || (Math.random() < lateChance ? "zigzag" : undefined);
    const margin = behavior === "zigzag" ? 45 : 0;
    const bx = margin + Math.random() * (canvas.width - w - margin * 2);
    ingredients.push({
        ...t, behavior,
        x: bx, baseX: bx,
        phase: Math.random() * Math.PI * 2,
        y: -h,
        width: w, height: h,
        speed: (2 + Math.random() * 2 + Math.min(getLevel(), CONFIG.speedLevelCap) * CONFIG.speedPerLevel) * (t.speedMul || 1),
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.06
    });
}

function targetItemCount() { return CONFIG.baseItems + Math.min(getLevel(), CONFIG.maxExtraItems); }

function addFloater(x, y, text, color) { floaters.push({ x, y, text, color, life: 1 }); }

function checkCollision(item, dy) {

    const inset = player.width * CONFIG.basketInset;
    const left = player.x + inset, right = player.x + player.width - inset;
    const top = player.y + 5, rim = 20;
    const bottom = item.y + item.height;
    const prevBottom = bottom - dy;
    return item.x + item.width > left && item.x < right && prevBottom <= top + rim && bottom >= top;
}

function updatePlayer(dt) {
    const scale = Math.max(CONFIG.minBasketScale, 1 - maxLevel * CONFIG.basketShrinkPerLevel);
    const oldW = player.width;
    player.width += (130 * scale - player.width) * Math.min(0.1 * dt, 1);
    player.x -= (player.width - oldW) / 2;
    targetX -= (player.width - oldW) / 2;
    player.height = player.width * (70 / 130);
    player.y = canvas.height - 90 + (70 - player.height);
    if (keys.left) { player.x -= player.speed * dt; targetX = player.x; }
    if (keys.right) { player.x += player.speed * dt; targetX = player.x; }
    if (isTouching || isMouseDown) player.x += (targetX - player.x) * Math.min(0.2 * dt, 1);
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
}

function handleCatch(item) {
    const cx = item.x + item.width / 2, cy = player.y;
    squash = 1;
    if (item.type === "good") {
        combo++;
        let pts = item.points;
        if (combo >= CONFIG.comboThreshold) pts += CONFIG.comboBonus;
        score += pts;
        addFloater(cx, cy, "+" + pts + (combo >= CONFIG.comboThreshold ? " 🔥" : ""), "#1f9d3a");
        flash = { color: "rgba(40,200,80,0.25)", life: 1 };
        if (item.golden) { addFloater(cx, cy - 32, "GOLDEN!", "#d4a017"); sfx.power(); } else sfx.good();
    } else if (item.type === "bad") {
        lives--; combo = 0;
        addFloater(cx, cy, "-1 ❤️", "#e6392f");
        flash = { color: "rgba(230,57,47,0.35)", life: 1 };
        if (!reduceMotion) shake = 14;
        sfx.bad();
    } else if (item.power === "life") {
        lives = Math.min(CONFIG.maxLives, lives + 1);
        addFloater(cx, cy, "+1 LIFE", "#e6392f");
        sfx.power();
    } else if (item.power === "slow") {
        slowUntil = performance.now() + CONFIG.slowMs;
        addFloater(cx, cy, "SLOW!", "#2a6fdb");
        sfx.power();
    }
    updateScoreDisplay();
    updateLivesDisplay();
}

function endGame(won) {
    gameOver = true;
    gameOverAt = performance.now();
    if (score > highScore) { highScore = score; safeSet("coffeeBreadHighScore", String(highScore)); }
    if (won) { sfx.win(); showRewardScreen(restartGame); } else { sfx.lose(); }
}

function checkLevelUp() {
    if (getLevel() > maxLevel) {
        maxLevel = getLevel();
        addFloater(canvas.width / 2, 260, "LEVEL " + (maxLevel + 1) + "!", "#5a3825");
    }
}

function updateIngredients(dt, now) {
    const speedMul = now < slowUntil ? 0.5 : 1;
    for (let i = ingredients.length - 1; i >= 0; i--) {
        const it = ingredients[i];
        const dy = it.speed * speedMul * dt;
        it.y += dy;
        it.angle += it.spin * dt;
        if (it.behavior === "zigzag") it.x = it.baseX + Math.sin(it.y * 0.03 + it.phase) * 40;

        if (checkCollision(it, dy)) {
            ingredients.splice(i, 1);
            handleCatch(it);
            checkLevelUp();
            if (score >= CONFIG.winScore) { endGame(true); return; }
            if (lives <= 0) { endGame(false); return; }
            continue;
        }
        if (it.y > canvas.height) {
            ingredients.splice(i, 1);
            if (it.type === "good" && !it.golden && playTime >= rushUntil) {
                combo = 0;
                const penalty = Math.round(CONFIG.missPenalty + Math.min(getLevel(), CONFIG.speedLevelCap) * CONFIG.missPenaltyPerLevel);
                if (penalty > 0 && score > 0) {
                    score = Math.max(0, score - penalty);
                    const mx = Math.min(Math.max(it.x + it.width / 2, 40), canvas.width - 40);
                    addFloater(mx, canvas.height - 20, "-" + penalty, "#c0392b");
                    updateScoreDisplay();
                }
            }
        }
    }

    playTime += dt * 16.667;
    if (playTime >= nextRushAt && playTime >= rushUntil) {
        rushUntil = playTime + CONFIG.rushMs;
        nextRushAt = rushUntil + CONFIG.rushGapMs + Math.random() * 10000;
        rushBanner = 1;
        sfx.power();
    }
    const rushing = playTime < rushUntil;

    spawnCooldown -= dt;
    const cap = rushing ? CONFIG.rushMaxItems : targetItemCount();
    if (ingredients.length < cap && spawnCooldown <= 0) {
        createIngredient();
        spawnCooldown = rushing ? 4 + Math.random() * 6 : 12 + Math.random() * 25;
    }
}

function updateEffects(dt) {
    shake = Math.max(0, shake - 0.8 * dt);
    squash = Math.max(0, squash - 0.08 * dt);
    rushBanner = Math.max(0, rushBanner - 0.012 * dt);
    flash.life = Math.max(0, flash.life - 0.06 * dt);
    for (let i = floaters.length - 1; i >= 0; i--) {
        floaters[i].y -= 1.2 * dt;
        floaters[i].life -= 0.02 * dt;
        if (floaters[i].life <= 0) floaters.splice(i, 1);
    }
}

function drawPlayer() {
    ctx.save();

    const k = squash * Math.cos((1 - squash) * Math.PI * 1.5);
    const ax = player.x + player.width / 2, ay = player.y + player.height;
    ctx.translate(ax, ay);
    ctx.scale(1 + 0.12 * k, 1 - 0.2 * k);
    ctx.translate(-ax, -ay);
    if (basketImg.complete && basketImg.naturalWidth !== 0) {
        ctx.drawImage(basketImg, player.x, player.y, player.width, player.height);
    } else {
        ctx.fillStyle = "#8B5E3C";
        ctx.fillRect(player.x, player.y, player.width, player.height);
        ctx.fillStyle = "#5A3825";
        ctx.fillRect(player.x - 5, player.y, player.width + 10, 8);
    }
    ctx.restore();
}

function drawIngredients() {
    for (const it of ingredients) {
        ctx.save();
        ctx.translate(it.x + it.width / 2, it.y + it.height / 2);
        ctx.rotate(it.angle);
        if (it.type === "bad" && !it.lookAlike) { ctx.shadowColor = "red"; ctx.shadowBlur = 18; }
        if (it.type === "power") { ctx.shadowColor = "gold"; ctx.shadowBlur = 18; }
        if (it.golden) { ctx.shadowColor = "#ffb300"; ctx.shadowBlur = 25 + Math.sin(performance.now() / 120) * 10; }

        if (it.img && it.img.complete && it.img.naturalWidth !== 0) {

            const iw = it.img.naturalWidth, ih = it.img.naturalHeight;
            ctx.drawImage(it.img, iw * 0.02, ih * 0.22, iw * 0.96, ih * 0.6,
                          -it.width / 2, -it.height / 2, it.width, it.height);
        } else if (it.emoji || it.img) {
            ctx.font = "50px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(it.emoji || "🫓", 0, 0);
            if (it.lookAlike) {
                ctx.fillStyle = "rgba(80,140,40,0.38)";
                ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "rgba(40,70,20,0.75)";
                [[-10, -8, 5], [8, 6, 4], [10, -12, 3]].forEach(([x, y, r]) => {
                    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
                });
            }
        }
        ctx.restore();
    }
}

function drawFloaters() {
    ctx.textAlign = "center";
    ctx.font = "bold 28px Arial";
    for (const f of floaters) {
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
}

function drawHUD(now) {
    ctx.textAlign = "left";
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#5a3825";
    ctx.fillText("Level " + (getLevel() + 1), 12, 26);
    if (combo >= 2) ctx.fillText("Combo x" + combo, 12, 50);
    if (now < slowUntil) ctx.fillText("⏱️ Slow " + Math.ceil((slowUntil - now) / 1000) + "s", 12, 74);
}

function drawGameOver(now) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "50px Arial";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 60);
    ctx.font = "28px Arial";
    ctx.fillText("Score: " + score + "   Best: " + highScore, canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = "20px Arial";
    const ready = now - gameOverAt >= CONFIG.restartDelayMs;
    ctx.fillText(ready ? "Tap or Press R to Play Again" : "...", canvas.width / 2, canvas.height / 2 + 40);
}

function drawRushBanner() {
    if (rushBanner <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, rushBanner * 1.5);
    ctx.textAlign = "center";
    ctx.font = "bold 54px Arial";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#5a3825";
    ctx.fillStyle = "#ffd166";
    const y = 170 - (1 - rushBanner) * 20;
    ctx.strokeText("☕ COFFEE RUSH! ☕", canvas.width / 2, y);
    ctx.fillText("☕ COFFEE RUSH! ☕", canvas.width / 2, y);
    ctx.restore();
}

function drawGame(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    ctx.fillStyle = "#dff3ff";
    ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);
    drawIngredients();
    drawPlayer();
    drawFloaters();
    ctx.restore();

    if (flash.life > 0 && flash.color) {
        ctx.globalAlpha = flash.life;
        ctx.fillStyle = flash.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
    }
    drawHUD(now);
    drawRushBanner();
    if (gameOver && score < CONFIG.winScore) drawGameOver(now);
}

function updateScoreDisplay() {
    document.getElementById("score").textContent = score;
    const bar = document.getElementById("cbProgressBar");
    if (bar) bar.style.width = Math.min(score / CONFIG.winScore, 1) * 100 + "%";
}
function updateLivesDisplay() {
    document.getElementById("lives").textContent = lives > 0 ? "❤️ ".repeat(lives) : "💔";
}

function restartGame() {
    score = 0; lives = CONFIG.startLives; combo = 0;
    gameOver = false; slowUntil = 0; shake = 0;
    squash = 0; playTime = 0; rushUntil = 0; nextRushAt = CONFIG.firstRushMs; rushBanner = 0;
    maxLevel = 0; player.width = 130; player.height = 70; player.y = canvas.height - 90;
    ingredients = []; floaters = [];
    for (let i = 0; i < 3; i++) createIngredient();
    updateScoreDisplay();
    updateLivesDisplay();
}

function handleRestart(event) {
    if (!gameOver || score >= CONFIG.winScore) return;
    if (document.getElementById("coffeeBreadRewardScreen")) return;
    if (performance.now() - gameOverAt < CONFIG.restartDelayMs) return;
    event.preventDefault();
    restartGame();
}

function gameLoop(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min((now - lastTime) / 16.667, 3);
    lastTime = now;

    if (gameStarted && !gameOver && !paused) {
        updatePlayer(dt);
        updateIngredients(dt, now);
    }
    updateEffects(dt);
    drawGame(now);
    requestAnimationFrame(gameLoop);
}

updateScoreDisplay();
updateLivesDisplay();
function startGame() {
    gameStarted = true;
    for (let i = 0; i < 3; i++) createIngredient();
}

const savedReward = getReward();
if (savedReward && !savedReward.redeemed && Date.now() < savedReward.expiresAt) {

    showRewardScreen(() => showStartScreen(startGame));
} else {
    showStartScreen(startGame);
}
requestAnimationFrame(gameLoop);
