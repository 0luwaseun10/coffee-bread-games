const canvas = document.getElementById("game");
const dropButton = document.getElementById("dropButton");

// Responsive 500 × 650 game area
canvas.width = 500;
canvas.height = 650;

canvas.style.width = "min(92vw, 500px)";
canvas.style.height = "auto";
canvas.style.touchAction = "manipulation";

dropButton.style.width = "min(92vw, 500px)";
dropButton.style.touchAction = "manipulation";

const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";

const imageFiles = {
    bottomBun: "images/bottom-bun.png",
    topBun: "images/top-bun.png",
    patty: "images/patty.png",
    cheese: "images/cheese.png",
    lettuce: "images/lettuce.png",
    tomato: "images/tomato.png"
};

const imageCrops = {
    bottomBun: {
        x: 64,
        y: 245,
        width: 1408,
        height: 541
    },
    topBun: {
        x: 19,
        y: 157,
        width: 1499,
        height: 687
    },
    patty: {
        x: 27,
        y: 200,
        width: 1483,
        height: 608
    },
    cheese: {
        x: 37,
        y: 207,
        width: 1700,
        height: 458
    },
    lettuce: {
        x: 20,
        y: 255,
        width: 1632,
        height: 431
    },
    tomato: {
        x: 36,
        y: 129,
        width: 1467,
        height: 739
    }
};

const foodImages = {};

for (const name in imageFiles) {
    foodImages[name] = new Image();
    foodImages[name].src = imageFiles[name];
}

const ingredients = [
    {
        name: "Patty",
        image: "patty",
        width: 205,
        height: 30,
        overlap: 10
    },
    {
        name: "Cheese",
        image: "cheese",
        width: 220,
        height: 18,
        overlap: 14
    },
    {
        name: "Lettuce",
        image: "lettuce",
        width: 225,
        height: 20,
        overlap: 12
    },
    {
        name: "Tomato",
        image: "tomato",
        width: 195,
        height: 24,
        overlap: 10
    }
];

const burgerSizes = [5, 8, 10];
let targetPieces = 5;

let stack;
let currentIngredient;
let score;
let gameStatus;
let rewardClaim;

const REWARD_LENGTH_MS = 30 * 1000;

function getTodayRewardKey() {
    const now = new Date();
    const date = now.toLocaleDateString("en-CA");

    return "coffeeBreadReward_" + date;
}

function getTodayReward() {
    try {
        const savedReward = localStorage.getItem(
            getTodayRewardKey()
        );

        return savedReward
            ? JSON.parse(savedReward)
            : null;
    } catch (error) {
        return null;
    }
}

function createRewardClaim() {
    const completedAt = new Date();

    rewardClaim = {
        completedAt: completedAt.getTime(),
        expiresAt:
            completedAt.getTime() +
            REWARD_LENGTH_MS
    };

    try {
        localStorage.setItem(
            getTodayRewardKey(),
            JSON.stringify(rewardClaim)
        );
    } catch (error) {
        // Game still works if browser storage is unavailable.
    }
}

