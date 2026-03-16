const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 1. 이미지 및 사운드 로드 ---
const playerImg = new Image(); playerImg.src = 'player.png'; 
const boosterImg = new Image(); boosterImg.src = 'booster.png'; 
const bgImg = new Image(); bgImg.src = 'background.png'; 

// 사운드 객체를 미리 생성하고 로딩을 강제함
const sndJump = new Audio('Jump.wav');
const sndBreak = new Audio('Break.wav');
const sndBgm = new Audio('bgm.wav'); 

sndJump.preload = 'auto';
sndBreak.preload = 'auto';
sndBgm.loop = true; 
sndBgm.volume = 0.3; 

let player, platforms, items, score, highScore = 0, isGameOver, gravity, keys, frameCount, bgY;
let bgmStarted = false;
let isMuted = false;

const PLATFORM_GAP = 140;
const ITEM_CHANCE = 0.05;
const BREAKING_TIME = 15;
const MOVE_SPEED = 0.02;
const SPRITE_SIZE = 32; 
const ANIM_SPEED = 6;   

const PLAT_TYPE = { NORMAL: 'normal', MOVING: 'moving', BREAKING: 'breaking' };

function init() {
    player = { 
        x: 168, y: 500, w: 64, h: 64, 
        vy: 0, normalJump: -13, boosterJump: -38, 
        isBooster: false,
        frameX: 0, animTimer: 0, facingRight: true 
    };
    platforms = []; items = []; score = 0; frameCount = 0;
    bgY = 0; isGameOver = false; gravity = 0.5; keys = {};
    
    platforms.push({ x: 150, y: 600, w: 100, h: 15, type: PLAT_TYPE.NORMAL });
    for (let i = 1; i < 7; i++) spawnPlatform(600 - (i * PLATFORM_GAP));
}

function spawnPlatform(y) {
    const w = 70;
    const x = 50 + Math.random() * (canvas.width - 100 - w);
    const randomTypeVal = Math.random();
    let type = (randomTypeVal < 0.3) ? PLAT_TYPE.MOVING : (randomTypeVal < 0.6 ? PLAT_TYPE.BREAKING : PLAT_TYPE.NORMAL);
    platforms.push({ x, y, w, h: 15, type, centerX: x, offset: Math.random() * 100, isBreaking: false, breakingTimer: 0 });
    if (type === PLAT_TYPE.NORMAL && Math.random() < ITEM_CHANCE) {
        items.push({ x: x + w/2 - 15, y: y - 35, w: 30, h: 30, active: true });
    }
}

// 🔥 사운드 재생 필살기: 겹쳐서 재생 가능하도록 복제본 생성
function playSound(audio) {
    if (isMuted) return; 
    const soundCopy = audio.cloneNode(); // 원본을 복제해서 사용 (끊김 방지)
    soundCopy.volume = 0.5;
    soundCopy.play().catch(e => console.log("재생 지연:", e));
}

function startBgm() {
    if (!bgmStarted && !isMuted) {
        sndBgm.play().then(() => { bgmStarted = true; }).catch(() => {});
    }
}

canvas.addEventListener('mousedown', e => {
    startBgm();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (mx > canvas.width - 60 && my < 50) {
        isMuted = !isMuted;
        if (isMuted) sndBgm.pause();
        else startBgm();
        return; 
    }
    if (isGameOver) init();
});

window.addEventListener('keydown', e => {
    startBgm();
    keys[e.code] = true;
    if (isGameOver && (e.code === 'Space')) init();
});

window.addEventListener('keyup', e => { keys[e.code] = false; });

function update() {
    if (isGameOver) return;
    frameCount++;
    player.animTimer++;
    
    if (player.animTimer % ANIM_SPEED === 0) {
        if (player.isBooster && player.vy < 0) player.frameX = 5;
        else if (player.vy >= 0) player.frameX = 6 + (Math.floor(player.animTimer / ANIM_SPEED) % 2);
        else player.frameX = (player.frameX + 1) % 5;
    }

    player.vy += gravity;
    player.y += player.vy;

    if (keys['ArrowLeft']) { player.x -= 7; player.facingRight = false; }
    if (keys['ArrowRight']) { player.x += 7; player.facingRight = true; }

    if (player.x + player.w < 0) player.x = canvas.width;
    if (player.x > canvas.width) player.x = -player.w;

    for (let i = platforms.length - 1; i >= 0; i--) {
        let plat = platforms[i];
        if (plat.type === PLAT_TYPE.MOVING) {
            let targetX = plat.centerX + Math.sin((frameCount + plat.offset) * MOVE_SPEED) * 100;
            plat.x = Math.max(0, Math.min(canvas.width - plat.w, targetX));
        }
        
        // 🛠️ 발판 부서지는 로직 보강
        if (plat.isBreaking) {
            plat.breakingTimer++;
            plat.x += (Math.random() - 0.5) * 6;
            
            // 처음 부서지기 시작할 때 딱 한 번만 소리 재생
            if (plat.breakingTimer === 1) {
                playSound(sndBreak);
            }

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
            
            // 노란색 발판이면 부서지기 시작!
            if (plat.type === PLAT_TYPE.BREAKING && !plat.isBreaking) {
                plat.isBreaking = true;
                plat.breakingTimer = 0; // 타이머 초기화
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

    if (player.y > canvas.height) {
        isGameOver = true;
        if (Math.floor(score) > highScore) highScore = Math.floor(score);
        sndBgm.pause();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    ctx.font = "24px Arial";
    ctx.fillText(isMuted ? "🔇" : "🔊", canvas.width - 15, 35);

    if (isGameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,canvas.width, canvas.height);
        ctx.fillStyle = "#fff"; ctx.font = "30px Arial"; ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2);
        ctx.font = "16px Arial"; ctx.fillText("Press Space to Retry", canvas.width/2, canvas.height/2 + 80);
    }
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
window.onload = () => { init(); gameLoop(); };
