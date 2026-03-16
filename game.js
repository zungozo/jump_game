const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const modeUI = document.getElementById('mode-selection');

const playerImg = new Image(); playerImg.src = './player.png'; 
const boosterImg = new Image(); boosterImg.src = './booster.png'; 
const bgImg = new Image(); bgImg.src = './background.png'; 

const sndJump = new Audio('./Jump.wav'); 
const sndBreak = new Audio('./break.wav');
const sndBgm = new Audio('./bgm.wav'); 

sndJump.preload = 'auto';
sndBreak.preload = 'auto';
sndBgm.loop = true; 
sndBgm.volume = 0.3; 

let player, platforms, items, score, highScore = 0, isGameOver, gravity, keys, frameCount, bgY;
let bgmStarted = false;
let isMuted = false;
let controlMode = null; 

// 조이스틱 설정 (maxDist를 조절하면 조이스틱의 민감도가 변합니다)
let joystick = { active: false, x: 0, y: 0, currX: 0, currY: 0, radius: 40, maxDist: 60 };

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
    init();
    if (!bgmStarted) startBgm();
}

function init() {
    player = { x: 168, y: 500, w: 64, h: 64, vy: 0, normalJump: -13, boosterJump: -38, isBooster: false, frameX: 0, animTimer: 0, facingRight: true };
    platforms = []; items = []; score = 0; frameCount = 0; bgY = 0; isGameOver = false; gravity = 0.5; keys = {};
    platforms.push({ x: 150, y: 600, w: 100, h: 15, type: PLAT_TYPE.NORMAL });
    for (let i = 1; i < 7; i++) spawnPlatform(600 - (i * PLATFORM_GAP));
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
    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.catch(() => { audio.load(); audio.play(); });
    }
}

function startBgm() {
    if (!bgmStarted && !isMuted && controlMode) {
        sndBgm.play().then(() => { bgmStarted = true; }).catch(() => {});
    }
}

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    startBgm();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const tx = touch.clientX - rect.left;
    const ty = touch.clientY - rect.top;

    if (tx > canvas.width - 60 && ty < 50) {
        isMuted = !isMuted;
        if (isMuted) { sndBgm.pause(); bgmStarted = false; } else startBgm();
        return;
    }

    if (isGameOver) {
        init();
    } else if (controlMode === 'mobile') {
        joystick.active = true;
        joystick.x = tx;
        joystick.y = ty;
        joystick.currX = tx;
        joystick.currY = ty;
    }
}, {passive: false});

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (joystick.active) {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        joystick.currX = touch.clientX - rect.left;
        joystick.currY = touch.clientY - rect.top;
    }
}, {passive: false});

canvas.addEventListener('touchend', () => { joystick.active = false; });

canvas.addEventListener('mousedown', e => {
    if (!controlMode) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (mx > canvas.width - 60 && my < 50) {
        isMuted = !isMuted;
        if (isMuted) { sndBgm.pause(); bgmStarted = false; } else startBgm();
        return; 
    }
    if (isGameOver) init();
});

window.addEventListener('keydown', e => {
    if (!controlMode) return;
    startBgm();
    keys[e.code] = true;
    if (isGameOver && (e.code === 'Space')) init();
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

    player.vy += gravity; player.y += player.vy;

    if (controlMode === 'pc') {
        if (keys['ArrowLeft']) { player.x -= 7; player.facingRight = false; }
        if (keys['ArrowRight']) { player.x += 7; player.facingRight = true; }
    } else if (controlMode === 'mobile' && joystick.active) {
        let dx = joystick.currX - joystick.x;
        if (Math.abs(dx) > 5) { 
            // 거리 비율에 따른 속도 계산 (최대 7)
            let moveAmount = (dx / joystick.maxDist) * 7;
            // 속도 제한 (Clamp)
            if (moveAmount > 7) moveAmount = 7;
            if (moveAmount < -7) moveAmount = -7;
            
            player.x += moveAmount;
            player.facingRight = dx > 0;
        }
    }

    if (player.x + player.w < 0) player.x = canvas.width; if (player.x > canvas.width) player.x = -player.w;

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

        if (player.vy > 0 && player.x + 20 < plat.x + plat.w && player.x + player.w - 20 > plat.x &&
            player.y + player.h > plat.y && player.y + player.h < plat.y + plat.h + player.vy) {
            player.vy = player.normalJump;
            player.isBooster = false;
            playSound(sndJump);
            if (plat.type === PLAT_TYPE.BREAKING && !plat.isBreaking) {
                plat.isBreaking = true;
                plat.breakingTimer = 0;
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

    if (controlMode === 'mobile' && joystick.active) {
        ctx.beginPath();
        ctx.arc(joystick.x, joystick.y, joystick.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fill();
        
        ctx.beginPath();
        let angle = Math.atan2(joystick.currY - joystick.y, joystick.currX - joystick.x);
        let dist = Math.min(joystick.maxDist, Math.hypot(joystick.currX - joystick.x, joystick.currY - joystick.y));
        let headX = joystick.x + Math.cos(angle) * dist;
        let headY = joystick.y + Math.sin(angle) * dist;
        ctx.arc(headX, headY, 20, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fill();
    }

    if (isGameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,canvas.width, canvas.height);
        ctx.fillStyle = "#fff"; ctx.font = "30px Arial"; ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2);
        ctx.font = "16px Arial"; 
        ctx.fillText(controlMode === 'pc' ? "Press Space to Retry" : "Tap Screen to Retry", canvas.width/2, canvas.height/2 + 80);
    }
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
gameLoop();
