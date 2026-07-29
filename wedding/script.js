// script.js — Wedding Invitation Interactive Festivities

document.addEventListener('DOMContentLoaded', () => {
    initScrollAnimations();
    initMobileMenu();
    initBackgroundPetals();
    
    // Festivities
    initRubToReveal();
    initTraceHeart();
    initDhol();
    initDiyas();
    initDandelion();
    initSnowGlobe();

    // Demo modal
    initDemo();
});

// ─── Scroll Animations ─────────────────────────────────────────────────────────
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.animate-on-scroll, .festivity-card').forEach(el => {
        observer.observe(el);
    });
}

// ─── Mobile Menu ────────────────────────────────────────────────────────────────
function initMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuBtn.classList.toggle('active');
        });
    }
}

// ─── Background Falling Petals ──────────────────────────────────────────────────
function initBackgroundPetals() {
    const container = document.getElementById('petal-container');
    if (!container) return;

    const petalColors = ['#7e252c', '#c8a253', '#c73030', '#dda73c', '#f2d98a'];

    function createPetal() {
        const petal = document.createElement('div');
        petal.className = 'petal';
        const size = Math.random() * 12 + 6;
        const startX = Math.random() * 100;
        const drift = (Math.random() - 0.5) * 80;
        const duration = Math.random() * 6 + 8;
        const delay = Math.random() * 10;
        const color = petalColors[Math.floor(Math.random() * petalColors.length)];
        
        petal.style.cssText = `
            left: ${startX}%;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: 50% 0 50% 0;
            --drift: ${drift}px;
            animation-duration: ${duration}s;
            animation-delay: ${delay}s;
            opacity: 0;
        `;
        container.appendChild(petal);
        
        // Remove and recreate after animation
        setTimeout(() => {
            petal.remove();
            createPetal();
        }, (duration + delay) * 1000);
    }

    for (let i = 0; i < 15; i++) {
        createPetal();
    }
}

// ─── Confetti Helper ────────────────────────────────────────────────────────────
function fireConfetti(container) {
    for (let i = 0; i < 30; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti';
        conf.style.left = Math.random() * 100 + '%';
        conf.style.backgroundColor = ['#7e252c', '#c8a253', '#f1eada', '#22a34a', '#c73030'][Math.floor(Math.random() * 5)];
        conf.style.animationDelay = Math.random() * 0.3 + 's';
        container.appendChild(conf);
        setTimeout(() => conf.remove(), 2500);
    }
}

// ─── 1. Rub to Reveal (Haldi Ceremony) ──────────────────────────────────────────
function initRubToReveal() {
    const canvas = document.getElementById('rub-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const hint = document.getElementById('rub-hint');
    const progressBar = document.getElementById('rub-progress');
    let isDrawing = false;
    let revealed = false;

    function setupCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        // Fill with golden turmeric color
        ctx.fillStyle = '#c8a253';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Diamond pattern overlay
        ctx.strokeStyle = 'rgba(184, 135, 58, 0.4)';
        ctx.lineWidth = 1;
        const step = 16;
        for (let i = -canvas.height; i < canvas.width + canvas.height; i += step) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + canvas.height, canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(i + canvas.height, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }

        // Hint text on canvas
        ctx.fillStyle = 'rgba(125, 39, 39, 0.5)';
        ctx.font = '600 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✋ Rub here to reveal', canvas.width / 2, canvas.height / 2);

        ctx.globalCompositeOperation = 'destination-out';
    }
    setupCanvas();

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function startDraw(e) {
        if (revealed) return;
        isDrawing = true;
        if (hint) hint.style.opacity = '0';
        draw(e);
    }

    function stopDraw() {
        isDrawing = false;
        checkReveal();
    }

    function draw(e) {
        if (!isDrawing || revealed) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 28, 0, Math.PI * 2);
        ctx.fill();
        updateProgress();
    }

    function updateProgress() {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let transparent = 0;
        // Sample every 4th pixel for performance
        for (let i = 3; i < pixels.length; i += 16) {
            if (pixels[i] < 128) transparent++;
        }
        const total = pixels.length / 16;
        const percent = Math.min(transparent / total, 1);
        if (progressBar) progressBar.style.width = (percent * 100) + '%';
    }

    function checkReveal() {
        if (revealed) return;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let transparent = 0;
        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] < 128) transparent++;
        }
        const total = pixels.length / 4;
        if (transparent / total > 0.45) {
            revealed = true;
            canvas.style.transition = 'opacity 0.6s ease';
            canvas.style.opacity = '0';
            if (progressBar) progressBar.style.width = '100%';
            setTimeout(() => {
                canvas.style.display = 'none';
                fireConfetti(canvas.parentElement);
            }, 600);
        }
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);
}

