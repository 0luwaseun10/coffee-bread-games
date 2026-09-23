// ==========================================
// COFFEE & BREAD - FRESH CATCH
// Good vs. Rotten Ingredients + Lives + Rewards
// ==========================================


// ==========================================
// CANVAS
// ==========================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");


// ==========================================
// GAME VARIABLES & ASSETS
// ==========================================

// Load Basket Image
const basketImg = new Image();
basketImg.src = "images/basket.png";

// Load Pupusa Image
const pupusaImg = new Image();
pupusaImg.src = "images/pupusa.png";

let score = 0;
let lives = 3;
let gameOver = false;

// Reward & Win Constants
const COFFEE_BREAD_REWARD_LENGTH = 30 * 1000; // 30 minutes in ms
const WIN_SCORE = 100; // Score goal needed to unlock reward


// ==========================================
// REWARD SYSTEM LOGIC
// ==========================================

function getCoffeeBreadRewardKey() {
    const today = new Date().toLocaleDateString("en-CA");
    return "coffeeBreadReward_" + today;
}

function getCoffeeBreadReward() {
    try {
        const savedReward = localStorage.getItem(getCoffeeBreadRewardKey());
        return savedReward ? JSON.parse(savedReward) : null;
    } catch (error) {
        return null;
    }
}

