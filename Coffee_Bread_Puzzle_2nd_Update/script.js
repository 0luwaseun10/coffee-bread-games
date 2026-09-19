const puzzles = {
    plato: {
        name: "Plato Típico",
        image: "images/plato-tipico.png",
        alt: "Completed Plato Típico puzzle",
        shuffleMoves: 10
    },
    pollo: {
        name: "Pollo con Tajadas",
        image: "images/pollo-tajadas.png",
        alt: "Completed Pollo con Tajadas puzzle",
        shuffleMoves: 14
    },
    pupusas: {
        name: "Pupusas",
        image: "images/pupusas.png",
        alt: "Completed Pupusas puzzle",
        shuffleMoves: 12
    },
    truck: {
        name: "Coffee & Bread Truck",
        image: "images/coffee-bread-truck.jpg",
        alt: "Completed Coffee & Bread food truck puzzle",
        shuffleMoves: 10
    }
};

const COFFEE_BREAD_REWARD_LENGTH = 30 * 60 * 1000;
const solvedBoard = [0, 1, 2, 3, 4, 5, 6, 7, 8];

let board = [...solvedBoard];
let selectedPuzzle = "pupusas";
let moves = 0;
let acceptingMoves = false;
let hintTimer;

const selectionScreen = document.querySelector("#selectionScreen");
const gameScreen = document.querySelector("#gameScreen");
const puzzleElement = document.querySelector("#puzzle");
const puzzleTitle = document.querySelector("#puzzleTitle");
const previewImage = document.querySelector("#previewImage");
const moveCount = document.querySelector("#moveCount");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");
const hintButton = document.querySelector("#hintButton");

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
        minute: "2-digit",
        second: "2-digit"
    });
}

function formatCoffeeBreadCountdown(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
}