// ─── 2. Trace the Heart (Mehndi Ceremony) ───────────────────────────────────────
function initTraceHeart() {
    const canvas = document.getElementById('trace-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const hint = document.getElementById('trace-hint');
    const progressBar = document.getElementById('trace-progress');
    let isTracing = false;
    let traceProgress = 0;
    let completed = false;

    function setupCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        drawHeart();
    }
    setupCanvas();

    // Heart path points
    function getHeartPoints(cx, cy, size) {
        const points = [];
        for (let t = 0; t <= Math.PI * 2; t += 0.05) {
            const x = cx + size * 16 * Math.pow(Math.sin(t), 3) / 16;
            const y = cy - size * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
            points.push({ x, y });
        }
        return points;
    }

    const heartPoints = getHeartPoints(canvas.width / 2, canvas.height / 2 + 10, Math.min(canvas.width, canvas.height) * 0.35);

    function drawHeart() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw dotted outline
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(200, 162, 83, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        heartPoints.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();

        // Draw filled portion
        if (traceProgress > 0) {
            const fillCount = Math.floor(heartPoints.length * traceProgress);
            ctx.setLineDash([]);
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#c8a253');
            gradient.addColorStop(0.5, '#f2d98a');
            gradient.addColorStop(1, '#b8873a');
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            for (let i = 0; i <= fillCount && i < heartPoints.length; i++) {
                const p = heartPoints[i];
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();

            // Golden glow at tip
            if (fillCount > 0 && fillCount < heartPoints.length) {
                const tip = heartPoints[fillCount];
                const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 15);
                glow.addColorStop(0, 'rgba(242, 217, 138, 0.6)');
                glow.addColorStop(1, 'rgba(242, 217, 138, 0)');
                ctx.fillStyle = glow;
                ctx.fillRect(tip.x - 15, tip.y - 15, 30, 30);
            }
        }
    }

    function startTrace(e) {
        if (completed) return;
        isTracing = true;
        if (hint) hint.style.opacity = '0';
    }

    function stopTrace() {
        isTracing = false;
    }

    function updateTrace(e) {
        if (!isTracing || completed) return;
        e.preventDefault();

        traceProgress += 0.015;
        if (traceProgress >= 1) {
            traceProgress = 1;
            completed = true;

            // Fill the heart
            setTimeout(() => {
                ctx.setLineDash([]);
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                gradient.addColorStop(0, 'rgba(200, 162, 83, 0.3)');
                gradient.addColorStop(1, 'rgba(242, 217, 138, 0.3)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                heartPoints.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.closePath();
                ctx.fill();
                fireConfetti(canvas.parentElement);
            }, 200);
        }

        if (progressBar) progressBar.style.width = (traceProgress * 100) + '%';
        drawHeart();
    }

    canvas.addEventListener('mousedown', startTrace);
    canvas.addEventListener('mousemove', updateTrace);
    window.addEventListener('mouseup', stopTrace);
    canvas.addEventListener('touchstart', startTrace, { passive: false });
    canvas.addEventListener('touchmove', updateTrace, { passive: false });
    window.addEventListener('touchend', stopTrace);
}

// ─── 3. Tap the Dhol (Sangeet Night) ────────────────────────────────────────────
function initDhol() {
    const dhol = document.getElementById('dhol');
    const ripplesContainer = document.getElementById('dhol-ripples');
    const counterEl = document.getElementById('beat-counter');
    if (!dhol) return;

    let beats = 0;

    function playDhol(e) {
        beats++;
        if (counterEl) {
            counterEl.querySelector('.beat-count').textContent = beats;
        }

        // Bounce animation
        dhol.classList.remove('dhol-bounce');
        void dhol.offsetWidth;
        dhol.classList.add('dhol-bounce');

        // Screen micro-shake
        document.body.classList.remove('shake');
        void document.body.offsetWidth;
        document.body.classList.add('shake');

        // Expanding ripple rings
        for (let i = 0; i < 3; i++) {
            const ripple = document.createElement('div');
            ripple.className = 'dhol-ripple-ring';
            ripple.style.animationDelay = (i * 0.1) + 's';
            if (ripplesContainer) ripplesContainer.appendChild(ripple);
            setTimeout(() => ripple.remove(), 1200);
        }

        setTimeout(() => document.body.classList.remove('shake'), 200);
    }

    dhol.addEventListener('click', playDhol);
    dhol.addEventListener('touchstart', (e) => {
        e.preventDefault();
        playDhol(e);
    });
}

// ─── 4. Light the Diya ──────────────────────────────────────────────────────────
function initDiyas() {
    const diyas = document.querySelectorAll('.diya');
    const counterEl = document.getElementById('diya-counter');
    const container = document.querySelector('.diya-container');
    if (diyas.length === 0) return;

    let litCount = 0;

    diyas.forEach(diya => {
        diya.addEventListener('click', () => lightDiya(diya));
        diya.addEventListener('touchstart', (e) => {
            e.preventDefault();
            lightDiya(diya);
        });
    });

    function lightDiya(diya) {
        if (diya.classList.contains('lit')) return;

        diya.classList.add('lit');
        litCount++;

        // Update counter
        if (counterEl) {
            counterEl.querySelector('.diya-lit-count').textContent = litCount;
        }

        // Background warming effect
        if (container) {
            const warmth = litCount / diyas.length;
            container.style.background = `radial-gradient(ellipse at center, rgba(242, 217, 138, ${warmth * 0.3}) 0%, transparent 70%)`;
        }

        // Sparkle particles
        for (let i = 0; i < 8; i++) {
            const spark = document.createElement('div');
            spark.className = 'diya-spark';
            const angle = (i / 8) * Math.PI * 2;
            spark.style.setProperty('--dx', Math.cos(angle) * 30 + 'px');
            spark.style.setProperty('--dy', Math.sin(angle) * 30 + 'px');
            diya.appendChild(spark);
            setTimeout(() => spark.remove(), 800);
        }
    }
}

// ─── 5. Blow the Dandelion / Flower Wishes ──────────────────────────────────────
function initDandelion() {
    const canvas = document.getElementById('blow-canvas');
    const blowBtn = document.getElementById('blow-btn');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let blown = false;

    function setupCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
    setupCanvas();

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Create seed particles
    const seeds = [];
    for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 25;
        seeds.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
            originX: cx + Math.cos(angle) * radius,
            originY: cy + Math.sin(angle) * radius,
            vx: 0, vy: 0,
            size: Math.random() * 3 + 1,
            opacity: 1,
            active: false,
            color: Math.random() > 0.5 ? '#c8a253' : '#7e252c'
        });
    }

    // Draw dandelion center
    function drawScene() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw stem
        if (!blown) {
            ctx.strokeStyle = '#22a34a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy + 20);
            ctx.lineTo(cx, canvas.height - 10);
            ctx.stroke();
        }

        // Draw seeds
        seeds.forEach(s => {
            if (s.opacity <= 0) return;
            ctx.globalAlpha = s.opacity;

            // Seed = small line + circle
            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();

            // Tiny line (stem of seed)
            if (!blown || !s.active) {
                ctx.strokeStyle = 'rgba(200, 162, 83, 0.5)';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(cx, cy);
                ctx.stroke();
            }
        });
        ctx.globalAlpha = 1;

        // Center bulb
        ctx.fillStyle = '#c8a253';
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    drawScene();

    function blow() {
        if (blown) return;
        blown = true;
        if (blowBtn) blowBtn.style.opacity = '0.5';

        seeds.forEach((s, i) => {
            setTimeout(() => {
                s.active = true;
                s.vx = (Math.random() - 0.3) * 3;
                s.vy = -(Math.random() * 2 + 1);
            }, i * 40);
        });

        requestAnimationFrame(animateSeeds);
    }

    function animateSeeds() {
        let anyActive = false;

        seeds.forEach(s => {
            if (!s.active || s.opacity <= 0) return;
            anyActive = true;

            s.vy += 0.03; // gentle gravity
            s.x += s.vx + Math.sin(s.y * 0.03) * 0.5;
            s.y += s.vy;
            s.opacity -= 0.003;

            if (s.x > canvas.width + 20 || s.y > canvas.height + 20 || s.x < -20 || s.opacity <= 0) {
                s.opacity = 0;
            }
        });

        drawScene();

        if (anyActive) {
            requestAnimationFrame(animateSeeds);
        }
    }

    if (blowBtn) blowBtn.addEventListener('click', blow);
    canvas.addEventListener('click', blow);

    // Device motion
    if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', (e) => {
            if (blown) return;
            const acc = e.accelerationIncludingGravity;
            if (acc && (Math.abs(acc.x) > 12 || Math.abs(acc.y) > 12)) {
                blow();
            }
        });
    }
}

