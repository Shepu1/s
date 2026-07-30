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

document.querySelectorAll('#nav-links a[href^="#"], .nav-mobile-sections a[href^="#"]').forEach((anchor) => {
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

initScrollHandlers();
typeWriter();
