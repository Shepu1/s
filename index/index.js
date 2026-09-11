import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCHPYjwTREM_a--1MIbLtULMMVBJoAi_wU",
    authDomain: "shepu-6d550.firebaseapp.com",
    projectId: "shepu-6d550",
    storageBucket: "shepu-6d550.firebasestorage.app",
    messagingSenderId: "557466915626",
    appId: "1:557466915626:web:ba68ca412987a0a867c453"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = /Mobi|Android/i.test(navigator.userAgent);

let isLoggedIn = false;
let pendingHref = "";
let authReady = false;

const authBtn = document.getElementById("auth-btn");
const authPillLabel = document.getElementById("auth-pill-label");
const authPillIcon = document.getElementById("auth-pill-icon");
const authPillChevron = document.querySelector(".auth-pill-chevron");
const authAvatarWrap = document.querySelector(".auth-pill-avatar-wrap");
const authAvatar = document.getElementById("auth-avatar");
const profileMenu = document.getElementById("profile-menu");
const profileDropdown = document.getElementById("profile-dropdown");
const profileMenuAvatar = document.getElementById("profile-menu-avatar");
const profileMenuName = document.getElementById("profile-menu-name");
const profileMenuEmail = document.getElementById("profile-menu-email");
const logoutBtn = document.getElementById("logout-btn");
const loginModal = document.getElementById("login-modal");
const authDestination = document.getElementById("auth-destination");
const authError = document.getElementById("auth-error");
const googleLoginBtn = document.getElementById("google-login-btn");

const sectionsMenuBtn = document.getElementById("sections-menu-btn");
const sectionsMenu = document.getElementById("sections-menu");
const sectionsMenuLabel = document.getElementById("sections-menu-label");
const sectionsDropdown = sectionsMenuBtn?.closest(".nav-dropdown");

const PAGE_LABELS = {
    "index/contact/contact.html": "Contact",
    "index/apps/Apps&Games.html": "Apps & Games",
    "index/buy/Buy.html": "Shop",
    "index/about/About.html": "Profile"
};
const navbar = document.getElementById("navbar");
const progressBar = document.getElementById("progressBar");
const typewriterElement = document.getElementById("typewriter-text");
const skillCards = document.querySelectorAll(".skill-card");
const detailBox = document.getElementById("skillDetailBox");
const detailTitle = document.getElementById("detailTitle");
const detailContent = document.getElementById("detailContent");
const menuToggle = document.querySelector(".menu-toggle");
const closeDetailBtn = document.querySelector(".detail-close");
const restrictedLinks = document.querySelectorAll(".restricted-link");
const navLinks = document.getElementById("nav-links");
const navSections = document.querySelectorAll(".nav-section");
const pageSections = document.querySelectorAll("section[id]");

function triggerHapticFeedback() {
    if (isMobile && navigator.vibrate) navigator.vibrate(50);
}

function hideAuthError() {
    authError.hidden = true;
    authError.textContent = "";
}

function showAuthError(message) {
    authError.textContent = message;
    authError.hidden = false;
}

function setGoogleLoading(loading) {
    googleLoginBtn.disabled = loading;
    googleLoginBtn.classList.toggle("is-loading", loading);
}

function closeSectionsMenu() {
    if (!sectionsMenu || !sectionsMenuBtn || !sectionsDropdown) return;
    sectionsMenu.hidden = true;
    sectionsMenuBtn.setAttribute("aria-expanded", "false");
    sectionsDropdown.classList.remove("is-open");
}

function openSectionsMenu() {
    if (!sectionsMenu || !sectionsMenuBtn || !sectionsDropdown) return;
    closeProfileMenu();
    sectionsMenu.hidden = false;
    sectionsMenuBtn.setAttribute("aria-expanded", "true");
    sectionsDropdown.classList.add("is-open");
}

function toggleSectionsMenu() {
    if (sectionsMenu.hidden) openSectionsMenu();
    else closeSectionsMenu();
}

function closeProfileMenu() {
    if (!profileDropdown || !profileMenu) return;
    profileDropdown.hidden = true;
    profileMenu.classList.remove("is-open");
    authBtn.setAttribute("aria-expanded", "false");
    authBtn.setAttribute("aria-haspopup", isLoggedIn ? "menu" : "dialog");
}

function openProfileMenu() {
    if (!profileDropdown || !profileMenu) return;
    closeSectionsMenu();
    profileDropdown.hidden = false;
    profileMenu.classList.add("is-open");
    authBtn.setAttribute("aria-expanded", "true");
    authBtn.setAttribute("aria-haspopup", "menu");
}