// ─── 6. Shake the Snow Globe ────────────────────────────────────────────────────
function initSnowGlobe() {
    const globe = document.getElementById('snow-globe');
    const canvas = document.getElementById('globe-canvas');
    if (!globe || !canvas) return;

    const ctx = canvas.getContext('2d');

    function setupCanvas() {
        const glass = globe.querySelector('.globe-glass');
        if (!glass) return;
        canvas.width = glass.offsetWidth;
        canvas.height = glass.offsetHeight;
    }
    setupCanvas();

    const particles = [];
    for (let i = 0; i < 80; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: canvas.height * 0.7 + Math.random() * canvas.height * 0.3, // settle at bottom
            r: Math.random() * 2.5 + 0.5,
            vx: 0,
            vy: 0,
            color: ['#c8a253', '#f2d98a', '#fff', '#f5e1a4', '#dda73c'][Math.floor(Math.random() * 5)],
            sparkle: Math.random()
        });
    }

    let isShaking = false;

    function shake() {
        if (isShaking) return;
        isShaking = true;
        globe.classList.add('shaking');

        particles.forEach(p => {
            p.vy = -(Math.random() * 6 + 2);
            p.vx = (Math.random() - 0.5) * 6;
        });

        setTimeout(() => {
            globe.classList.remove('shaking');
            isShaking = false;
        }, 600);
    }

    function animateGlobe() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) / 2 - 2;

        // Clip to circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        particles.forEach(p => {
            // Gravity
            if (!isShaking) {
                p.vy += 0.06;
                if (p.vy > 2) p.vy = 2;
                p.vx *= 0.97;
            }

            p.x += p.vx;
            p.y += p.vy;

            // Floor
            if (p.y > canvas.height - 10) {
                p.y = canvas.height - 10;
                p.vy = 0;
                p.vx *= 0.9;
            }
            // Ceiling
            if (p.y < 5) {
                p.y = 5;
                p.vy *= -0.3;
            }

            // Walls (inside circle)
            const dx = p.x - cx;
            const dy = p.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > radius - 3) {
                const angle = Math.atan2(dy, dx);
                p.x = cx + Math.cos(angle) * (radius - 4);
                p.y = cy + Math.sin(angle) * (radius - 4);
                p.vx *= -0.4;
                p.vy *= -0.4;
            }

            // Sparkle
            p.sparkle += 0.05;
            const alpha = 0.5 + Math.sin(p.sparkle) * 0.3;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.globalAlpha = 1;
        ctx.restore();
        requestAnimationFrame(animateGlobe);
    }

    animateGlobe();

    globe.addEventListener('click', shake);
    globe.addEventListener('touchstart', (e) => {
        e.preventDefault();
        shake();
    });

    // Device motion
    if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', (e) => {
            const acc = e.accelerationIncludingGravity;
            if (acc && (Math.abs(acc.x) > 13 || Math.abs(acc.y) > 13 || Math.abs(acc.z) > 20)) {
                shake();
            }
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════
// DEMO MODAL — Full interactive wedding invitation preview
// ═══════════════════════════════════════════════════════════════════════
function initDemo() {
    const overlay = document.getElementById('demo-overlay');
    if (!overlay) return;

    const closeBtn = document.getElementById('demo-close');
    const openBtns = document.querySelectorAll('.open-demo');
    const pages = overlay.querySelectorAll('.demo-page');
    const dots = overlay.querySelectorAll('.demo-dot');
    let currentPage = 0;
    let demoInitialized = false;

    // ── Open / Close ──
    function openDemo(e) {
        if (e) e.preventDefault();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        if (!demoInitialized) {
            demoInitialized = true;
            setTimeout(initDemoInteractions, 300);
        }
    }
    function closeDemo() {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    openBtns.forEach(btn => btn.addEventListener('click', openDemo));
    closeBtn.addEventListener('click', closeDemo);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeDemo();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('open')) closeDemo();
    });

    // ── Page navigation ──
    function goToPage(idx) {
        pages.forEach(p => p.classList.remove('demo-page-active'));
        dots.forEach(d => d.classList.remove('active'));
        pages[idx].classList.add('demo-page-active');
        dots[idx].classList.add('active');
        currentPage = idx;
    }

    // Next buttons
    overlay.querySelectorAll('.demo-next-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = parseInt(btn.dataset.goto);
            goToPage(target);
        });
    });

    // Dot clicks
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            goToPage(parseInt(dot.dataset.page));
        });
    });

    // ── Initialize all demo interactions ──
    function initDemoInteractions() {
        initDemoSeal();
        initDemoRub();
        initDemoTrace();
        initDemoDhol();
        initDemoDiyas();
        initDemoGuestBtns();
        initDemoAttendBtns();
    }

    // ── Seal → door open → go to page 1 ──
    function initDemoSeal() {
        const seal = document.getElementById('demo-seal');
        const envelope = overlay.querySelector('.demo-envelope');
        if (!seal || !envelope) return;

        seal.addEventListener('click', () => {
            envelope.classList.add('opened');
            setTimeout(() => goToPage(1), 1800);
        });
    }

    // ── Demo Rub to Reveal ──
    function initDemoRub() {
        const canvas = document.getElementById('demo-rub-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let drawing = false, revealed = false;

        function setup() {
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            ctx.fillStyle = '#c8a253';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Diamond hatching
            ctx.strokeStyle = 'rgba(184,135,58,0.35)';
            ctx.lineWidth = 1;
            for (let i = -canvas.height; i < canvas.width + canvas.height; i += 14) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + canvas.height, canvas.height); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(i + canvas.height, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
            }

            ctx.fillStyle = 'rgba(125,39,39,0.45)';
            ctx.font = '500 12px Inter, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('✋ Rub here', canvas.width / 2, canvas.height / 2);

            ctx.globalCompositeOperation = 'destination-out';
        }

        // delay setup until page is visible
        const observer = new MutationObserver(() => {
            if (document.getElementById('demo-page-2').classList.contains('demo-page-active')) {
                setup();
                observer.disconnect();
            }
        });
        observer.observe(document.getElementById('demo-page-2'), { attributes: true, attributeFilter: ['class'] });

        function getPos(e) {
            const r = canvas.getBoundingClientRect();
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: cx - r.left, y: cy - r.top };
        }

        canvas.addEventListener('mousedown', () => { if (!revealed) drawing = true; });
        canvas.addEventListener('mouseup', () => { drawing = false; checkDone(); });
        canvas.addEventListener('mouseleave', () => { drawing = false; });
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if (!revealed) drawing = true; }, { passive: false });
        canvas.addEventListener('touchend', () => { drawing = false; checkDone(); });

        function onMove(e) {
            if (!drawing || revealed) return;
            e.preventDefault();
            const p = getPos(e);
            ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, Math.PI * 2); ctx.fill();
        }
        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('touchmove', onMove, { passive: false });

        function checkDone() {
            if (revealed) return;
            const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let t = 0;
            for (let i = 3; i < d.length; i += 16) if (d[i] < 128) t++;
            if (t / (d.length / 16) > 0.4) {
                revealed = true;
                canvas.style.transition = 'opacity 0.5s'; canvas.style.opacity = '0';
                setTimeout(() => canvas.style.display = 'none', 500);
            }
        }
    }

    // ── Demo Trace Heart ──
    function initDemoTrace() {
        const canvas = document.getElementById('demo-trace-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let tracing = false, progress = 0, done = false;

        function setup() {
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            draw();
        }

        const observer = new MutationObserver(() => {
            if (document.getElementById('demo-page-3').classList.contains('demo-page-active')) {
                setup();
                observer.disconnect();
            }
        });
        observer.observe(document.getElementById('demo-page-3'), { attributes: true, attributeFilter: ['class'] });

        function heartPoints() {
            const pts = [];
            const cx = canvas.width / 2, cy = canvas.height / 2 + 8;
            const s = Math.min(canvas.width, canvas.height) * 0.32;
            for (let t = 0; t <= Math.PI * 2; t += 0.06) {
                pts.push({
                    x: cx + s * 16 * Math.pow(Math.sin(t), 3) / 16,
                    y: cy - s * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) / 16
                });
            }
            return pts;
        }

        function draw() {
            const pts = heartPoints();
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Dotted outline
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = 'rgba(200,162,83,0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.closePath(); ctx.stroke();

            // Filled portion
            if (progress > 0) {
                const n = Math.floor(pts.length * Math.min(progress, 1));
                const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                grad.addColorStop(0, '#c8a253'); grad.addColorStop(0.5, '#f2d98a'); grad.addColorStop(1, '#b8873a');
                ctx.setLineDash([]); ctx.strokeStyle = grad; ctx.lineWidth = 4;
                ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath();
                for (let i = 0; i <= n && i < pts.length; i++) {
                    i === 0 ? ctx.moveTo(pts[i].x, pts[i].y) : ctx.lineTo(pts[i].x, pts[i].y);
                }
                ctx.stroke();
            }

            if (done) {
                const pts2 = heartPoints();
                const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                grad.addColorStop(0, 'rgba(200,162,83,0.25)'); grad.addColorStop(1, 'rgba(242,217,138,0.25)');
                ctx.setLineDash([]); ctx.fillStyle = grad;
                ctx.beginPath();
                pts2.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                ctx.closePath(); ctx.fill();
            }
        }

        canvas.addEventListener('mousedown', () => { if (!done) tracing = true; });
        canvas.addEventListener('mouseup', () => tracing = false);
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if (!done) tracing = true; }, { passive: false });
        canvas.addEventListener('touchend', () => tracing = false);

        function onMove(e) {
            if (!tracing || done) return;
            e.preventDefault();
            progress += 0.018;
            if (progress >= 1) { progress = 1; done = true; }
            draw();
        }
        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('touchmove', onMove, { passive: false });
    }

    // ── Demo Dhol ──
    function initDemoDhol() {
        const dhol = document.getElementById('demo-dhol');
        const ripples = document.getElementById('demo-dhol-ripples');
        const beatsEl = document.getElementById('demo-beats');
        if (!dhol) return;
        let beats = 0;

        function tap() {
            beats++;
            if (beatsEl) beatsEl.textContent = beats;

            dhol.classList.remove('bounce');
            void dhol.offsetWidth;
            dhol.classList.add('bounce');

            for (let i = 0; i < 2; i++) {
                const r = document.createElement('div');
                r.className = 'demo-ripple-ring';
                r.style.animationDelay = (i * 0.1) + 's';
                if (ripples) ripples.appendChild(r);
                setTimeout(() => r.remove(), 900);
            }
        }

        dhol.addEventListener('click', tap);
        dhol.addEventListener('touchstart', (e) => { e.preventDefault(); tap(); });
    }

    // ── Demo Diyas ──
    function initDemoDiyas() {
        const items = overlay.querySelectorAll('.demo-diya-item');
        items.forEach(d => {
            d.addEventListener('click', () => {
                d.setAttribute('data-lit', 'true');
            });
            d.addEventListener('touchstart', (e) => {
                e.preventDefault();
                d.setAttribute('data-lit', 'true');
            });
        });
    }

    // ── Guest count buttons ──
    function initDemoGuestBtns() {
        const btns = overlay.querySelectorAll('.demo-guest-btn');
        btns.forEach(b => {
            b.addEventListener('click', () => {
                btns.forEach(x => x.classList.remove('active'));
                b.classList.add('active');
            });
        });
    }

    // ── Attend buttons ──
    function initDemoAttendBtns() {
        const yesBtn = overlay.querySelector('.demo-attend-yes');
        const noBtn = overlay.querySelector('.demo-attend-no');
        if (yesBtn) yesBtn.addEventListener('click', () => {
            yesBtn.style.background = '#22a34a'; yesBtn.style.color = '#fff';
            if (noBtn) { noBtn.style.background = ''; noBtn.style.color = ''; }
        });
        if (noBtn) noBtn.addEventListener('click', () => {
            noBtn.style.background = '#c73030'; noBtn.style.color = '#fff';
            if (yesBtn) { yesBtn.style.background = ''; yesBtn.style.color = ''; }
        });
    }
}