function formatCoffeeBreadTime(timestamp) {
    return new Date(timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function formatCoffeeBreadCountdown(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
}

function showCoffeeBreadCompletion(onPlayAgain) {
    const oldScreen = document.getElementById("coffeeBreadRewardScreen");
    if (oldScreen) oldScreen.remove();

    const existingReward = getCoffeeBreadReward();
    const screen = document.createElement("div");
    screen.id = "coffeeBreadRewardScreen";
    screen.className = "cb-reward-screen";

    if (existingReward) {
        screen.innerHTML = `
            <div class="cb-reward-card">
                <h2>DAILY REWARD CLAIMED</h2>
                <p>This browser has already earned a reward today.</p>
                <p>Please come back tomorrow!</p>
                <button id="cbPlayAgain">PLAY AGAIN</button>
            </div>
        `;
    } else {
        const completedAt = Date.now();
        const reward = {
            completedAt: completedAt,
            expiresAt: completedAt + COFFEE_BREAD_REWARD_LENGTH
        };

        try {
            localStorage.setItem(getCoffeeBreadRewardKey(), JSON.stringify(reward));
        } catch (error) {
            // Browser storage fallback
        }

        screen.innerHTML = `
            <div class="cb-reward-card">
                <h2>GAME COMPLETED!</h2>
                <p class="cb-completed-time">
                    Completed: ${formatCoffeeBreadTime(completedAt)}
                </p>
                <p class="cb-countdown" id="cbCountdown"></p>
                <p>Show this live screen for one free drink</p>
                <p>with a $10+ food order.</p>
                <button id="cbPlayAgain">PLAY AGAIN</button>
            </div>
        `;

        const countdown = screen.querySelector("#cbCountdown");
        const updateCountdown = function() {
            const timeLeft = reward.expiresAt - Date.now();
            if (timeLeft > 0) {
                countdown.textContent = "CLAIM WITHIN " + formatCoffeeBreadCountdown(timeLeft);
            } else {
                countdown.textContent = "REWARD TIME EXPIRED";
            }
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        screen.dataset.timer = timer;
    }

    document.body.appendChild(screen);

    document.getElementById("cbPlayAgain").addEventListener("click", function() {
        const timer = screen.dataset.timer;
        if (timer) clearInterval(timer);
        screen.remove();
        if (onPlayAgain) onPlayAgain();
    });
}


// ==========================================
// PLAYER
// ==========================================

const player = {
    x: canvas.width / 2 - 70,
    y: canvas.height - 90,
    width: 130,
    height: 70,
    speed: 11
};


// ==========================================
// KEYBOARD CONTROLS
// ==========================================

const keys = {
    left: false,
    right: false
};


// ==========================================
// INGREDIENT TYPES
// ==========================================

const ingredientTypes = [
    // Good Ingredients
    { 
        name: "Pupusa", 
        img: pupusaImg, 
        type: "good", 
        points: 20,
        width: 90,  
        height: 90   
    },
    { name: "Tomato", emoji: "🍅", type: "good", points: 10 },
    { name: "Bread", emoji: "🥖", type: "good", points: 10 },
    { name: "Coffee", emoji: "☕", type: "good", points: 15 },
    { name: "Beans", emoji: "🫘", type: "good", points: 10 },
    { name: "Avocado", emoji: "🥑", type: "good", points: 10 },

    // Bad Ingredients
    { name: "Rotten Tomato", emoji: "🤢", type: "bad", points: 0 },
    { name: "Moldy Bread", emoji: "🤢", type: "bad", points: 0 },
    { name: "Spoiled Food", emoji: "🤢", type: "bad", points: 0 }
];


// ==========================================
// INGREDIENT ARRAY
// ==========================================

let ingredients = [];


// ==========================================
// KEYBOARD INPUT
// ==========================================

document.addEventListener("keydown", function(event) {
    if (event.key === "ArrowLeft") {
        keys.left = true;
    }
    if (event.key === "ArrowRight") {
        keys.right = true;
    }
});

document.addEventListener("keyup", function(event) {
    if (event.key === "ArrowLeft") {
        keys.left = false;
    }
    if (event.key === "ArrowRight") {
        keys.right = false;
    }
});


// ==========================================
// CREATE INGREDIENT
// ==========================================

function createIngredient() {
    const type = ingredientTypes[Math.floor(Math.random() * ingredientTypes.length)];

    const itemWidth = type.width || 60;
    const itemHeight = type.height || 60;

    const ingredient = {
        name: type.name,
        emoji: type.emoji || null,
        img: type.img || null,
        type: type.type,
        points: type.points,
        x: Math.random() * (canvas.width - itemWidth),
        y: -itemHeight,
        width: itemWidth,
        height: itemHeight,
        speed: 2 + Math.random() * 2
    };

    ingredients.push(ingredient);
}


// ==========================================
// CREATE INITIAL INGREDIENTS
// ==========================================

function createInitialIngredients() {
    for (let i = 0; i < 5; i++) {
        createIngredient();
    }
}


// ==========================================
// UPDATE PLAYER
// ==========================================

function updatePlayer() {
    if (keys.left) {
        player.x -= player.speed;
    }
    if (keys.right) {
        player.x += player.speed;
    }

    if (player.x < 0) {
        player.x = 0;
    }
    if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
    }
}


// ==========================================
// COLLISION DETECTION (CATCH FROM TOP ONLY)
// ==========================================

function checkCollision(player, ingredient) {
    const ingredientBottom = ingredient.y + ingredient.height;
    const basketTop = player.y;
    const basketRimThickness = 15;

    return (
        ingredient.x + ingredient.width > player.x &&
        ingredient.x < player.x + player.width &&
        ingredientBottom >= basketTop &&
        ingredientBottom <= basketTop + basketRimThickness
    );
}


// ==========================================
// UPDATE INGREDIENTS
// ==========================================

function updateIngredients() {
    for (let i = ingredients.length - 1; i >= 0; i--) {
        const ingredient = ingredients[i];
        ingredient.y += ingredient.speed;

        if (checkCollision(player, ingredient)) {
            if (ingredient.type === "good") {
                score += ingredient.points;
            }

            if (ingredient.type === "bad") {
                lives--;
            }

            ingredients.splice(i, 1);
            createIngredient();

            updateScoreDisplay();
            updateLivesDisplay();

            // Win Condition
            if (score >= WIN_SCORE) {
                gameOver = true;
                showCoffeeBreadCompletion(restartGame);
                return;
            }

            // Loss Condition
            if (lives <= 0) {
                gameOver = true;
            }

            continue;
        }

        if (ingredient.y > canvas.height) {
            ingredients.splice(i, 1);
            createIngredient();
        }
    }
}


// ==========================================
// DRAW PLAYER (BASKET)
// ==========================================

function drawPlayer() {
    if (basketImg.complete && basketImg.naturalWidth !== 0) {
        ctx.drawImage(
            basketImg,
            player.x,
            player.y,
            player.width,
            player.height
        );
    } else {
        ctx.fillStyle = "#8B5E3C";
        ctx.fillRect(player.x, player.y, player.width, player.height);

        ctx.fillStyle = "#5A3825";
        ctx.fillRect(player.x - 5, player.y, player.width + 10, 8);
    }
}


// ==========================================
// DRAW INGREDIENTS
// ==========================================

function drawIngredients() {
    for (const ingredient of ingredients) {
        if (ingredient.img && ingredient.img.complete && ingredient.img.naturalWidth !== 0) {
            ctx.drawImage(
                ingredient.img,
                ingredient.x,
                ingredient.y,
                ingredient.width,
                ingredient.height
            );
        } else if (ingredient.emoji) {
            ctx.font = "50px Arial";
            ctx.textAlign = "center";
            ctx.fillText(
                ingredient.emoji,
                ingredient.x + ingredient.width / 2,
                ingredient.y + ingredient.height
            );
        }
    }
}


// ==========================================
// SCORE & LIVES DISPLAY
// ==========================================

function updateScoreDisplay() {
    const scoreElement = document.getElementById("score");
    scoreElement.textContent = score;
}

function updateLivesDisplay() {
    const livesElement = document.getElementById("lives");
    if (lives > 0) {
        livesElement.textContent = "❤️ ".repeat(lives);
    } else {
        livesElement.textContent = "💔";
    }
}


// ==========================================
// DRAW GAME
// ==========================================

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#dff3ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawIngredients();
    drawPlayer();

    if (gameOver && score < WIN_SCORE) {
        drawGameOver();
    }
}


// ==========================================
// GAME OVER SCREEN (LOSS ONLY)
// ==========================================

function drawGameOver() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.font = "50px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 50);

    ctx.font = "28px Arial";
    ctx.fillText("Score: " + score, canvas.width / 2, canvas.height / 2);

    ctx.font = "20px Arial";
    ctx.fillText("Press R to play again", canvas.width / 2, canvas.height / 2 + 50);
}


// ==========================================
// RESTART GAME
// ==========================================

function restartGame() {
    score = 0;
    lives = 3;
    gameOver = false;
    ingredients = [];
    createInitialIngredients();
    updateScoreDisplay();
    updateLivesDisplay();
}

document.addEventListener("keydown", function(event) {
    if (event.key.toLowerCase() === "r" && gameOver && score < WIN_SCORE) {
        restartGame();
    }
});


// ==========================================
// GAME LOOP & START
// ==========================================

function gameLoop() {
    if (!gameOver) {
        updatePlayer();
        updateIngredients();
    }

    drawGame();
    requestAnimationFrame(gameLoop);
}

createInitialIngredients();
updateScoreDisplay();
updateLivesDisplay();
gameLoop();