function updateAuthButton(user) {
    if (user) {
        authBtn.classList.add("is-logged-in");
        const fullName = user.displayName || "Account";
        const firstName = fullName.split(" ")[0];
        authPillLabel.textContent = firstName;
        authBtn.setAttribute("aria-label", `${fullName} account menu`);
        profileMenuName.textContent = fullName;
        profileMenuEmail.textContent = user.email || "";
        if (user.photoURL) {
            authAvatar.src = user.photoURL;
            authAvatar.alt = fullName;
            authAvatarWrap.hidden = false;
            profileMenuAvatar.src = user.photoURL;
            profileMenuAvatar.alt = fullName;
            profileMenuAvatar.hidden = false;
        } else {
            authAvatarWrap.hidden = true;
            profileMenuAvatar.hidden = true;
        }
        authPillIcon.hidden = true;
        if (authPillChevron) authPillChevron.hidden = false;
        authBtn.setAttribute("aria-haspopup", "menu");
        authBtn.setAttribute("aria-expanded", "false");
    } else {
        authBtn.classList.remove("is-logged-in");
        authPillLabel.textContent = "Sign In";
        authBtn.setAttribute("aria-label", "Sign in");
        authAvatarWrap.hidden = true;
        authPillIcon.hidden = false;
        if (authPillChevron) authPillChevron.hidden = true;
        closeProfileMenu();
        authBtn.setAttribute("aria-haspopup", "dialog");
        authBtn.setAttribute("aria-expanded", "false");
    }
}

function openLoginModal(targetHref = "") {
    hideAuthError();
    setGoogleLoading(false);
    closeProfileMenu();
    closeSectionsMenu();
    if (targetHref && PAGE_LABELS[targetHref]) {
        authDestination.textContent = `আপনি যেতে চেয়েছিলেন: ${PAGE_LABELS[targetHref]}`;
        authDestination.hidden = false;
    } else {
        authDestination.hidden = true;
        authDestination.textContent = "";
    }
    loginModal.hidden = false;
    loginModal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => loginModal.classList.add("is-open"));
    authBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    googleLoginBtn.focus();
}

function closeLoginModal() {
    loginModal.classList.remove("is-open");
    loginModal.setAttribute("aria-hidden", "true");
    authBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    hideAuthError();
    setGoogleLoading(false);
    setTimeout(() => {
        if (!loginModal.classList.contains("is-open")) {
            loginModal.hidden = true;
        }
    }, 350);
    pendingHref = "";
}

function closeSkillDetail() {
    detailBox.classList.remove("show");
    detailBox.setAttribute("aria-hidden", "true");
}

function openSkillDetail(card) {
    detailTitle.textContent = card.getAttribute("data-skill");
    detailContent.textContent = card.getAttribute("data-detail");
    detailBox.classList.add("show");
    detailBox.setAttribute("aria-hidden", "false");
    detailBox.focus();
    triggerHapticFeedback();
}

function toggleMenu() {
    const open = navLinks.classList.toggle("show");
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) {
        closeSectionsMenu();
        closeProfileMenu();
    }
    triggerHapticFeedback();
}

function closeMobileMenu() {
    if (navLinks.classList.contains("show")) {
        navLinks.classList.remove("show");
        menuToggle.setAttribute("aria-expanded", "false");
    }
    closeSectionsMenu();
    closeProfileMenu();
}

const textToType = "Hi, I'm Shareharjan Shepu";
let charIndex = 0;
const typeSpeed = prefersReducedMotion ? 0 : 100;

function typeWriter() {
    if (prefersReducedMotion) {
        typewriterElement.textContent = textToType;
        return;
    }
    if (charIndex < textToType.length) {
        typewriterElement.textContent += textToType.charAt(charIndex);
        charIndex++;
        setTimeout(typeWriter, typeSpeed);
    }
}

function updateScrollSpy() {
    const offset = 120;
    let currentId = "home";
    pageSections.forEach((section) => {
        if (window.scrollY >= section.offsetTop - offset) {
            currentId = section.id;
        }
    });
    navSections.forEach((link) => {
        const href = link.getAttribute("href");
        const isActive = href === `#${currentId}`;
        link.classList.toggle("active", isActive);
        if (isActive && sectionsMenuLabel) {
            sectionsMenuLabel.textContent = link.textContent.trim();
        }
    });
}

