const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const modeUI = document.getElementById('mode-selection');
const mobileUI = document.getElementById('mobile-controls');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

// --- 이미지 및 사운드 로드 ---
const playerImg = new Image(); playerImg.src = './player.png'; 
const boosterImg = new Image(); boosterImg.src = './booster.png'; 
const bgImg = new Image(); bgImg.src = './background.png'; 
const sndJump = new Audio('./Jump.wav'); 
const sndBreak = new Audio('./break.wav');
const sndBgm = new Audio('./bgm.wav'); 

sndBgm.loop = true; 
sndBgm.volume = 0.3; 

let player, platforms, items, score, highScore = 0, isGameOver, gravity, keys, frameCount, bgY;
let bgmStarted = false;
let isMuted = false;
let controlMode = null; 

// 🔥 배속 버그 방지용 변수
let gameLoopId = null; 

const PLATFORM_GAP = 140;
const ITEM_CHANCE = 0.05;
const BREAKING_TIME = 15;
const MOVE_SPEED = 0.02;
const SPRITE_SIZE = 32; 
const ANIM_SPEED = 6;   

const PLAT_TYPE = { NORMAL: 'normal', MOVING: 'moving', BREAKING: 'breaking' };

function selectMode(mode) {
    controlMode = mode;
    modeUI.style.display = 'none';
    if (mode === 'mobile') mobileUI.style.display = 'flex';
    init();
}

function init() {
    // 🔥 만약 이미 루프가 돌고 있다면 취소 (중복 실행 방지 핵심)
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }

    player = { x: 168, y: 500, w: 64, h: 64, vy: 0, normalJump: -13, boosterJump: -38, isBooster: false, frameX: 0, animTimer: 0, facingRight: true };
    platforms = []; items = []; score = 0; frameCount = 0; bgY = 0; isGameOver = false; gravity = 0.5; keys = {};
    
    platforms.push({ x: 150, y: 600, w: 100, h: 15, type: PLAT_TYPE.NORMAL });
    for (let i = 1; i < 7; i++) spawnPlatform(600 - (i * PLATFORM_GAP));

    // 게임 루프 시작
    gameLoop();
}

function spawnPlatform(y) {
    const w = 70; const x = 50 + Math.random() * (canvas.width - 100 - w);
    const r = Math.random();
    let type = (r < 0.3) ? PLAT_TYPE.MOVING : (r < 0.6 ? PLAT_TYPE.BREAKING : PLAT_TYPE.NORMAL);
    platforms.push({ x, y, w, h: 15, type, centerX: x, offset: Math.random() * 100, isBreaking: false, breakingTimer: 0 });
    if (type === PLAT_TYPE.NORMAL && Math.random() < ITEM_CHANCE) items.push({ x: x + w/2 - 15, y: y - 35, w: 30, h: 30, active: true });
}

function playSound(audio) {
    if (isMuted) return; 
    audio.pause(); audio.currentTime = 0;
    audio.play().catch(() => {});
}

function startBgm() {
    if (!bgmStarted && !isMuted && controlMode) {
        sndBgm.play().then(() => { bgmStarted = true; }).catch(() => {});
    }
}

// 모바일 터치 이벤트 (좌우 이동만 제어)
const handleTouch = (e, key, isDown) => {
    e.preventDefault();
    startBgm();
    keys[key] = isDown;
    if (isDown) e.target.classList.add('active');
    else e.target.classList.remove('active');
};

btnLeft.addEventListener('touchstart', (e) => handleTouch(e, 'ArrowLeft', true), {passive: false});
btnLeft.addEventListener('touchend', (e) => handleTouch(e, 'ArrowLeft', false), {passive: false});
btnRight.addEventListener('touchstart', (e) => handleTouch(e, 'ArrowRight', true), {passive: false});
btnRight.addEventListener('touchend', (e) => handleTouch(e, 'ArrowRight', false), {passive: false});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startBgm();
    if (isGameOver) init();
}, {passive: false});

