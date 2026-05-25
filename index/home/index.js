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
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const isMobile = /Mobi|Android/i.test(navigator.userAgent);

let isLoggedIn = false;
let pendingHref = "";

const authBtn = document.getElementById("auth-btn");
const authPillLabel = document.getElementById("auth-pill-label");
const authPillIcon = document.getElementById("auth-pill-icon");
const authAvatarWrap = document.querySelector(".auth-pill-avatar-wrap");
const authAvatar = document.getElementById("auth-avatar");
const loginModal = document.getElementById("login-modal");
const authDestination = document.getElementById("auth-destination");
const authError = document.getElementById("auth-error");
const googleLoginBtn = document.getElementById("google-login-btn");

const PAGE_LABELS = {
    "../contact/contact.html": "Contact",
    "../apps/Apps&Games.html": "Apps & Games",
    "../buy/Buy.html": "Shop",
    "../about/About.html": "Profile"
};
const navbar = document.getElementById("navbar");
const progressBar = document.getElementById("progressBar");
const typewriterElement = document.getElementById("typewriter-text");
const skillCards = document.querySelectorAll(".skill-card");
const detailBox = document.getElementById("skillDetailBox");
const detailTitle = document.getElementById("detailTitle");
const detailContent = document.getElementById("detailContent");
const menuToggle = document.querySelector(".menu-toggle");
const closeLoginBtn = document.querySelector(".close-login");
const closeDetailBtn = document.querySelector(".detail-close");
const allButtons = document.querySelectorAll(".btn");
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

function updateAuthButton(user) {
    if (user) {
        authBtn.classList.add("is-logged-in");
        authBtn.setAttribute("aria-expanded", "false");
        const name = user.displayName?.split(" ")[0] || "Account";
        authPillLabel.textContent = name;
        if (user.photoURL) {
            authAvatar.src = user.photoURL;
            authAvatar.alt = user.displayName || "Profile";
            authAvatarWrap.hidden = false;
        } else {
            authAvatarWrap.hidden = true;
        }
        authPillIcon.hidden = true;
    } else {
        authBtn.classList.remove("is-logged-in");
        authPillLabel.textContent = "Sign In";
        authAvatarWrap.hidden = true;
        authPillIcon.hidden = false;
    }
}

function openLoginModal(targetHref = "") {
    hideAuthError();
    setGoogleLoading(false);
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
    triggerHapticFeedback();
}

function closeMobileMenu() {
    if (navLinks.classList.contains("show")) {
        navLinks.classList.remove("show");
        menuToggle.setAttribute("aria-expanded", "false");
    }
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
        link.classList.toggle("active", href === `#${currentId}`);
    });
}

function initScrollHandlers() {
    window.addEventListener("scroll", () => {
        navbar.classList.toggle("scrolled", window.scrollY > 50);
        const totalHeight = document.body.scrollHeight - window.innerHeight;
        const progress = totalHeight > 0 ? (window.scrollY / totalHeight) * 100 : 0;
        progressBar.style.width = `${progress}%`;
        updateScrollSpy();
    }, { passive: true });
    updateScrollSpy();
}

setPersistence(auth, browserLocalPersistence).catch(console.warn);

onAuthStateChanged(auth, (user) => {
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
        const name = authPillLabel.textContent;
        if (confirm(`${name}, আপনি কি লগআউট করতে চান?`)) {
            signOut(auth).catch(console.error);
        }
    } else {
        openLoginModal(pendingHref);
    }
});

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
    link.addEventListener("click", (e) => {
        closeMobileMenu();
        if (!isLoggedIn) {
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
            closeMobileMenu();
            target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
        }
    });
});

document.addEventListener("click", (e) => {
    if (navLinks.classList.contains("show") && !navbar.contains(e.target)) {
        closeMobileMenu();
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

function handleTilt(e, button) {
    const rect = button.getBoundingClientRect();
    const x = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
    const y = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);
    const rotateX = ((y - rect.top - rect.height / 2) / (rect.height / 2)) * -10;
    const rotateY = ((x - rect.left - rect.width / 2) / (rect.width / 2)) * 10;
    button.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(8px)`;
    button.style.transition = "none";
}

function resetTilt(button) {
    button.style.transform = "";
    button.style.transition = "transform 0.4s ease-in-out";
}

allButtons.forEach((btn) => {
    if (canHover && !prefersReducedMotion) {
        btn.classList.add("tilt-enabled");
        btn.addEventListener("mousemove", (e) => handleTilt(e, btn));
        btn.addEventListener("mouseleave", () => resetTilt(btn));
    }
    btn.addEventListener("click", (e) => {
        triggerHapticFeedback();
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX || 0) - rect.left;
        const y = (e.clientY || 0) - rect.top;
        const ripple = document.createElement("span");
        ripple.classList.add("ripple");
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        btn.appendChild(ripple);
        ripple.addEventListener("animationend", () => ripple.remove());
    });
});

if (canHover && !prefersReducedMotion) {
    let lastDraw = 0;
    document.addEventListener("mousemove", (e) => {
        const now = Date.now();
        if (now - lastDraw < 150) return;
        lastDraw = now;
        const dot = document.createElement("div");
        dot.className = "cursor-trail";
        dot.style.cssText = `position:fixed;width:3px;height:3px;border-radius:50%;background:var(--info-color);box-shadow:0 0 5px var(--info-color);pointer-events:none;z-index:9998;left:${e.clientX}px;top:${e.clientY}px;opacity:1;transition:opacity 0.4s ease-out,transform 0.4s ease-out;`;
        document.body.appendChild(dot);
        requestAnimationFrame(() => {
            dot.style.opacity = "0";
            dot.style.transform = "scale(0)";
            setTimeout(() => dot.remove(), 400);
        });
    }, { passive: true });
}

initScrollHandlers();
typeWriter();