// ==========================================
// Site-wide scroll-scrubbed FRAME background
// (JPG sequence is smoother than MP4 seek; video kept as source asset)
// ==========================================

const TOTAL_FRAMES = 192;
const FRAME_DIR = new URL("index/home/portfolio_frames_24fps/", window.location.href).href;
const FRAME_CONCURRENCY_DESKTOP = 10;
const FRAME_CONCURRENCY_MOBILE = 6;
const PRELOAD_RADIUS = 36;
const SCRUB_LERP = 0.22;

function frameUrl(index) {
    return `${FRAME_DIR}frame_${String(index + 1).padStart(4, "0")}.jpg`;
}

function createScrollFrameEngine() {
    const canvas = document.getElementById("site-bg-canvas");
    if (!canvas) return { sync() {}, destroy() {} };

    const isMobile = window.matchMedia("(max-width: 768px)").matches
        || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    const concurrency = isMobile ? FRAME_CONCURRENCY_MOBILE : FRAME_CONCURRENCY_DESKTOP;

    // desynchronized can blank the canvas on some mobile GPUs
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: !isMobile });
    const images = new Array(TOTAL_FRAMES);
    const status = new Array(TOTAL_FRAMES).fill(0);
    const queued = new Set();
    const queue = [];

    let activeLoads = 0;
    let targetProgress = 0;
    let renderProgress = 0;
    let drawnIndex = -1;
    let wantIndex = 0;
    let rafId = 0;
    let resizeRaf = 0;
    let destroyed = false;
    let idleLoadCursor = 0;
    let touching = false;
    let coastUntil = 0;

    function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2);
        const w = Math.max(1, Math.round(window.innerWidth * dpr));
        const h = Math.max(1, Math.round(window.innerHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            drawnIndex = -1;
        }
    }

    function drawCover(img) {
        const cw = canvas.width;
        const ch = canvas.height;
        if (!cw || !ch || !img) return;
        const ir = img.naturalWidth / img.naturalHeight;
        const cr = cw / ch;
        const mobile = window.matchMedia("(max-width: 768px)").matches;
        const xAnchor = mobile ? 0.88 : 0.5;
        let dw;
        let dh;
        let dx;
        let dy;
        if (ir > cr) {
            dh = ch;
            dw = ch * ir;
            dx = (cw - dw) * xAnchor;
            dy = 0;
        } else {
            dw = cw;
            dh = cw / ir;
            dx = 0;
            dy = (ch - dh) * 0.5;
        }
        ctx.fillStyle = "#0c0c0f";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, dx, dy, dw, dh);
    }

    function nearestReady(index) {
        if (status[index] === 2) return index;
        for (let d = 1; d < TOTAL_FRAMES; d++) {
            const a = index - d;
            const b = index + d;
            if (a >= 0 && status[a] === 2) return a;
            if (b < TOTAL_FRAMES && status[b] === 2) return b;
        }
        return -1;
    }

    function paint(index) {
        const ready = nearestReady(index);
        if (ready < 0) return;
        if (ready === drawnIndex) return;
        drawCover(images[ready]);
        drawnIndex = ready;
    }

    function pumpQueue() {
        while (activeLoads < concurrency && queue.length) {
            const index = queue.shift();
            queued.delete(index);
            if (status[index] !== 0) continue;
            status[index] = 1;
            activeLoads++;
            const img = new Image();
            img.decoding = "async";
            img.onload = () => {
                images[index] = img;
                status[index] = 2;
                activeLoads--;
                if (index === wantIndex || Math.abs(index - wantIndex) <= 1 || drawnIndex < 0) {
                    drawnIndex = -1;
                    paint(wantIndex);
                }
                pumpQueue();
            };
            img.onerror = () => {
                status[index] = 3;
                activeLoads--;
                pumpQueue();
            };
            img.src = frameUrl(index);
        }
    }

    function enqueue(index, front) {
        if (index < 0 || index >= TOTAL_FRAMES || status[index] !== 0) return;
        if (queued.has(index)) return;
        queued.add(index);
        if (front) queue.unshift(index);
        else queue.push(index);
        pumpQueue();
    }

    function prioritizeAround(center) {
        enqueue(center, true);
        const radius = saveData ? 18 : (isMobile ? 48 : PRELOAD_RADIUS);
        for (let d = 1; d <= radius; d++) {
            enqueue(center + d, d <= 8);
            enqueue(center - d, d <= 8);
        }
    }

    function scheduleIdleFill() {
        if (saveData || prefersReducedMotion) return;
        const batch = isMobile ? 4 : 6;
        const step = () => {
            if (destroyed) return;
            let n = 0;
            while (idleLoadCursor < TOTAL_FRAMES && n < batch) {
                if (status[idleLoadCursor] === 0) {
                    enqueue(idleLoadCursor, false);
                    n++;
                }
                idleLoadCursor++;
            }
            if (idleLoadCursor < TOTAL_FRAMES) {
                if ("requestIdleCallback" in window) {
                    requestIdleCallback(step, { timeout: 700 });
                } else {
                    setTimeout(step, isMobile ? 90 : 70);
                }
            }
        };
        setTimeout(step, 100);
    }

    function getScrollY() {
        const se = document.scrollingElement || document.documentElement;
        const y = se.scrollTop;
        if (y || y === 0) return y;
        return window.pageYOffset || document.body.scrollTop || 0;
    }

    function getScrollMax() {
        const se = document.scrollingElement || document.documentElement;
        const height = Math.max(
            se.scrollHeight || 0,
            document.documentElement.scrollHeight || 0,
            document.body.scrollHeight || 0,
            document.documentElement.offsetHeight || 0,
            document.body.offsetHeight || 0
        );
        const view = window.innerHeight || document.documentElement.clientHeight || 1;
        return Math.max(1, height - view);
    }

    function readPageProgress() {
        return Math.min(1, Math.max(0, getScrollY() / getScrollMax()));
    }

    function tick() {
        rafId = 0;
        if (destroyed) return;

        targetProgress = prefersReducedMotion ? 0 : readPageProgress();

        // Mobile: snap hard so frame changes track the finger immediately
        if (prefersReducedMotion || isMobile) {
            renderProgress = targetProgress;
        } else {
            renderProgress += (targetProgress - renderProgress) * SCRUB_LERP;
            if (Math.abs(targetProgress - renderProgress) < 0.00025) {
                renderProgress = targetProgress;
            }
        }

        wantIndex = Math.min(
            TOTAL_FRAMES - 1,
            Math.max(0, Math.round(renderProgress * (TOTAL_FRAMES - 1)))
        );

        prioritizeAround(wantIndex);
        paint(wantIndex);

        const now = performance.now();
        const keepGoing = isMobile
            || touching
            || now < coastUntil
            || renderProgress !== targetProgress;

        if (keepGoing) {
            rafId = requestAnimationFrame(tick);
        }
    }

    function kick() {
        if (destroyed) return;
        if (isMobile) coastUntil = performance.now() + 1800;
        if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function onTouchStart() {
        touching = true;
        coastUntil = performance.now() + 3000;
        kick();
    }

    function onTouchMove() {
        touching = true;
        coastUntil = performance.now() + 3000;
        kick();
    }

    function onTouchEnd() {
        touching = false;
        coastUntil = performance.now() + 2500;
        kick();
    }

    function onResize() {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
            resizeCanvas();
            drawnIndex = -1;
            kick();
        });
    }

    resizeCanvas();
    enqueue(0, true);
    for (let i = 1; i < (isMobile ? 40 : 24); i++) enqueue(i, false);
    scheduleIdleFill();
    kick();

    // Capture helps some mobile browsers deliver scroll during touch
    window.addEventListener("scroll", kick, { passive: true, capture: true });
    document.addEventListener("scroll", kick, { passive: true, capture: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true, capture: true });
    window.addEventListener("pointerdown", onTouchStart, { passive: true });
    window.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch") onTouchMove();
    }, { passive: true });
    window.addEventListener("pointerup", onTouchEnd, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", onResize, { passive: true });
        window.visualViewport.addEventListener("scroll", kick, { passive: true });
    }

    // Mobile: never let the loop die while the tab is visible
    if (isMobile) {
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) kick();
        });
    }

    return {
        sync: kick,
        destroy() {
            destroyed = true;
            cancelAnimationFrame(rafId);
            window.removeEventListener("scroll", kick, true);
            document.removeEventListener("scroll", kick, true);
            window.removeEventListener("touchstart", onTouchStart, true);
            window.removeEventListener("touchmove", onTouchMove, true);
            window.removeEventListener("touchend", onTouchEnd, true);
            window.removeEventListener("touchcancel", onTouchEnd, true);
            window.removeEventListener("resize", onResize);
        }
    };
}