function startPuzzle(key) {
    selectedPuzzle = key;
    const selected = puzzles[key];

    puzzleTitle.textContent = selected.name;
    previewImage.src = selected.image;
    previewImage.alt = selected.alt;

    selectionScreen.hidden = true;
    gameScreen.hidden = false;

    shuffleAndRender();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showSelection() {
    acceptingMoves = false;
    clearTimeout(hintTimer);
    removeRewardScreen();
    gameScreen.hidden = true;
    selectionScreen.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function shuffleAndRender() {
    board = [...solvedBoard];
    let blankIndex = 8;
    let previousBlank = -1;
    const shuffleMoves = puzzles[selectedPuzzle].shuffleMoves;

    for (let i = 0; i < shuffleMoves; i += 1) {
        const options = adjacentIndexes(blankIndex).filter((index) => index !== previousBlank);
        const chosen = options[Math.floor(Math.random() * options.length)];

        [board[blankIndex], board[chosen]] = [board[chosen], board[blankIndex]];
        previousBlank = blankIndex;
        blankIndex = chosen;
    }

    if (isSolved()) return shuffleAndRender();

    moves = 0;
    acceptingMoves = true;
    updateMoveCount();
    renderBoard();
}

function adjacentIndexes(index) {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const indexes = [];

    if (row > 0) indexes.push(index - 3);
    if (row < 2) indexes.push(index + 3);
    if (column > 0) indexes.push(index - 1);
    if (column < 2) indexes.push(index + 1);

    return indexes;
}

function renderBoard() {
    puzzleElement.innerHTML = "";

    const image = puzzles[selectedPuzzle].image;
    const blankIndex = board.indexOf(8);
    const movableIndexes = adjacentIndexes(blankIndex);

    board.forEach((piece, boardIndex) => {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = piece === 8 ? "tile blank" : "tile";
        tile.setAttribute("role", "gridcell");

        if (piece === 8) {
            tile.disabled = true;
            tile.setAttribute("aria-label", "Empty space");
        } else {
            const sourceRow = Math.floor(piece / 3);
            const sourceColumn = piece % 3;

            tile.style.backgroundImage = `url("${image}")`;
            tile.style.backgroundSize = "300% 300%";
            tile.style.backgroundPosition = `${sourceColumn * 50}% ${sourceRow * 50}%`;
            tile.setAttribute("aria-label", `Puzzle tile ${piece + 1}`);

            if (movableIndexes.includes(boardIndex)) {
                tile.classList.add("movable");
            }

            tile.addEventListener("click", () => moveTile(boardIndex));
        }

        puzzleElement.appendChild(tile);
    });

    updateProgress();
}

function moveTile(tileIndex) {
    if (!acceptingMoves) return;

    const blankIndex = board.indexOf(8);
    if (!adjacentIndexes(blankIndex).includes(tileIndex)) return;

    [board[blankIndex], board[tileIndex]] = [board[tileIndex], board[blankIndex]];
    moves += 1;

    updateMoveCount();
    renderBoard();

    if (isSolved()) {
        acceptingMoves = false;
        progressText.textContent = "100%";
        progressBar.style.width = "100%";

        window.setTimeout(() => {
            showCoffeeBreadCompletion(shuffleAndRender);
        }, 250);
    }
}

function showHint() {
    if (!acceptingMoves) return;

    clearTimeout(hintTimer);

    const blankIndex = board.indexOf(8);
    const candidates = adjacentIndexes(blankIndex);

    const bestMove = candidates.reduce((best, index) => {
        const bestScore = solvedPositionScoreAfterMove(best, blankIndex);
        const score = solvedPositionScoreAfterMove(index, blankIndex);
        return score > bestScore ? index : best;
    }, candidates[0]);

    const tile = puzzleElement.children[bestMove];
    if (!tile) return;

    tile.classList.add("hint");
    tile.focus({ preventScroll: true });
    hintButton.textContent = "Helpful move highlighted";

    hintTimer = window.setTimeout(() => {
        tile.classList.remove("hint");
        hintButton.textContent = "Show a helpful move";
    }, 1800);
}

function solvedPositionScoreAfterMove(tileIndex, blankIndex) {
    const testBoard = [...board];
    [testBoard[blankIndex], testBoard[tileIndex]] = [testBoard[tileIndex], testBoard[blankIndex]];

    return testBoard.reduce(
        (score, piece, index) => score + (piece === index ? 1 : 0),
        0
    );
}

function isSolved() {
    return board.every((piece, index) => piece === solvedBoard[index]);
}

function updateMoveCount() {
    moveCount.textContent = moves;
}

function updateProgress() {
    const piecesInPlace = board.reduce(
        (count, piece, index) => count + (piece === index && piece !== 8 ? 1 : 0),
        0
    );

    const percent = Math.round((piecesInPlace / 8) * 100);
    progressText.textContent = `${percent}%`;
    progressBar.style.width = `${percent}%`;
}

function removeRewardScreen() {
    const oldScreen = document.getElementById("coffeeBreadRewardScreen");

    if (oldScreen) {
        const timer = oldScreen.dataset.timer;
        if (timer) clearInterval(Number(timer));
        oldScreen.remove();
    }
}

function showCoffeeBreadCompletion(onPlayAgain) {
    removeRewardScreen();

    const existingReward = getCoffeeBreadReward();
    const screen = document.createElement("div");

    screen.id = "coffeeBreadRewardScreen";
    screen.className = "cb-reward-screen";

    if (existingReward) {
        screen.innerHTML = `
            <div class="cb-reward-card">
                <h2>DAILY REWARD CLAIMED</h2>
                <p>This browser has already earned a reward today.</p>
                <p class="cb-completed-time">Today's reward was earned:<br>${formatCoffeeBreadTime(existingReward.completedAt)}</p>
                <p>You can still play again, but another reward cannot be earned in this browser until tomorrow.</p>
                <button id="cbPlayAgain" type="button">PLAY AGAIN</button>
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
            console.warn("Reward could not be saved to local storage.", error);
        }

        screen.innerHTML = `
            <div class="cb-reward-card">
                <h2>GAME COMPLETED!</h2>
                <p class="cb-completed-time">Completed:<br>${formatCoffeeBreadTime(completedAt)}</p>
                <p class="cb-countdown" id="cbCountdown"></p>
                <p>Show this live screen for one free drink with a $10+ food order.</p>
                <button id="cbPlayAgain" type="button">PLAY AGAIN</button>
            </div>
        `;

        const countdown = screen.querySelector("#cbCountdown");

        const updateCountdown = function () {
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

    const playAgainButton = screen.querySelector("#cbPlayAgain");

    playAgainButton.addEventListener("click", function () {
        const timer = screen.dataset.timer;
        if (timer) clearInterval(Number(timer));

        screen.remove();

        if (onPlayAgain) {
            onPlayAgain();
        }
    });

    playAgainButton.focus();
}

document.querySelectorAll(".food-option").forEach((card) => {
    card.addEventListener("click", () => startPuzzle(card.dataset.puzzle));
});

document.querySelector("#backButton").addEventListener("click", showSelection);
document.querySelector("#restartButton").addEventListener("click", shuffleAndRender);
hintButton.addEventListener("click", showHint);