window.addEventListener('keydown', e => { 
    startBgm(); keys[e.code] = true; 
    if (isGameOver && e.code === 'Space') init(); 
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function update() {
    if (isGameOver || !controlMode) return;
    frameCount++; player.animTimer++;
    
    if (player.animTimer % ANIM_SPEED === 0) {
        if (player.isBooster && player.vy < 0) player.frameX = 5;
        else if (player.vy >= 0) player.frameX = 6 + (Math.floor(player.animTimer / ANIM_SPEED) % 2);
        else player.frameX = (player.frameX + 1) % 5;
    }

    // 물리 연산
    player.vy += gravity;
    player.y += player.vy;

    // 좌우 이동 (점프는 자동)
    if (keys['ArrowLeft']) { player.x -= 7; player.facingRight = false; }
    if (keys['ArrowRight']) { player.x += 7; player.facingRight = true; }

    if (player.x + player.w < 0) player.x = canvas.width; 
    if (player.x > canvas.width) player.x = -player.w;

    // 발판 체크 (자동 점프 로직 포함)
    for (let i = platforms.length - 1; i >= 0; i--) {
        let plat = platforms[i];
        if (plat.type === PLAT_TYPE.MOVING) {
            let targetX = plat.centerX + Math.sin((frameCount + plat.offset) * MOVE_SPEED) * 100;
            plat.x = Math.max(0, Math.min(canvas.width - plat.w, targetX));
        }
        if (plat.isBreaking) {
            plat.breakingTimer++;
            plat.x += (Math.random() - 0.5) * 6;
            if (plat.breakingTimer === 1) playSound(sndBreak);
            if (plat.breakingTimer > BREAKING_TIME) {
                platforms.splice(i, 1);
                spawnPlatform(Math.min(...platforms.map(p => p.y)) - PLATFORM_GAP);
                continue;
            }
        }
        // 발판 밟기 (자동 점프)
        if (player.vy > 0 && player.x + 20 < plat.x + plat.w && player.x + player.w - 20 > plat.x &&
            player.y + player.h > plat.y && player.y + player.h < plat.y + plat.h + player.vy + 2) {
            player.vy = player.normalJump;
            player.isBooster = false; playSound(sndJump);
            if (plat.type === PLAT_TYPE.BREAKING && !plat.isBreaking) {
                plat.isBreaking = true; plat.breakingTimer = 0;
            }
        }
    }

    items.forEach(item => {
        if (item.active && player.x < item.x + item.w && player.x + player.w > item.x &&
            player.y < item.y + item.h && player.y + player.h > item.y) {
            item.active = false; player.vy = player.boosterJump; player.isBooster = true;
            playSound(sndJump); 
        }
    });

    if (player.y < 300) {
        let diff = 300 - player.y; player.y = 300; score += diff / 60;
        bgY = (bgY + diff * 0.4) % canvas.height;
        platforms.forEach(plat => {
            plat.y += diff;
            if (plat.y > canvas.height) { platforms.splice(platforms.indexOf(plat), 1); spawnPlatform(Math.min(...platforms.map(p => p.y)) - PLATFORM_GAP); }
        });
        items.forEach(item => { item.y += diff; if (item.y > canvas.height) items.splice(items.indexOf(item), 1); });
    }
    if (player.y > canvas.height) { isGameOver = true; if (Math.floor(score) > highScore) highScore = Math.floor(score); sndBgm.pause(); bgmStarted = false; }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!controlMode) return;

    ctx.drawImage(bgImg, 0, bgY, canvas.width, canvas.height);
    ctx.drawImage(bgImg, 0, bgY - canvas.height, canvas.width, canvas.height);

    platforms.forEach(plat => {
        if (plat.isBreaking) ctx.globalAlpha = 0.6;
        ctx.fillStyle = (plat.type === PLAT_TYPE.MOVING) ? "#45aaf2" : (plat.type === PLAT_TYPE.BREAKING ? "#fed330" : "#4ecdc4");
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)"; ctx.fillRect(plat.x, plat.y, plat.w, 4);
        ctx.globalAlpha = 1.0;
    });
    items.forEach(item => { if (item.active) ctx.drawImage(boosterImg, item.x, item.y, item.w, item.h); });

    ctx.save();
    if (player.isBooster) { ctx.shadowBlur = 40; ctx.shadowColor = "white"; }
    if (!player.facingRight) {
        ctx.scale(-1, 1);
        ctx.drawImage(playerImg, player.frameX * SPRITE_SIZE, 0, SPRITE_SIZE, SPRITE_SIZE, -player.x - player.w, player.y, player.w, player.h);
    } else {
        ctx.drawImage(playerImg, player.frameX * SPRITE_SIZE, 0, SPRITE_SIZE, SPRITE_SIZE, player.x, player.y, player.w, player.h);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; ctx.fillRect(0, 0, canvas.width, 50);
    ctx.fillStyle = "#fff"; ctx.font = "bold 18px Arial"; ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${Math.floor(score)}m`, 20, 32);
    ctx.fillStyle = "#fed330"; ctx.textAlign = "right";
    ctx.fillText(`BEST: ${highScore}m`, canvas.width - 60, 32);
    ctx.font = "24px Arial"; ctx.fillText(isMuted ? "🔇" : "🔊", canvas.width - 15, 35);

    if (isGameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,canvas.width, canvas.height);
        ctx.fillStyle = "#fff"; ctx.font = "30px Arial"; ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2);
    }
}

function gameLoop() {
    update();
    draw();
    gameLoopId = requestAnimationFrame(gameLoop);
}
