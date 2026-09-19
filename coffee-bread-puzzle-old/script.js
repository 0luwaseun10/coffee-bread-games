const puzzles = {
    plato: { name: "Plato Típico", image: "images/plato-tipico.png", alt: "Completed Plato Típico puzzle" },
    pollo: { name: "Pollo con Tajadas", image: "images/pollo-tajadas.png", alt: "Completed Pollo con Tajadas puzzle" },
    pupusas: { name: "Pupusas", image: "images/pupusas.png", alt: "Completed pupusas puzzle" }
};

const solvedBoard = [0, 1, 2, 3, 4, 5, 6, 7, 8];
let board = [...solvedBoard];
let selectedPuzzle = "plato";
let moves = 0;
let acceptingMoves = true;

const selectionScreen = document.querySelector("#selectionScreen");
const gameScreen = document.querySelector("#gameScreen");
const puzzleElement = document.querySelector("#puzzle");
const puzzleTitle = document.querySelector("#puzzleTitle");
const previewImage = document.querySelector("#previewImage");
const moveCount = document.querySelector("#moveCount");
const winModal = document.querySelector("#winModal");
const finalMoves = document.querySelector("#finalMoves");
const completedDish = document.querySelector("#completedDish");
const revealRewardButton = document.querySelector("#revealRewardButton");
const rewardResult = document.querySelector("#rewardResult");
const rewardCode = document.querySelector("#rewardCode");

document.querySelectorAll(".food-option").forEach((card) => {
    card.addEventListener("click", () => startPuzzle(card.dataset.puzzle));
});

document.querySelector("#backButton").addEventListener("click", showSelection);
document.querySelector("#restartButton").addEventListener("click", shuffleAndRender);
document.querySelector("#playAgainButton").addEventListener("click", () => {
    closeModal();
    shuffleAndRender();
});
document.querySelector("#choosePuzzleButton").addEventListener("click", () => {
    closeModal();
    showSelection();
});

revealRewardButton.addEventListener("click", () => {
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    rewardCode.textContent = `CB-${suffix}`;
    revealRewardButton.hidden = true;
    rewardResult.hidden = false;
});

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
    gameScreen.hidden = true;
    selectionScreen.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function shuffleAndRender() {
    board = [...solvedBoard];
    let blankIndex = 8;
    let previousBlank = -1;

    for (let i = 0; i < 180; i += 1) {
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
            tile.addEventListener("click", () => moveTile(boardIndex));
        }

        puzzleElement.appendChild(tile);
    });
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
        window.setTimeout(openWinModal, 280);
    }
}

function isSolved() {
    return board.every((piece, index) => piece === solvedBoard[index]);
}

function updateMoveCount() {
    moveCount.textContent = moves;
}

function openWinModal() {
    completedDish.textContent = puzzles[selectedPuzzle].name;
    finalMoves.textContent = moves;
    revealRewardButton.hidden = false;
    rewardResult.hidden = true;
    winModal.hidden = false;
    document.querySelector("#playAgainButton").focus();
}

function closeModal() {
    winModal.hidden = true;
}