function formatCompletedTime(timestamp) {
    return new Date(timestamp).toLocaleString(
        "en-US",
        {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    );
}

function formatCountdown(milliseconds) {
    const totalSeconds = Math.max(
        0,
        Math.ceil(milliseconds / 1000)
    );

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return (
        minutes + ":" + String(seconds).padStart(2, "0")
    );
}

function chooseNextBurgerSize() {
    const availableSizes = burgerSizes.filter(
        size => size !== targetPieces
    );

    const randomIndex = Math.floor(
        Math.random() * availableSizes.length
    );

    targetPieces = availableSizes[randomIndex];
}

function resetGame() {
    score = 0;
    gameStatus = "playing";

    stack = [
        {
            name: "Bottom Bun",
            image: "bottomBun",
            x: (canvas.width - 210) / 2,
            y: canvas.height - 105,
            width: 210,
            height: 34,
            overlap: 0
        }
    ];

    dropButton.textContent = "DROP";

    createIngredient();
}

function createIngredient() {
    let design;

    if (score === targetPieces - 1) {
        design = {
            name: "Top Bun",
            image: "topBun",
            width: 215,
            height: 48,
            overlap: 13
        };
    } else {
        design = ingredients[
            score % ingredients.length
        ];
    }

    const increasingSpeed = Math.min(
        9,
        2.2 + score * 0.9
    );

    const randomExtraSpeed = Math.random() * 0.35;

    const randomDirection =
        Math.random() < 0.5 ? 1 : -1;

    currentIngredient = {
        ...design,
        x:
            randomDirection === 1
                ? 0
                : canvas.width - design.width,
        y: 105,
        speed: increasingSpeed + randomExtraSpeed,
        direction: randomDirection,
        falling: false,
        checkedLanding: false
    };
}

function update() {
    if (
        gameStatus !== "playing" ||
        !currentIngredient
    ) {
        return;
    }

    if (!currentIngredient.falling) {
        currentIngredient.x +=
            currentIngredient.speed *
            currentIngredient.direction;

        if (
            currentIngredient.x +
                currentIngredient.width >=
            canvas.width
        ) {
            currentIngredient.x =
                canvas.width -
                currentIngredient.width;

            currentIngredient.direction = -1;
        }

        if (currentIngredient.x <= 0) {
            currentIngredient.x = 0;
            currentIngredient.direction = 1;
        }
    } else {
        currentIngredient.y += 7;

        const topPiece = stack[stack.length - 1];

        const ingredientOverlap =
            currentIngredient.overlap || 8;

        const landingY =
            topPiece.y -
            currentIngredient.height +
            ingredientOverlap;

        if (
            !currentIngredient.checkedLanding &&
            currentIngredient.y >= landingY
        ) {
            currentIngredient.checkedLanding = true;

            const overlapLeft = Math.max(
                currentIngredient.x,
                topPiece.x
            );

            const overlapRight = Math.min(
                currentIngredient.x +
                    currentIngredient.width,
                topPiece.x +
                    topPiece.width
            );

            const overlapWidth = Math.max(
                0,
                overlapRight - overlapLeft
            );

            const smallerWidth = Math.min(
                currentIngredient.width,
                topPiece.width
            );

            const overlapPercentage =
                overlapWidth / smallerWidth;

            const requiredOverlap = Math.min(
                0.82,
                0.68 + score * 0.015
            );

            if (
                overlapPercentage >=
                requiredOverlap
            ) {
                const currentCenter =
                    currentIngredient.x +
                    currentIngredient.width / 2;

                const topCenter =
                    topPiece.x +
                    topPiece.width / 2;

                if (
                    Math.abs(
                        currentCenter - topCenter
                    ) <= 6
                ) {
                    currentIngredient.x =
                        topCenter -
                        currentIngredient.width / 2;
                }

                currentIngredient.y = landingY;

                stack.push({
                    ...currentIngredient
                });

                score++;

                if (score === targetPieces) {
                    currentIngredient = null;

                    if (getTodayReward()) {
                        gameStatus = "dailyLimit";
                        rewardClaim = null;
                    } else {
                        createRewardClaim();
                        gameStatus = "won";
                    }

                    dropButton.textContent = "PLAY AGAIN";
                } else {
                    createIngredient();
                }
            }
        }

        if (
            currentIngredient &&
            currentIngredient.y > canvas.height
        ) {
            gameStatus = "lost";
            currentIngredient = null;

            dropButton.textContent = "TRY AGAIN";
        }
    }
}

function drawIngredient(item) {
    const picture = foodImages[item.image];
    const crop = imageCrops[item.image];

    if (
        picture &&
        crop &&
        picture.complete &&
        picture.naturalWidth > 0
    ) {
        ctx.drawImage(
            picture,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            item.x,
            item.y,
            item.width,
            item.height
        );
    }
}

function drawPlate() {
    ctx.beginPath();

    ctx.ellipse(
        canvas.width / 2,
        canvas.height - 47,
        150,
        17,
        0,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "#f3f3f3";
    ctx.fill();

    ctx.strokeStyle = "#888888";
    ctx.lineWidth = 2;
    ctx.stroke();
}

function draw() {
    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.fillStyle = "#4a2c17";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "left";

    ctx.fillText(
        "Pieces: " +
            score +
            "/" +
            targetPieces,
        20,
        35
    );

    drawPlate();

    stack.forEach(function (ingredient) {
        drawIngredient(ingredient);
    });

    if (currentIngredient) {
        drawIngredient(currentIngredient);
    }

    if (gameStatus === "won") {
        ctx.textAlign = "center";

        ctx.fillStyle = "#ed302b";
        ctx.font = "bold 30px Arial";

        ctx.fillText(
            "GAME COMPLETED!",
            canvas.width / 2,
            78
        );

        ctx.fillStyle = "#4a2c17";
        ctx.font = "bold 17px Arial";

        ctx.fillText(
            "Completed: " +
                formatCompletedTime(
                    rewardClaim.completedAt
                ),
            canvas.width / 2,
            108
        );

        const millisecondsLeft =
            rewardClaim.expiresAt - Date.now();

        if (millisecondsLeft > 0) {
            ctx.fillStyle = "#ed302b";
            ctx.font = "bold 24px Arial";

            ctx.fillText(
                "CLAIM WITHIN " +
                    formatCountdown(millisecondsLeft),
                canvas.width / 2,
                140
            );

            ctx.fillStyle = "#4a2c17";
            ctx.font = "bold 16px Arial";

            ctx.fillText(
                "Show this live screen for a free drink",
                canvas.width / 2,
                166
            );

            ctx.fillText(
                "with a $10+ food order.",
                canvas.width / 2,
                188
            );
        } else {
            ctx.fillStyle = "#ed302b";
            ctx.font = "bold 23px Arial";

            ctx.fillText(
                "REWARD TIME EXPIRED",
                canvas.width / 2,
                145
            );
        }
    }

    if (gameStatus === "dailyLimit") {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ed302b";
        ctx.font = "bold 28px Arial";

        ctx.fillText(
            "DAILY REWARD CLAIMED",
            canvas.width / 2,
            88
        );

        ctx.fillStyle = "#4a2c17";
        ctx.font = "bold 18px Arial";

        ctx.fillText(
            "This browser has already earned",
            canvas.width / 2,
            120
        );

        ctx.fillText(
            "a reward today. Please come back tomorrow!",
            canvas.width / 2,
            145
        );
    }

    if (gameStatus === "lost") {
        ctx.fillStyle =
            "rgba(0, 0, 0, 0.65)";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.font = "bold 38px Arial";

        ctx.fillText(
            "GAME OVER",
            canvas.width / 2,
            290
        );

        ctx.font = "22px Arial";

        ctx.fillText(
            "You stacked " +
                score +
                " pieces",
            canvas.width / 2,
            330
        );
    }
}

function gameLoop() {
    update();
    draw();

    requestAnimationFrame(gameLoop);
}

function handleButtonPress() {
    if (gameStatus === "playing") {
        if (
            currentIngredient &&
            !currentIngredient.falling
        ) {
            currentIngredient.falling = true;
        }
    } else if (
        gameStatus === "won" ||
        gameStatus === "dailyLimit"
    ) {
        chooseNextBurgerSize();
        resetGame();
    } else {
        resetGame();
    }
}

dropButton.addEventListener(
    "pointerdown",
    function (event) {
        event.preventDefault();
        handleButtonPress();
    }
);

canvas.addEventListener(
    "pointerdown",
    function (event) {
        event.preventDefault();
        handleButtonPress();
    }
);

document.addEventListener(
    "keydown",
    function (event) {
        if (event.code === "Space") {
            event.preventDefault();
            handleButtonPress();
        }
    }
);

resetGame();
gameLoop();