let heroFrameEngine = null;

function updateHeroFrame() {
    if (heroFrameEngine) heroFrameEngine.sync();
}

function initScrollHandlers() {
    const backToTop = document.getElementById("back-to-top");
    window.addEventListener("scroll", () => {
        navbar.classList.toggle("scrolled", window.scrollY > 50);
        const totalHeight = document.body.scrollHeight - window.innerHeight;
        const progress = totalHeight > 0 ? (window.scrollY / totalHeight) * 100 : 0;
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute("aria-valuenow", String(Math.round(progress)));
        updateScrollSpy();
        if (backToTop) {
            backToTop.hidden = window.scrollY < 480;
        }
    }, { passive: true });
    updateScrollSpy();
    if (backToTop) {
        backToTop.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
        });
    }
}

setPersistence(auth, browserLocalPersistence).catch(console.warn);

auth.authStateReady().then(() => {
    authReady = true;
}).catch(() => {
    authReady = true;
});

onAuthStateChanged(auth, (user) => {
    authReady = true;
    if (user) {
        isLoggedIn = true;
        updateAuthButton(user);
        const go = pendingHref;
        pendingHref = "";
        loginModal.classList.remove("is-open");
        loginModal.setAttribute("aria-hidden", "true");
        loginModal.hidden = true;
        document.body.style.overflow = "";
        if (go) window.location.href = go;
    } else {
        isLoggedIn = false;
        updateAuthButton(null);
    }
});

authBtn.addEventListener("click", () => {
    if (isLoggedIn) {
        if (profileDropdown.hidden) openProfileMenu();
        else closeProfileMenu();
    } else {
        openLoginModal(pendingHref);
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        closeProfileMenu();
        signOut(auth).catch(console.error);
    });
}

if (sectionsMenuBtn) {
    sectionsMenuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleSectionsMenu();
        triggerHapticFeedback();
    });
}

googleLoginBtn.addEventListener("click", () => {
    hideAuthError();
    setGoogleLoading(true);
    setPersistence(auth, browserLocalPersistence)
        .then(() => signInWithPopup(auth, provider))
        .catch((err) => {
            console.error("Login error:", err);
            setGoogleLoading(false);
            if (err.code === "auth/popup-closed-by-user") {
                showAuthError("লগইন বাতিল হয়েছে। আবার চেষ্টা করুন।");
            } else if (err.code === "auth/popup-blocked") {
                showAuthError("পপআপ ব্লক হয়েছে। ব্রাউজারে পপআপ অনুমতি দিন।");
            } else {
                showAuthError("লগইন ব্যর্থ। কিছুক্ষণ পর আবার চেষ্টা করুন।");
            }
        });
});

document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeLoginModal);
});

restrictedLinks.forEach((link) => {
    link.addEventListener("click", async (e) => {
        closeMobileMenu();
        if (!authReady) {
            e.preventDefault();
            try {
                await auth.authStateReady();
            } catch (_) { /* ignore */ }
            authReady = true;
            if (auth.currentUser) {
                window.location.href = link.getAttribute("href");
                return;
            }
        }
        if (!isLoggedIn && !auth.currentUser) {
            e.preventDefault();
            pendingHref = link.getAttribute("href");
            openLoginModal(pendingHref);
        }
    });
});

document.querySelectorAll('#nav-links a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
        const target = document.querySelector(anchor.getAttribute("href"));
        if (target) {
            e.preventDefault();
            closeSectionsMenu();
            closeMobileMenu();
            target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
        }
    });
});

document.addEventListener("click", (e) => {
    if (navLinks.classList.contains("show") && !navbar.contains(e.target)) {
        closeMobileMenu();
    }
    if (sectionsDropdown && !sectionsDropdown.contains(e.target)) {
        closeSectionsMenu();
    }
    if (profileMenu && !profileMenu.contains(e.target)) {
        closeProfileMenu();
    }
});

if (menuToggle) menuToggle.addEventListener("click", toggleMenu);
if (closeDetailBtn) closeDetailBtn.addEventListener("click", closeSkillDetail);

skillCards.forEach((card) => {
    card.addEventListener("click", () => openSkillDetail(card));
    card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openSkillDetail(card);
        }
    });
});

document.addEventListener("click", (e) => {
    if (detailBox.classList.contains("show") && !detailBox.contains(e.target) && !e.target.closest(".skill-card")) {
        closeSkillDetail();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (detailBox.classList.contains("show")) closeSkillDetail();
        if (loginModal.classList.contains("is-open")) closeLoginModal();
        closeSectionsMenu();
        closeProfileMenu();
        closeMobileMenu();
    }
});

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("active");
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

heroFrameEngine = createScrollFrameEngine();
initScrollHandlers();
typeWriter();
