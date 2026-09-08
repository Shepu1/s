const EMBEDDED_DB = [
    { q: "hi", a: "হ্যালো! আমি Shepu-AI। আপনাকে কীভাবে সাহায্য করতে পারি?" },
    { q: "who are you", a: "আমি **শেপু-আই v4.0 Pro**, আপনার স্মার্ট এআই অ্যাসিস্ট্যান্ট।" },
    { q: "bye", a: "বিদায়! আপনার দিনটি ভালো কাটুক।" },
    { q: "ki korte paro", a: "আমি অংক সমাধান করতে পারি, ফাইল থেকে তথ্য খুঁজতে পারি এবং আপনার যেকোনো প্রশ্নের উত্তর দেওয়ার চেষ্টা করতে পারি।" }
];

let database = [];
let golpoDatabase = [];
let conversationContext = { subjects: [], globalKeywords: new Set() };
let idleTimer;
let questionTimer;
let proactiveTypingId = null;
let activeProactiveItem = null;
let isBotAnswering = false;
let hasAskedProactiveQuestion = false;
let ultraSmartness = false; // Default to false
let currentConversationId = null;
let currentTheme = localStorage.getItem('theme') || 'dark-mode';
let shouldAutoScroll = true;
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.style.display = 'inline-flex';
    }
});

window.addEventListener('appinstalled', (evt) => {
    console.log('Shepu-AI was installed.');
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.style.display = 'none';
    }
});

let chatContainer, userInput, sendBtn, suggestionBox, voiceBtn, sidebar, sidebarOverlay, menuBtn, mainContent, scrollToBottomBtn;
let isImageModeActive = false;
let currentLightboxUrl = '';
let currentLightboxPrompt = '';

async function initApp() {
    chatContainer = document.getElementById('chatContainer');
    userInput = document.getElementById('userInput');
    sendBtn = document.getElementById('sendBtn');
    suggestionBox = document.getElementById('suggestionBox');
    voiceBtn = document.getElementById('voiceBtn');
    sidebar = document.getElementById('sidebar');
    sidebarOverlay = document.getElementById('sidebarOverlay');
    menuBtn = document.getElementById('menuBtn');
    mainContent = document.getElementById('mainContent');
    scrollToBottomBtn = document.getElementById('scrollToBottom');

    // Close plus dropdown on clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.plus-menu-container')) {
            closePlusMenu();
        }
    });

    // Handle Escape key to close modal/menu
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePlusMenu();
            closeImageLightbox();
        }
    });
    
    // Apply saved theme
    changeTheme(currentTheme, true);

    // Load saved history from localStorage
    loadConversations();

    // Update profile button text if avatar is already saved
    updateProfileButtonText();

    // Render initial greeting immediately so UI is never blank
    setDynamicGreeting();

    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) {
            splash.classList.add('fade-out');
            setTimeout(() => {
                splash.style.display = 'none';
                checkFirstTimeOnboarding();
            }, 850);
        }
    }, 1800);

    await loadData();
    
    // Ensure voices are loaded for TTS
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    if (userInput) {
        userInput.focus();
        userInput.addEventListener('input', handleUserInput);
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                sendMessage(); 
            }
        });
    }

    resetIdleTimer();

    const installBtn = document.getElementById('installBtn');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
        if (installBtn) installBtn.style.display = 'none';
    } else {
        if (installBtn) installBtn.style.display = 'inline-flex';
    }

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                deferredPrompt = null;
                installBtn.style.display = 'none';
            } else {
                const isPC = !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (isPC) {
                    downloadDesktopShortcut();
                    const modalMsg = document.querySelector('#installModal p');
                    if (modalMsg) {
                        modalMsg.innerHTML = `
                            <strong>১. শর্টকাট তৈরি হয়েছে:</strong> আপনার পিসির জন্য একটি ডেক্সটপ শর্টকাট (<code>Shepu-AI.url</code>) ফাইল ডাউনলোড করা হয়েছে। ফাইলটি আপনার ডেক্সটপে (Desktop) নিয়ে রাখুন। এখন থেকে ওটিতে ডাবল-ক্লিক করলেই সরাসরি Shepu-AI ওপেন হবে!<br><br>
                            <strong>২. ব্রাউজারে ইনস্টল করতে (PWA):</strong> সাইটটি লোকালহোস্ট বা HTTPS সার্ভারে চললে আপনি সরাসরি ক্রোম বা এজ ব্রাউজারের উপরে ডানদিকের থ্রি-ডট মেনু থেকে <strong>"Install Shepu-AI"</strong> এ ক্লিক করে ইনস্টল করতে পারেন।
                        `;
                    }
                } else {
                    const modalMsg = document.querySelector('#installModal p');
                    if (modalMsg) {
                        modalMsg.innerHTML = `
                            ১. এই PWA অ্যাপটি সরাসরি ব্রাউজার থেকে ইনস্টল করতে সাইটটি অবশ্যই লোকালহোস্ট বা HTTPS সার্ভারে চলতে হবে (যেমন Live Server)। সরাসরি ফাইলে ডাবল-ক্লিক করে ওপেন করলে সরাসরি ইনস্টল বাটন কাজ করবে না।<br><br>
                            <strong>ক্রোম/এজ ব্রাউজারে ইনস্টল করতে:</strong> ব্রাউজারের উপরে ডানদিকের থ্রি-ডট (Three-dot) মেনুতে ক্লিক করে <strong>"Install Shepu-AI"</strong> বা <strong>"Save and share -> Install App"</strong> এ ক্লিক করুন।<br><br>
                            <strong>মোবাইলে ইনস্টল করতে:</strong> ব্রাউজারের থ্রি-ডট মেনু থেকে <strong>"Add to Home screen"</strong> এ ক্লিক করুন।
                        `;
                    }
                }
                showInstallModal();
            }
        });
    }

    updateNetworkStatusUI();

    const toggleSidebar = () => {
        if (sidebar && sidebarOverlay) {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
        }
    };

    if (menuBtn) {
        menuBtn.addEventListener('click', toggleSidebar);
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (typeof closeVersionModal === 'function') closeVersionModal();
            if (typeof closeThemeModal === 'function') closeThemeModal();
            if (typeof closeModal === 'function') closeModal();
            if (typeof closeProfileModal === 'function') closeProfileModal();
            if (sidebar && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            }
        }
    });

    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    }

    if (chatContainer) {
        chatContainer.addEventListener('scroll', () => {
            const threshold = 50; 
            const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight <= threshold;
            shouldAutoScroll = isAtBottom;

            const isScrolledUp = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight > 200;
            if (scrollToBottomBtn) {
                if (isScrolledUp) {
                    scrollToBottomBtn.classList.add('visible');
                } else {
                    scrollToBottomBtn.classList.remove('visible');
                }
            }
        });
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (voiceBtn) {
        let recognition = null;
        let isRecording = false;

        function initRecognition() {
            if (!SpeechRecognition) return;
            try {
                recognition = new SpeechRecognition();
                recognition.lang = 'bn-BD';
                recognition.continuous = false;
                recognition.interimResults = false;

                recognition.onstart = () => {
                    isRecording = true;
                    voiceBtn.classList.add('recording');
                    showToast('কথা বলুন, শুনছি... 🎙️', 'fa-microphone');
                };

                recognition.onresult = (e) => {
                    const transcript = e.results[0][0].transcript;
                    if (userInput) {
                        userInput.value = transcript;
                        userInput.dispatchEvent(new Event('input'));
                    }
                    voiceBtn.classList.remove('recording');
                    isRecording = false;
                    sendMessage();
                };

                recognition.onend = () => {
                    isRecording = false;
                    voiceBtn.classList.remove('recording');
                };

                recognition.onerror = (err) => {
                    console.warn('[Speech Recognition Error]', err);
                    isRecording = false;
                    voiceBtn.classList.remove('recording');
                    showToast('ভয়েস বুঝতে সমস্যা হয়েছে, আবার চেষ্টা করুন', 'fa-exclamation-circle');
                };
            } catch(e) {
                console.error('Speech recognition init error:', e);
            }
        }

        if (SpeechRecognition) {
            initRecognition();
        }

        voiceBtn.addEventListener('click', () => {
            if (!SpeechRecognition) {
                showToast('আপনার ডিভাইসে সরাসরি ভয়েস ইনপুট সমর্থিত নয়', 'fa-exclamation-triangle');
                return;
            }
            if (!recognition) initRecognition();
            if (isRecording) {
                try { recognition.stop(); } catch(e){}
                isRecording = false;
                voiceBtn.classList.remove('recording');
            } else {
                try {
                    recognition.start();
                } catch(e) {
                    console.warn('Restarting recognition:', e);
                    initRecognition();
                    try { recognition.start(); } catch(err){
                        showToast('মাইক্রোফোন পারমিশন চেক করুন', 'fa-microphone-slash');
                    }
                }
            }
        });
    }
    // Always start in regular chat mode on app startup/restart
    disableImageMode();
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function clearIdleTimers() {
    clearTimeout(idleTimer);
    clearTimeout(questionTimer);
    removeProactiveTyping();
}

function resetIdleTimer() {
    clearIdleTimers();
    if (isBotAnswering) return;
    
    idleTimer = setTimeout(() => {
        if (userInput && userInput.value.trim().length === 0 && ultraSmartness) {
            proactiveTypingId = addTypingIndicator();
        }
    }, 4500); // Wait 4.5 seconds after active input/typing completion
    
    questionTimer = setTimeout(askProactiveQuestion, 6000); // Proactive question at 6 seconds
}

function removeProactiveTyping() {
    if (proactiveTypingId) {
        removeMessage(proactiveTypingId);
        proactiveTypingId = null;
    }
}

async function askProactiveQuestion() {
    if (!ultraSmartness) return;
    
    // User must start the conversation
    if (chatHistoryContext.length === 0) {
        console.log("[Shepu Proactive] Conversation history is empty, waiting for user to start.");
        removeProactiveTyping();
        return;
    }
    
    // Prevent asking multiple proactive questions consecutively without user response
    if (hasAskedProactiveQuestion) {
        console.log("[Shepu Proactive] Already asked a proactive question, waiting for user response.");
        removeProactiveTyping();
        return;
    }
    
    removeProactiveTyping();
    
    // Show typing indicator
    proactiveTypingId = addTypingIndicator();
    
    try {
        const question = await generateProactiveQuestionFromGemini();
        
        removeProactiveTyping();
        
        // Safety checks before rendering
        if (!ultraSmartness || isBotAnswering || userInput.value.trim().length > 0) {
            return;
        }
        
        if (hasAskedProactiveQuestion) {
            return;
        }
        
        addMessage(question, "bot");
        addToChatHistory('bot', question);
        saveMessageToConversation('bot', question);
        hasAskedProactiveQuestion = true;
    } catch (err) {
        console.error("[Shepu Proactive] Error in askProactiveQuestion flow:", err);
        removeProactiveTyping();
    }
}

async function generateProactiveQuestionFromGemini(retryCount = 0) {
    const apiKey = typeof ShepuAPI !== 'undefined' ? ShepuAPI.getActiveKey() : "";
    if (!apiKey) {
        return getFallbackProactiveQuestion();
    }
    
    console.log("[Shepu Proactive] Requesting Gemini to generate question using key index:", typeof ShepuAPI !== 'undefined' ? ShepuAPI.getActiveIndex() : 0);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const proactivePrompt = "The user has been silent for a few seconds. Generate a single, friendly, natural, and engaging follow-up question or a new interesting question in Bengali based on the previous conversation history. Keep it extremely short (1 sentence, maximum 10-12 words), conversational, and natural. Do not output anything else, just the question in Bengali.";
    
    let contents = [...chatHistoryContext];
    contents.push({
        role: 'user',
        parts: [{ text: proactivePrompt }]
    });
    
    const systemInstruction = "You are Shepu-AI v4.0 Pro, a highly intelligent, friendly, and helpful AI assistant. You are having a conversation and the user went quiet. Ask them a follow-up question. Keep it short, casual, and friendly in Bengali.";
    
    const payload = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        }
    };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.warn("[Shepu Proactive] Request timed out. Aborting...");
        controller.abort();
    }, 6000);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error("HTTP Error " + response.status);
        
        const data = await response.json();
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
            let question = data.candidates[0].content.parts[0].text.trim();
            question = question.replace(/^["'“`]+|["'”`]+$/g, '').trim();
            return question;
        }
        throw new Error("Invalid API response format");
    } catch (err) {
        clearTimeout(timeoutId);
        if (typeof ShepuAPI !== 'undefined') {
            const maxRetries = ShepuAPI.getKeyCount();
            if (retryCount < maxRetries - 1) {
                console.warn("[Shepu Proactive] API call failed. Rotating key and retrying...", err.message);
                ShepuAPI.rotateKey();
                return await generateProactiveQuestionFromGemini(retryCount + 1);
            }
        }
        console.error("[Shepu Proactive] All retries failed. Falling back to local DB.", err);
        return getFallbackProactiveQuestion();
    }
}

function getFallbackProactiveQuestion() {
    if (golpoDatabase.length === 0) {
        return "আপনি কি কোনো গল্প শুনতে চান?";
    }
    const item = golpoDatabase[Math.floor(Math.random() * golpoDatabase.length)];
    return item.q;
}

function startSmartConversation() {
    if (typeof isTrainAiViewOpen !== 'undefined' && isTrainAiViewOpen) {
        closeTrainAiPage();
    }
    ultraSmartness = true;
    currentConversationId = null;
    chatContainer.innerHTML = '';
    chatHistoryContext = [];
    hasAskedProactiveQuestion = false;
    
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.style.display = 'inline-flex';
    
    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }
    
    resetIdleTimer();
}

function exitSmartConversation() {
    if (typeof isTrainAiViewOpen !== 'undefined' && isTrainAiViewOpen) {
        closeTrainAiPage();
        return;
    }
    ultraSmartness = false;
    currentConversationId = null;
    
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.style.display = 'none';
    
    location.reload();
}

function checkProactiveAnswer(input) {
    if (!activeProactiveItem) return null;
    const sim = similarity(input.toLowerCase(), activeProactiveItem.a.toLowerCase());
    if (sim > 0.4 || activeProactiveItem.a.toLowerCase().includes(input.toLowerCase())) {
        const successResponses = [
            "একদম ঠিক! আপনি তো অনেক জানেন।",
            "চমৎকার! আপনার উত্তরটি সঠিক হয়েছে।",
            "ঠিক বলেছেন! এই বিষয়টি আপনার বেশ ভালোই জানা দেখছি।"
        ];
        activeProactiveItem = null;
        resetIdleTimer();
        return successResponses[Math.floor(Math.random() * successResponses.length)];
    }
    activeProactiveItem = null;
    return null;
}

function setDynamicGreeting() {
    const hour = new Date().getHours();
    const h2 = document.getElementById('greetingText');
    if (!h2) return;
    let greetingText;
    if (hour < 12) greetingText = "শুভ সকাল, আমি Shepu-AI v4.0 Pro";
    else if (hour < 18) greetingText = "শুভ অপরাহ্ন, আমি Shepu-AI v4.0 Pro";
    else greetingText = "শুভ সন্ধ্যা, আমি Shepu-AI v4.0 Pro";
    h2.innerText = greetingText;
}

function checkFirstTimeOnboarding() {
    const hasSeen = localStorage.getItem('shepu_has_seen_onboarding');
    const savedName = localStorage.getItem('shepu_user_name');
    const savedAvatar = localStorage.getItem('shepu_user_avatar');
    
    if (!hasSeen && !savedName && !savedAvatar) {
        localStorage.setItem('shepu_has_seen_onboarding', 'true');
        setTimeout(() => {
            const onboardingMsg = "স্বাগতম Shepu-AI v4.0 Pro-তে! 👋\n\nআরও সুন্দর ও ব্যক্তিগত অভিজ্ঞতা পেতে ওপরের ৩-লাইন (☰) মেনুতে গিয়ে **Settings** ➔ **'Edit Your Profile'**-এ ক্লিক করে আপনার নাম ও প্রোফাইল ছবি যুক্ত করে নিন।";
            addMessage(onboardingMsg, 'bot');
        }, 800);
    }
}

// Keep other functions unmodified
function changeTheme(themeValue, isInitial = false) {
    document.body.classList.remove('light-mode', 'hacking-mode', 'dark-mode');
    
    if (themeValue === 'hacking-mode') {
        document.body.classList.add('hacking-mode');
        const aiAvatar = document.getElementById('ai-avatar');
        if (aiAvatar) {
            aiAvatar.src = "app/assets/hai.ico";
            aiAvatar.onerror = function() {
                this.style.display = 'none';
                this.parentElement.innerHTML = '<i class="fas fa-skull-crossbones"></i>';
            };
        }
        if (!isInitial) {
            addMessage("Hacking Mode Activated... Terminal initialized.", "bot");
        }
    } else if (themeValue === 'light-mode') {
        document.body.classList.add('light-mode');
        const aiAvatar = document.getElementById('ai-avatar');
        if (aiAvatar) aiAvatar.src = "app/assets/upai.png";
    } else {
        document.body.classList.add('dark-mode');
        const aiAvatar = document.getElementById('ai-avatar');
        if (aiAvatar) aiAvatar.src = "app/assets/upai.png";
    }
    
    localStorage.setItem('theme', themeValue);
    
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
        themeSelector.value = themeValue;
    }
}

function setHackingMode() {
    const isHacking = document.body.classList.contains('hacking-mode');
    changeTheme(isHacking ? 'dark-mode' : 'hacking-mode');
}

function toggleTheme() {
    const isLight = document.body.classList.contains('light-mode');
    changeTheme(isLight ? 'dark-mode' : 'light-mode');
}

const GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzqIqfPdBPZDWKkI65qjJFEcnVq1_eafRryFYH9yGipdvzSSFnxEAgdwHmHe8jErvLB3g/exec";
const LOCAL_STORAGE_GSHEET_KEY = "shepu_cached_gsheet_data";

function getCachedGoogleSheetData() {
    try {
        const cached = localStorage.getItem(LOCAL_STORAGE_GSHEET_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.error("[Shepu Offline Sync] Error reading cached Google Sheet data:", e);
    }
    return [];
}

function applyGsheetDataToDatabase(dataArray) {
    if (!Array.isArray(dataArray)) return;
    dataArray.forEach(item => {
        const qStr = (item.question || item.q || "").toString().trim().toLowerCase();
        const aStr = (item.answer || item.a || "").toString().trim();
        if (qStr && aStr) {
            database.push({ q: qStr, a: aStr });
        }
    });
}

async function syncGoogleSheetData() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        let res = await fetch(GOOGLE_SHEET_WEBAPP_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            let freshData = await res.json();
            if (Array.isArray(freshData) && freshData.length > 0) {
                const freshStr = JSON.stringify(freshData);
                const cachedStr = localStorage.getItem(LOCAL_STORAGE_GSHEET_KEY);

                if (freshStr !== cachedStr) {
                    console.log("[Shepu Offline Sync] New or updated data found in Google Sheet. Updating cache...");
                    localStorage.setItem(LOCAL_STORAGE_GSHEET_KEY, freshStr);

                    freshData.forEach(item => {
                        const qStr = (item.question || item.q || "").toString().trim().toLowerCase();
                        const aStr = (item.answer || item.a || "").toString().trim();
                        if (qStr && aStr) {
                            const exists = database.some(dbEntry => dbEntry.q === qStr && dbEntry.a === aStr);
                            if (!exists) {
                                database.push({ q: qStr, a: aStr });
                            }
                        }
                    });
                    console.log("[Shepu Offline Sync] Offline database updated with latest Google Sheet data.");
                } else {
                    console.log("[Shepu Offline Sync] Google Sheet data is up to date.");
                }
            }
        }
    } catch (e) {
        console.warn("[Shepu Offline Sync] Sync attempt failed or device offline. Preserving existing cached data:", e.message || e);
    }
}

function updateNetworkStatusUI() {
    const statusBtn = document.getElementById('networkStatusBtn');
    const statusText = document.getElementById('networkStatusText');
    const statusIcon = document.getElementById('networkStatusIcon');
    if (!statusText) return;

    if (navigator.onLine) {
        if (statusBtn) statusBtn.classList.remove('offline');
        statusText.innerText = "Online";
        if (statusIcon) statusIcon.className = "fas fa-wifi";
    } else {
        if (statusBtn) statusBtn.classList.add('offline');
        statusText.innerText = "Offline";
        if (statusIcon) statusIcon.className = "fas fa-wifi-slash";
    }
}

// Auto-sync & Status updates when internet connection changes
window.addEventListener('online', () => {
    updateNetworkStatusUI();
    console.log("[Shepu Offline Sync] Internet connection detected. Triggering auto-sync...");
    syncGoogleSheetData();
});

window.addEventListener('offline', updateNetworkStatusUI);

async function loadData() {
    EMBEDDED_DB.forEach(item => database.push({ q: item.q.toLowerCase(), a: item.a }));
    const files = ['bar.txt', 'golpo.txt', 'new.txt', 'book.txt', 'knowledge.txt'];
    for (let file of files) {
        try {
            let res = await fetch('app/data/' + file);
            if (res.ok) {
                let text = await res.text();
                let lines = text.split('\n');
                lines.forEach(line => {
                    if (line.includes(';')) {
                        const parts = line.split(';');
                        if (parts.length >= 2) {
                            const entry = {
                                q: parts[0].trim().toLowerCase(),
                                a: parts.slice(1).join(';').trim()
                            };
                            database.push(entry);
                            if (file === 'golpo.txt' && entry.q.length > 5) {
                                golpoDatabase.push(entry);
                            }
                        }
                    }
                });
            }
        } catch (e) { }
    }

    // 1. Immediately load offline cached Google Sheet data so offline works instantly
    const cachedData = getCachedGoogleSheetData();
    if (cachedData.length > 0) {
        applyGsheetDataToDatabase(cachedData);
        console.log("[Shepu Offline Sync] Initialized database with " + cachedData.length + " cached Google Sheet entries.");
    }

    // 2. Perform background sync if online (updates cache & database if needed)
    syncGoogleSheetData();
}

function similarity(s1, s2) {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) { longer = s2; shorter = s1; }
    let longerLength = longer.length;
    if (longerLength == 0) return 1.0;
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
    let costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i == 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

// Bengali Suffix Stripper for Root Word Matching
function stripBengaliSuffix(word) {
    if (!word) return "";
    if (word.length < 4) return word;
    const stripped = word.replace(/(টা|টি|গুলো|গুলা|কে|রে|র|এর|তে|এ|য়|হতে|থেকে|দিয়ে|দ্বারা|সহ|নিয়ে)$/, '');
    if (stripped.length >= 2) {
        return stripped;
    }
    return word;
}

// Banglish Suffix Stripper
function stripBanglishSuffix(word) {
    if (word.length < 4) return word;
    const stripped = word.replace(/(er|ke|te|r|s|'s)$/, '');
    if (stripped.length >= 3) {
        return stripped;
    }
    return word;
}

// Query Normalizer (Lowercase, punctuation removal, suffix stripping)
function normalizeQuery(str) {
    if (!str) return "";
    let clean = str.toLowerCase().replace(/[?.!,;:\"'()\-+]/g, ' ').trim();
    let words = clean.split(/\s+/).map(word => {
        if (/[\u0980-\u09ff]/.test(word)) {
            return stripBengaliSuffix(word);
        }
        return stripBanglishSuffix(word);
    });
    return words.filter(w => w.length > 0).join(' ');
}

// Advanced Match Scoring Algorithm
function calculateMatchScore(userQuery, dbQuery) {
    const userNorm = normalizeQuery(userQuery);
    const dbNorm = normalizeQuery(dbQuery);
    
    if (userNorm === dbNorm) return 1.0;
    
    if (userNorm.includes(dbNorm) || dbNorm.includes(userNorm)) {
        const uWords = userNorm.split(/\s+/);
        const dWords = dbNorm.split(/\s+/);
        const matches = uWords.filter(w => dWords.includes(w)).length;
        const overlap = matches / Math.max(uWords.length, dWords.length);
        return overlap * 0.95;
    }
    
    const sim = similarity(userNorm, dbNorm);
    const uWords = userNorm.split(/\s+/);
    const dWords = dbNorm.split(/\s+/);
    const matches = uWords.filter(w => dWords.includes(w)).length;
    const overlap = matches / Math.max(uWords.length, dWords.length);
    
    return (sim * 0.3) + (overlap * 0.7);
}

// Safely evaluate math expression from Bengali and English input
function parseAndEvaluateMath(query) {
    const banglaNums = {
        '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
        '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    let parsed = query;
    for (let b in banglaNums) {
        parsed = parsed.split(b).join(banglaNums[b]);
    }

    parsed = parsed.replace(/যোগ/g, '+')
                   .replace(/বিয়োগ|বিয়োগফল/g, '-')
                   .replace(/গুণ|গুন|পূরণ|পুরন/g, '*')
                   .replace(/ভাগ/g, '/')
                   .replace(/সমান/g, '=');

    let mathExpr = parsed.replace(/[^0-9\+\-\*\/\(\)\.\s]/g, '').trim();
    
    if (mathExpr && /\d/.test(mathExpr) && /[\+\-\*\/]/.test(mathExpr)) {
        try {
            mathExpr = mathExpr.replace(/\s+/g, ' ');
            const result = Function('"use strict";return (' + mathExpr + ')')();
            if (result !== Infinity && result !== -Infinity && !isNaN(result)) {
                return result;
            }
        } catch (e) {
            console.warn("[Shepu Math Engine] Error evaluating expression:", mathExpr, e);
        }
    }
    return null;
}

// Convert numbers back to Bengali digits
function toBengaliDigits(num) {
    const englishToBangla = {
        '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
        '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };
    return num.toString().split('').map(char => englishToBangla[char] || char).join('');
}

// Robust validation for Time and Date queries
function checkTimeOrDateQuery(query) {
    const norm = query.toLowerCase().trim().replace(/[?.!,]/g, '');
    
    const timeKeywords = [
        "সময় কত", "সময় কতো", "কয়টা বাজে", "কয়টা বাজে এখন", "ঘড়িতে কয়টা", "বর্তমান সময়", "বর্তমান সময়",
        "current time", "what is the time", "what time is it", "tell me the time", "time now"
    ];
    const dateKeywords = [
        "আজকের তারিখ", "আজ কি তারিখ", "আজকে কত তারিখ", "আজকে কি বার", "আজ কি বার", "আজকের দিন", "আজকের দিনটি",
        "date today", "today date", "current date", "what is the date", "what day is today", "todays date"
    ];
    
    if (timeKeywords.some(kw => norm === kw || (norm.length < 25 && norm.includes(kw)))) {
        return { type: 'time' };
    }
    if (dateKeywords.some(kw => norm === kw || (norm.length < 25 && norm.includes(kw)))) {
        return { type: 'date' };
    }
    
    return null;
}

// Roll subject stack helper for pronoun resolution
function pushSubject(subject) {
    if (!subject) return;
    conversationContext.subjects = conversationContext.subjects.filter(s => s !== subject);
    conversationContext.subjects.push(subject);
    if (conversationContext.subjects.length > 3) {
        conversationContext.subjects.shift();
    }
}

let chatHistoryContext = [];

function addToChatHistory(role, text) {
    if (!text || typeof text !== 'string') return;
    const mappedRole = role === 'bot' ? 'model' : 'user';
    
    if (chatHistoryContext.length > 0 && chatHistoryContext[chatHistoryContext.length - 1].role === mappedRole) {
        chatHistoryContext[chatHistoryContext.length - 1].parts[0].text += "\n\n" + text;
    } else {
        chatHistoryContext.push({
            role: mappedRole,
            parts: [{ text: text }]
        });
    }
    
    if (chatHistoryContext.length > 10) {
        chatHistoryContext.shift();
    }
}

// Enhanced RAG Search
function getLocalContext(query) {
    console.log("[Shepu RAG] Searching local context for:", query);
    const cleanQuery = query.replace(/[?.!,]/g, ' ').trim();
    
    const stopWords = new Set([
        "is", "the", "a", "an", "are", "in", "on", "at", "to", "for", "with", "and", "or", "of", "by", "from",
        "ki", "er", "e", "te", "kore", "kora", "theke", "thekai", "holo", "hoy", "hobe", "niye", "ami", "tumi",
        "amake", "amader", "apnar", "apnake", "he", "she", "it", "they", "this", "that", "kintu", "ebong", "o"
    ]);
    
    const extractKeywords = (str) => {
        return str.split(/\s+/)
            .map(w => w.toLowerCase())
            .filter(w => w.length > 1 && !stopWords.has(w))
            .map(w => /[\u0980-\u09ff]/.test(w) ? stripBengaliSuffix(w) : stripBanglishSuffix(w));
    };
    
    const userKeywords = extractKeywords(cleanQuery);
    let scoredItems = [];
    
    database.forEach(item => {
        const dbQ = (item.q || "").toLowerCase().trim();
        // Exclude image generation records so they NEVER mix with normal chat
        if (dbQ.includes('[img_prompt]') || dbQ.includes('[img]') || (item.a && item.a.includes('[IMG_EXPANDED]'))) {
            return;
        }
        const dbKeywords = extractKeywords(dbQ);
        
        const keywordMatches = userKeywords.filter(w => dbKeywords.includes(w)).length;
        const keywordScore = userKeywords.length > 0 ? (keywordMatches / userKeywords.length) : 0;
        
        const sim = similarity(normalizeQuery(cleanQuery), normalizeQuery(dbQ));
        
        const qWords = cleanQuery.split(/\s+/);
        const dbWords = dbQ.split(/\s+/);
        const matches = qWords.filter(w => dbWords.includes(w)).length;
        const overlap = matches / Math.max(qWords.length, dbWords.length);
        
        const score = (sim * 0.2) + (overlap * 0.3) + (keywordScore * 0.5);
        
        if (score > 0.15) {
            scoredItems.push({ item, score });
        }
    });

    scoredItems.sort((a, b) => b.score - a.score);
    const results = scoredItems.slice(0, 5).map(x => x.item);
    console.log("[Shepu RAG] Retrieved best matching entries count:", results.length);
    return results;
}

// Enforce limit of 50 Gemini calls per 24 hours
function checkAndIncrementGeminiLimit() {
    const LIMIT_MAX = 50;
    const LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
    
    let limitData = { count: 0, firstCallTime: Date.now() };
    try {
        const stored = localStorage.getItem('shepu_api_limit');
        if (stored) {
            limitData = JSON.parse(stored);
        }
    } catch (e) {
        console.error("[Shepu Limit Engine] Error reading limit data:", e);
    }
    
    const now = Date.now();
    
    // Reset window if 24 hours have passed since the first counted call
    if (now - limitData.firstCallTime > LIMIT_WINDOW_MS) {
        limitData.count = 0;
        limitData.firstCallTime = now;
    }
    
    if (limitData.count >= LIMIT_MAX) {
        return false;
    }
    
    limitData.count++;
    try {
        localStorage.setItem('shepu_api_limit', JSON.stringify(limitData));
    } catch (e) {
        console.error("[Shepu Limit Engine] Error saving limit data:", e);
    }
    return true;
}

async function saveToGoogleSheet(question, answer) {
    const GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzqIqfPdBPZDWKkI65qjJFEcnVq1_eafRryFYH9yGipdvzSSFnxEAgdwHmHe8jErvLB3g/exec";
    try {
        const savedName = localStorage.getItem('shepu_user_name');
        let cleanQuestion = question;
        let cleanAnswer = answer;

        if (savedName && savedName.trim().length > 0) {
            const escapedName = savedName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const nameRegex = new RegExp(escapedName, 'gi');
            cleanQuestion = cleanQuestion.replace(nameRegex, '[User]');
            cleanAnswer = cleanAnswer.replace(nameRegex, '[User]');
        }

        console.log("[Shepu System] Saving Q&A to Google Sheets (privacy sanitized)...");
        await fetch(GOOGLE_SHEET_WEBAPP_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ question: cleanQuestion, answer: cleanAnswer })
        });
        console.log("[Shepu System] Q&A successfully POSTed to Google Sheet webapp.");
    } catch (e) {
        console.error("[Shepu System] Failed to save Q&A to Google Sheet:", e);
    }
}

// Robust Gemini API calling client with Key Rotation on errors/timeouts
async function callGeminiAPI(query, retryCount = 0) {
    if (retryCount === 0) {
        if (!checkAndIncrementGeminiLimit()) {
            console.warn("[Shepu Limit Engine] Gemini API 24-hour query limit exceeded. Blocking request.");
            return `আসসালামু আলাইকুম, আমি **Shepu-AI v4.0 Pro**। আপনি আপনার ফ্রি ব্যবহারের লিমিট শেষ করে ফেলেছেন। দয়া করে ২৪ ঘণ্টা অপেক্ষা করুন, আপনার টোকেন লিমিট রিসেট হবে অথবা Shepu-AI v3.1 ব্যবহার করতে পারেন।

<div style="margin-top: 15px;">
    <a href="app/old_versions/ai5.html" class="new-chat-btn" style="display: inline-flex; text-decoration: none; align-items: center; justify-content: center; gap: 8px; width: auto; max-width: 250px; margin-bottom: 0;">
        <i class="fas fa-random"></i> Shepu-AI v3.1 এ যান
    </a>
</div>`;
        }
    }

    console.log("[Shepu Gemini] Initiating API call for query:", query, "using key index:", typeof ShepuAPI !== 'undefined' ? ShepuAPI.getActiveIndex() : 0);
    const localContext = getLocalContext(query);
    const retrievedContext = localContext.length > 0 
        ? localContext.map(entry => `Question: ${entry.q}\nAnswer: ${entry.a}`).join("\n\n")
        : "No direct reference data found in local files.";

    const systemInstruction = `You are Shepu-AI v4.0 Pro, a highly intelligent, friendly, and helpful AI assistant created to help the user.
Your behavior rules:
1. Always prioritize answering the user's questions based on the provided "Reference Database" entries.
2. If the "Reference Database" entries contain the information, learn from it and generate a complete, coherent, friendly, and beautiful response in a natural conversational style. Avoid raw copy-pasting; format and present it nicely.
3. If the "Reference Database" entries do not contain the answer, use your pre-trained general knowledge to answer, but politely and briefly mention that this information is from your own knowledge base and not directly found in the local files.
4. Always respond in the same language as the user's query (usually Bengali or English).
5. Keep your responses friendly, respectful, and well-formatted with markdown.

Here are the retrieved relevant entries from the "Reference Database" for your learning context:
${retrievedContext}`;

    const apiKey = typeof ShepuAPI !== 'undefined' ? ShepuAPI.getActiveKey() : "";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    let contents = [...chatHistoryContext];
    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
        contents.push({
            role: 'user',
            parts: [{ text: query }]
        });
    } else {
        contents[contents.length - 1].parts[0].text = query;
    }

    const savedName = localStorage.getItem('shepu_user_name');
    let effectiveSystemInstruction = systemInstruction;
    if (savedName) {
        effectiveSystemInstruction += ` The user's name is "${savedName}". Address or acknowledge the user by their name when appropriate in Bengali or English.`;
    }

    const payload = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: effectiveSystemInstruction }]
        }
    };

    console.log("[Shepu Gemini] Fetch payload structured. Sending request...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.warn("[Shepu Gemini] Request timed out. Aborting...");
        controller.abort();
    }, 6000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        console.log("[Shepu Gemini] Received response. Status:", response.status);
        
        if (!response.ok) {
            if (typeof ShepuAPI !== 'undefined') {
                const maxRetries = ShepuAPI.getKeyCount();
                if (retryCount < maxRetries - 1) {
                    console.warn(`[Shepu Gemini] HTTP Error ${response.status}. Blocking key, rotating and retrying...`);
                    const blockDuration = (response.status === 429 || response.status === 403) ? 15 * 60 * 1000 : 5 * 60 * 1000;
                    ShepuAPI.markActiveKeyAsBlocked(blockDuration);
                    ShepuAPI.rotateKey();
                    return await callGeminiAPI(query, retryCount + 1);
                }
            }
            throw new Error(`Gemini API HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
            if (typeof ShepuAPI !== 'undefined') {
                const maxRetries = ShepuAPI.getKeyCount();
                if (retryCount < maxRetries - 1) {
                    const isRateOrAuthError = data.error.code === 429 || data.error.code === 403 || data.error.status === "RESOURCE_EXHAUSTED";
                    console.warn("[Shepu Gemini] API response contains error. Blocking key, rotating and retrying...", data.error);
                    const blockDuration = isRateOrAuthError ? 15 * 60 * 1000 : 5 * 60 * 1000;
                    ShepuAPI.markActiveKeyAsBlocked(blockDuration);
                    ShepuAPI.rotateKey();
                    return await callGeminiAPI(query, retryCount + 1);
                }
            }
            throw new Error(data.error.message || "Gemini API error in response body");
        }

        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0] && typeof data.candidates[0].content.parts[0].text === 'string') {
            const botText = data.candidates[0].content.parts[0].text;
            console.log("[Shepu Gemini] Response text fetched successfully!");
            // Post Q&A to Google Sheets webapp asynchronously
            saveToGoogleSheet(query, botText);
            return botText;
        } else {
            throw new Error("Invalid or empty response format from Gemini API");
        }
    } catch (err) {
        clearTimeout(timeoutId);
        if (typeof ShepuAPI !== 'undefined') {
            const maxRetries = ShepuAPI.getKeyCount();
            if (retryCount < maxRetries - 1) {
                console.warn("[Shepu Gemini] Exception caught. Blocking key, rotating and retrying...", err.message);
                ShepuAPI.markActiveKeyAsBlocked(5 * 60 * 1000);
                ShepuAPI.rotateKey();
                return await callGeminiAPI(query, retryCount + 1);
            }
        }
        throw err;
    }
}

// Central processing function for replies
async function findAnswer(query) {
    console.log("[Shepu System] findAnswer called for:", query);
    query = query.toLowerCase().trim();
    if (!query) return null;

    // 0. Check User's Custom Trained Data FIRST (100% Private, Local & Near Match)
    const customTrainedAnswer = getCustomTrainedAnswer(query);
    if (customTrainedAnswer) {
        console.log("[Shepu Train AI] Custom trained answer found. Bypassing API & Google Sheets.");
        return customTrainedAnswer;
    }

    const savedName = localStorage.getItem('shepu_user_name');
    if (savedName) {
        if (query.includes('my name') || query.includes('amar nam') || query.includes('আমার নাম') || query.includes('ami ke') || query.includes('আমি কে')) {
            return `আপনার নাম **${savedName}**। আমি শেপু-আই! আপনাকে কীভাবে সাহায্য করতে পারি?`;
        }
    }

    // 1. Math Evaluator
    const mathResult = parseAndEvaluateMath(query);
    if (mathResult !== null) {
        const hasBangla = /[\u0980-\u09ff]/.test(query);
        const formattedResult = hasBangla ? toBengaliDigits(mathResult) : mathResult;
        console.log("[Shepu System] Math expression solved locally:", mathResult);
        return `আমি আপনার জন্য হিসাব করেছি: **${formattedResult}**`;
    }

    // 2. Time/Date Checker
    const timeOrDate = checkTimeOrDateQuery(query);
    if (timeOrDate) {
        if (timeOrDate.type === 'time') {
            console.log("[Shepu System] Time request solved locally.");
            return "বর্তমান সময়: **" + new Date().toLocaleTimeString('bn-BD', { hour: 'numeric', minute: 'numeric', hour12: true }) + "**";
        } else {
            console.log("[Shepu System] Date request solved locally.");
            const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
            const currentDay = days[new Date().getDay()];
            return "আজকের তারিখ: **" + new Date().toLocaleDateString('bn-BD') + " (" + currentDay + ")**";
        }
    }

    // 3. Pronoun / Context Resolution
    let processedQuery = query;
    const pronouns = ["k", "ki", "tar", "oita", "ota", "oitar", "সে কে", "তার নাম", "তার ছবি", "তার বয়স"];
    if (query.split(' ').length <= 4 && conversationContext.subjects.length > 0) {
        if (pronouns.some(p => query.includes(p))) {
            const activeSubject = conversationContext.subjects[conversationContext.subjects.length - 1];
            processedQuery = activeSubject + " " + query;
            console.log("[Shepu System] Query resolved using subject stack:", processedQuery);
        }
    }

    // Keyword collection
    const stopWords = new Set(["is", "the", "a", "an", "are", "in", "on", "at", "to", "for", "with", "ki", "er", "e", "te"]);
    processedQuery.split(/\s+/).forEach(w => {
        if (w.length > 1 && !stopWords.has(w)) {
            conversationContext.globalKeywords.add(w);
        }
    });

    // 4. Exact/High Confidence Database Match
    let bestMatch = null;
    let highestScore = -1;
    
    database.forEach(item => {
        const score = calculateMatchScore(processedQuery, item.q);
        if (score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    });

    console.log("[Shepu System] Best match score:", highestScore, "for:", bestMatch ? bestMatch.q : "none");

    if (bestMatch && highestScore >= 0.75) {
        const words = bestMatch.q.split(/\s+/);
        if (words.length > 0) {
            pushSubject(words[0]);
        }
        console.log("[Shepu System] High confidence match (score >= 0.75). Bypassing Gemini API to save tokens.");
        return beautifyResponse(bestMatch.a);
    }

    // 5. Call Gemini API
    try {
        const result = await callGeminiAPI(query);
        return result;
    } catch (err) {
        console.error("[Shepu System] Gemini API failed. Falling back to local database...", err);
        
        // Low confidence fallback
        if (bestMatch && highestScore > 0.15) {
            console.log("[Shepu System] Fallback local match score:", highestScore);
            return beautifyResponse(bestMatch.a);
        }
        
        return "দুঃখিত, এই মুহূর্তে সব ব্যাকআপ এপিআই (API) লিমিট শেষ হওয়ার কারণে অথবা নেটওয়ার্ক সমস্যার কারণে উত্তর দেওয়া সম্ভব হচ্ছে না। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা অন্যভাবে লিখুন।";
    }
}

function beautifyResponse(text) {
    if (text.length > 100 && !text.includes('\n')) {
        return text.split('. ').join('.\n- ');
    }
    return text;
}

function handleUserInput() {
    resetIdleTimer();
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if (this.value.trim() === "") {
        this.style.height = '48px';
        sendBtn.classList.remove('has-text');
    } else {
        sendBtn.classList.add('has-text');
    }
    handleSuggestions(this.value);
}

let currentTtsAudio = null;

function stopAllSpeech() {
    if (window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === 'function') {
        window.flutter_inappwebview.callHandler('nativeStopSpeak').catch(() => {});
    }
    if (window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch(e) {}
    }
    if (currentTtsAudio) {
        try { currentTtsAudio.pause(); } catch(e) {}
        currentTtsAudio = null;
    }
    document.querySelectorAll('.msg-action-btn.active').forEach(b => b.classList.remove('active'));
}

window.onNativeSpeechEnd = function() {
    document.querySelectorAll('.msg-action-btn.active').forEach(b => b.classList.remove('active'));
};

function speakText(text, buttonElement = null) {
    if (buttonElement && buttonElement.classList.contains('active')) {
        stopAllSpeech();
        return;
    }

    stopAllSpeech();

    let cleanText = (text || "").replace(/<[^>]*>?/gm, '').replace(/\*\*/g, '').replace(/__/g, '').trim();
    if (!cleanText) return;

    if (buttonElement) buttonElement.classList.add('active');

    // Priority 1: Native Android TTS via Flutter InAppWebView (Guaranteed to work in APK release builds!)
    if (window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === 'function') {
        window.flutter_inappwebview.callHandler('nativeSpeak', cleanText).catch(err => {
            console.warn('[Native TTS Error]', err);
            if (buttonElement) buttonElement.classList.remove('active');
        });
        return;
    }

    // Priority 2: Web Speech API (For desktop browsers)
    let spokeWithWebSpeech = false;

    if (window.speechSynthesis) {
        try {
            window.speechSynthesis.resume();
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'bn-BD';

            const voices = window.speechSynthesis.getVoices();
            const bnVoice = voices.find(v => (v.lang && v.lang.toLowerCase().includes('bn')) || (v.name && v.name.toLowerCase().includes('bengali')));
            if (bnVoice) utterance.voice = bnVoice;

            utterance.onend = () => { if (buttonElement) buttonElement.classList.remove('active'); };
            utterance.onerror = (e) => { 
                console.warn('[WebSpeech Error, fallback to Audio TTS]', e);
                playAudioTtsFallback(cleanText, buttonElement);
            };

            window.speechSynthesis.speak(utterance);
            spokeWithWebSpeech = true;
        } catch(e) {
            console.warn('[WebSpeech exception, fallback to Audio TTS]', e);
        }
    }

    if (!spokeWithWebSpeech) {
        playAudioTtsFallback(cleanText, buttonElement);
    }
}

function playAudioTtsFallback(text, buttonElement) {
    const truncatedText = text.substring(0, 200);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(truncatedText)}&tl=bn&client=tw-ob`;
    
    if (currentTtsAudio) {
        currentTtsAudio.pause();
    }
    
    currentTtsAudio = new Audio(ttsUrl);
    currentTtsAudio.onended = () => { if (buttonElement) buttonElement.classList.remove('active'); };
    currentTtsAudio.onerror = () => { 
        if (buttonElement) buttonElement.classList.remove('active');
    };
    currentTtsAudio.play().catch(err => {
        console.error('TTS Audio Play Error:', err);
        if (buttonElement) buttonElement.classList.remove('active');
    });
}

function speakMessage(button) {
    const textToSpeak = button.getAttribute('data-text');
    speakText(textToSpeak, button);
}

function copyMessage(button) {
    const textToCopy = button.getAttribute('data-text');
    if (navigator.clipboard) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showCopyFeedback(button);
        });
    }
}

function showCopyFeedback(button) {
    const icon = button.querySelector('i');
    if (icon) {
        const originalClass = icon.className;
        icon.className = 'fas fa-check';
        setTimeout(() => icon.className = originalClass, 2000);
    }
    showToast('Copied to clipboard! 📋', 'fa-copy');
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    
    stopAllSpeech();
    hasAskedProactiveQuestion = false;
    isBotAnswering = true; // Block idle timer triggers
    console.log("[Shepu System] User requested message send:", text);
    userInput.value = '';
    userInput.style.height = '48px';
    sendBtn.classList.remove('has-text');
    suggestionBox.style.display = 'none';
    addMessage(text, 'user');
    addToChatHistory('user', text);
    saveMessageToConversation('user', text);
    clearIdleTimers();

    // Check if image generation requested (via Image Mode or Natural Language Prompt)
    if (isImageModeActive || isImageGenerationIntent(text)) {
        await handleImageGenerationRequest(text);
        return;
    }

    const thinkingId = addTypingIndicator();
    
    let answer = checkProactiveAnswer(text);
    if (answer) {
        console.log("[Shepu System] Proactive answer detected:", answer);
        setTimeout(() => {
            removeMessage(thinkingId);
            addMessage(answer, 'bot');
            addToChatHistory('bot', answer);
            saveMessageToConversation('bot', answer);
        }, 600);
    } else {
        try {
            const finalAnswer = await findAnswer(text);
            console.log("[Shepu System] findAnswer successfully resolved with response.");
            removeMessage(thinkingId);
            addMessage(finalAnswer, 'bot');
            addToChatHistory('bot', finalAnswer);
            saveMessageToConversation('bot', finalAnswer);
        } catch (err) {
            console.error("[Shepu System] Critical error in sendMessage:", err);
            removeMessage(thinkingId);
            const fallback = "দুঃখিত, সংযোগে কিছু সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন বা একটু পরে জিজ্ঞাসা করুন!";
            addMessage(fallback, 'bot');
            addToChatHistory('bot', fallback);
            saveMessageToConversation('bot', fallback);
        }
    }
}

function saveMessageToConversation(sender, text, meta = {}) {
    let conversations = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    const msgObj = { sender: sender, text: text, ...meta };
    
    if (currentConversationId === null) {
        currentConversationId = Date.now();
        const newConv = {
            id: currentConversationId,
            title: text.length > 30 ? text.substring(0, 30) + '...' : text,
            messages: [msgObj]
        };
        conversations.push(newConv);
        localStorage.setItem('chatHistory', JSON.stringify(conversations));
        loadConversations();
    } else {
        const convIndex = conversations.findIndex(c => c.id === currentConversationId);
        if (convIndex !== -1) {
            conversations[convIndex].messages.push(msgObj);
            localStorage.setItem('chatHistory', JSON.stringify(conversations));
        }
    }
}

function loadConversations() {
    const list = document.getElementById('historyList');
    if (!list) return;
    list.innerHTML = '';
    
    const conversations = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    conversations.slice().reverse().forEach(conv => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerText = conv.title;
        item.onclick = () => {
            loadConversation(conv.id);
        };
        list.appendChild(item);
    });
}

function loadConversation(id) {
    const conversations = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    
    currentConversationId = id;
    chatContainer.innerHTML = '';
    chatHistoryContext = [];
    hasAskedProactiveQuestion = false;
    disableImageMode();
    
    conv.messages.forEach(msg => {
        if (msg.type === 'image' && msg.imageUrl) {
            renderFluxImageCard(msg.imageUrl, msg.prompt || msg.text, msg.enhancedPrompt || '', false);
        } else {
            addMessage(msg.text, msg.sender, false);
            addToChatHistory(msg.sender, msg.text);
        }
    });
    
    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }
    
    scrollToBottom(true);
}

/* ==========================================================================
   SHEPU-AI IMAGE GENERATION ENGINE (FLUX.1 ULTRA HD)
   ========================================================================== */

function togglePlusMenu(e) {
    if (e) e.stopPropagation();
    const plusMenuBtn = document.getElementById('plusMenuBtn');
    const plusDropdownMenu = document.getElementById('plusDropdownMenu');
    if (!plusDropdownMenu) return;
    
    const isOpen = plusDropdownMenu.classList.contains('active');
    if (isOpen) {
        closePlusMenu();
    } else {
        plusDropdownMenu.classList.add('active');
        if (plusMenuBtn) plusMenuBtn.classList.add('active');
    }
}

function closePlusMenu() {
    const plusMenuBtn = document.getElementById('plusMenuBtn');
    const plusDropdownMenu = document.getElementById('plusDropdownMenu');
    if (plusDropdownMenu) plusDropdownMenu.classList.remove('active');
    if (plusMenuBtn) plusMenuBtn.classList.remove('active');
}

function selectPlusOption(type, e) {
    if (e) e.stopPropagation();
    closePlusMenu();
    if (type === 'image') {
        enableImageMode();
    } else if (type === 'regular') {
        disableImageMode();
        showToast('সাধারণ চ্যাট মোড চালু হয়েছে! 💬', 'fa-comment-dots');
    } else if (type === 'conversation') {
        startSmartConversation();
    }
}

function enableImageMode() {
    isImageModeActive = true;
    document.body.classList.add('image-mode-active');
    if (userInput) {
        userInput.placeholder = 'কি ধরণের ছবি তৈরি করতে চান লিখুন... (যেমন: futuristic cyberpunk city, সুন্দর বিড়াল)';
        userInput.focus();
    }
    showToast('ছবি তৈরি মোড চালু হয়েছে! 🎨', 'fa-wand-magic-sparkles');
}

function disableImageMode(e) {
    if (e) e.stopPropagation();
    isImageModeActive = false;
    document.body.classList.remove('image-mode-active');
    if (userInput) {
        userInput.placeholder = 'Ask anything...';
    }
}

function isImageGenerationIntent(text) {
    if (!text) return false;
    const lower = text.toLowerCase().trim();
    
    const triggers = [
        "ছবি বানাও", "ছবি আঁকো", "ছবি আঁক", "ছবি তৈরি করো", "ছবি তৈরি কর", "ছবি বানিয়ে দাও", "ছবি দাও", "ছবি দেখাও", "ছবি বানাতে চাই", "ছবি বানাও তো", "ছবি আর্ট", "ইমেজ তৈরি করো", "ইমেজ বানাও", "একটি ছবি", "একটা ছবি",
        "chobi banao", "chobi banau", "chobi toiri", "chobi toiri koro", "chobi draw", "chobi draw koro", "chobi dekhaw", "chobi dekhao", "chobi dao", "chobi lage", "chobi bania dao",
        "image banao", "image banau", "image toiri koro", "image create", "image generate", "generate image", "create image", "draw an image", "draw a picture", "draw image", "draw a", "paint an image", "paint a", "make an image", "picture of", "/imagine", "/image"
    ];
    
    return triggers.some(trig => lower.includes(trig));
}

function extractImagePrompt(text) {
    if (!text) return '';
    let p = text.trim();
    
    const patterns = [
        /^(ছবি বানাও|ছবি আঁকো|ছবি আঁক|ছবি তৈরি করো|ছবি তৈরি কর|ছবি বানিয়ে দাও|ছবি দাও|ছবি দেখাও|ছবি বানাতে চাই|ইমেজ তৈরি করো|ইমেজ বানাও|image banao|image banau|image toiri koro|image create|image generate|generate image|create image|draw an image of|draw a picture of|draw image of|draw a|paint an image of|paint a|make an image of|picture of|\/imagine|\/image)\s*:?\s*/i,
        /\s*(এর\s*ছবি\s*বানাও|এর\s*ছবি\s*আঁকো|এর\s*ছবি\s*তৈরি\s*করো|এর\s*ছবি\s*দাও|এর\s*ছবি\s*দেখাও|এর\s*ছবি|ছবি\s*বানাও|ছবি\s*আঁকো|ছবি\s*তৈরি\s*করো|ছবি\s*দাও|ছবি\s*বানিয়ে\s*দাও|chobi\s*banao|chobi\s*banau|chobi\s*toiri\s*koro|chobi\s*draw\s*koro|chobi\s*dao|image\s*banao|image\s*banau|image\s*toiri\s*koro)$/i
    ];
    
    for (const pat of patterns) {
        p = p.replace(pat, '').trim();
    }

    p = p.replace(/^(of|er|একটি|একটা|ekta|akti)\s+/i, '').trim();
    return p || text.trim();
}

async function translateBanglaToEnglish(text) {
    if (!text || !text.trim()) return text;
    const cleanText = text.trim();
    
    // Check if text contains Bengali script (Unicode U+0980 to U+09FF)
    const hasBanglaScript = /[\u0980-\u09ff]/.test(cleanText);
    
    if (!hasBanglaScript) {
        // Text is in English or Romanized Banglish
        return translateBanglishToEnglish(cleanText);
    }
    
    // Strategy 1: Google Translate public API (gtx) - fast, highly accurate, free, no API key needed
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=bn&tl=en&dt=t&q=${encodeURIComponent(cleanText)}`;
        const res = await fetch(gtxUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (data && data[0] && Array.isArray(data[0])) {
                const translated = data[0].map(item => item[0]).join('').trim();
                if (translated && translated.length > 0) {
                    console.log("[Shepu Translate] GTX translated:", cleanText, "->", translated);
                    return translated;
                }
            }
        }
    } catch (e) {
        console.warn("[Shepu Translate] GTX failed, falling back to MyMemory...", e);
    }
    
    // Strategy 2: MyMemory free API fallback
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=bn|en`;
        const res = await fetch(mmUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (data && data.responseData && data.responseData.translatedText) {
                const translated = data.responseData.translatedText.trim();
                if (translated && !translated.toLowerCase().includes("no query specified")) {
                    console.log("[Shepu Translate] MyMemory translated:", cleanText, "->", translated);
                    return translated;
                }
            }
        }
    } catch (e) {
        console.warn("[Shepu Translate] MyMemory failed:", e);
    }
    
    // Strategy 3: Local offline Bengali dictionary fallback
    return fallbackTranslateBanglaLocal(cleanText);
}

function translateBanglishToEnglish(text) {
    let s = ' ' + text.toLowerCase().trim() + ' ';
    
    const phrases = [
        [/\b(boshe\s+ache|boshe\s+thaka|boshe)\b/g, 'sitting'],
        [/\b(darie\s+ache|darie\s+thaka|darie)\b/g, 'standing'],
        [/\b(urche\s+pakhi|urche)\b/g, 'flying'],
        [/\b(douracche|dour\s+dicche)\b/g, 'running'],
        [/\b(ghumacche|ghumiye\s+ache)\b/g, 'sleeping'],
        [/\b(khelche)\b/g, 'playing'],
        [/\b(ghas\s+khacche)\b/g, 'grazing on green grass'],
        [/\b(shikar\s+korche)\b/g, 'hunting'],
        [/\b(rasta\s+diye\s+jacche|rasta\s+diye\s+chole)\b/g, 'driving on the road'],
        [/\b(chad\s*er\s*aloi|chader\s*aloy)\b/g, 'in luminous moonlight'],
        [/\b(surjer\s*aloi|surjer\s*aloy)\b/g, 'in golden sunlight'],
        [/\b(pahar\s*er\s*upor|paharer\s*upore)\b/g, 'on top of a majestic mountain'],
        [/\b(nodi\s*r\s*par|nodir\s*pare)\b/g, 'on the serene river bank'],
        [/\b(gach\s*er\s*dal|gacher\s*dale)\b/g, 'perched on a tree branch'],
        [/\b(saree\s+pora|shari\s+pore)\b/g, 'wearing elegant traditional saree'],
        [/\b(panjabi\s+pora|panjabi\s+pore)\b/g, 'wearing stylish traditional panjabi']
    ];
    
    for (const [reg, rep] of phrases) {
        s = s.replace(reg, rep);
    }
    
    const words = [
        // Articles & Quantifiers
        [/\b(ekta|ekti|akta)\b/g, 'a'],
        [/\b(duita|duti)\b/g, 'two'],
        [/\b(tinita|tinti)\b/g, 'three'],
        [/\b(onek)\b/g, 'many'],
        [/\b(shob|sob)\b/g, 'all'],
        // Animals
        [/\b(biral|bilai|billi)\b/g, 'cat'],
        [/\b(kukur|kutta)\b/g, 'dog'],
        [/\b(pakhi)\b/g, 'bird'],
        [/\b(bagh)\b/g, 'Bengal tiger'],
        [/\b(shingho|singho)\b/g, 'lion'],
        [/\b(hathi)\b/g, 'elephant'],
        [/\b(ghora)\b/g, 'horse'],
        [/\b(horin)\b/g, 'spotted deer'],
        [/\b(mach|maach)\b/g, 'fish'],
        [/\b(shap|shaap)\b/g, 'snake'],
        [/\b(banor|bador)\b/g, 'monkey'],
        [/\b(goru)\b/g, 'cow'],
        [/\b(chhagol|chagol)\b/g, 'goat'],
        [/\b(hash|haash)\b/g, 'duck'],
        [/\b(moyur|mojur)\b/g, 'peacock'],
        [/\b(kharogosh|khorgosh)\b/g, 'fluffy rabbit'],
        // People
        [/\b(meye|maiya|mahila|nari)\b/g, 'beautiful young woman'],
        [/\b(chele|pola|purush)\b/g, 'handsome young man'],
        [/\b(baccha|shishu)\b/g, 'cute toddler baby'],
        [/\b(briddho|buro)\b/g, 'wise elderly man with white beard'],
        [/\b(buri)\b/g, 'elderly woman'],
        [/\b(krishok)\b/g, 'hardworking farmer'],
        [/\b(rajkumar)\b/g, 'royal prince'],
        [/\b(rajkumari)\b/g, 'royal princess'],
        [/\b(joddha)\b/g, 'brave warrior'],
        [/\b(raja)\b/g, 'majestic king'],
        [/\b(rani)\b/g, 'majestic queen'],
        // Objects & Nature
        [/\b(gari|gaari)\b/g, 'car'],
        [/\b(bike|motorcycle)\b/g, 'motorcycle'],
        [/\b(nouka|nouko)\b/g, 'wooden boat'],
        [/\b(jahaj)\b/g, 'ship'],
        [/\b(ful|phul)\b/g, 'blossom flower'],
        [/\b(golap)\b/g, 'red rose'],
        [/\b(gach|gaach)\b/g, 'tree'],
        [/\b(pata)\b/g, 'green leaves'],
        [/\b(chata)\b/g, 'umbrella'],
        [/\b(boi)\b/g, 'book'],
        [/\b(bari|ghor)\b/g, 'cottage house'],
        [/\b(gram)\b/g, 'scenic rural village'],
        [/\b(nodi)\b/g, 'peaceful river'],
        [/\b(pahar)\b/g, 'majestic mountain'],
        [/\b(sagor|somudro)\b/g, 'ocean beach with waves'],
        [/\b(bon|jungle)\b/g, 'lush green forest'],
        [/\b(bagan)\b/g, 'fairytale garden'],
        [/\b(akash)\b/g, 'clear sky'],
        [/\b(megh)\b/g, 'dramatic clouds'],
        [/\b(bristi|vristi)\b/g, 'monsoon rain'],
        [/\b(chand|chaand)\b/g, 'full moon'],
        [/\b(surjo)\b/g, 'warm glowing sun'],
        [/\b(tara)\b/g, 'shining stars'],
        [/\b(rasta|shorok)\b/g, 'road'],
        [/\b(shohor)\b/g, 'modern city'],
        // Colors
        [/\b(lal)\b/g, 'red'],
        [/\b(kalo)\b/g, 'black'],
        [/\b(sada|shada)\b/g, 'white'],
        [/\b(sobuj)\b/g, 'green'],
        [/\b(neel|nil)\b/g, 'blue'],
        [/\b(holud)\b/g, 'yellow'],
        [/\b(golapi)\b/g, 'pink'],
        [/\b(beguni|baiguni)\b/g, 'purple'],
        [/\b(sonali)\b/g, 'golden'],
        [/\b(rupali)\b/g, 'silver'],
        // Modifiers
        [/\b(sundor|shundor)\b/g, 'beautiful aesthetic'],
        [/\b(choto)\b/g, 'small cute'],
        [/\b(boro)\b/g, 'giant massive'],
        [/\b(voyonkor)\b/g, 'epic dramatic'],
        [/\b(shanto)\b/g, 'peaceful serene'],
        [/\b(notun)\b/g, 'modern sleek'],
        [/\b(purono)\b/g, 'ancient vintage']
    ];
    
    for (const [reg, rep] of words) {
        s = s.replace(reg, rep);
    }
    
    return s.replace(/\s+/g, ' ').trim();
}

function fallbackTranslateBanglaLocal(text) {
    let result = text;
    const LOCAL_BN_DICT = [
        { reg: /একটি|একটা/g, rep: "a" },
        { reg: /মেয়ে|মেয়ে/gi, rep: "beautiful young woman" },
        { reg: /ছেলে/gi, rep: "handsome young man" },
        { reg: /বিড়াল|বিড়াল/gi, rep: "cute playful cat, fluffy fur" },
        { reg: /কুকুর/gi, rep: "adorable joyful dog" },
        { reg: /পাখি/gi, rep: "exotic colorful bird" },
        { reg: /বাঘ/gi, rep: "majestic Royal Bengal tiger" },
        { reg: /সিংহ/gi, rep: "regal lion" },
        { reg: /হাতি/gi, rep: "Asian elephant" },
        { reg: /ঘোড়া|ঘোড়া/gi, rep: "noble running horse" },
        { reg: /হরিণ/gi, rep: "gentle spotted deer" },
        { reg: /মাছ/gi, rep: "colorful exotic fish" },
        { reg: /গাড়ি|গাড়ি/gi, rep: "sleek modern car" },
        { reg: /বাগান/gi, rep: "magical botanical garden, blooming flowers" },
        { reg: /গ্রাম/gi, rep: "scenic Bengali rural countryside" },
        { reg: /নদী/gi, rep: "crystal clear winding river" },
        { reg: /ফুল/gi, rep: "vibrant blooming flowers" },
        { reg: /গোলাপ/gi, rep: "fresh blooming red rose" },
        { reg: /শহর/gi, rep: "futuristic city skyline" },
        { reg: /রোবট/gi, rep: "sentient AI humanoid robot" },
        { reg: /চাঁদ/gi, rep: "luminous full moon" },
        { reg: /সূর্য/gi, rep: "radiant sun" },
        { reg: /সমুদ্র/gi, rep: "ocean shore, crystal waves" },
        { reg: /পাহাড়|পাহাড়/gi, rep: "monumental mountain peaks" },
        { reg: /মহাকাশ/gi, rep: "deep space nebula and galaxies" },
        { reg: /লাল/gi, rep: "vibrant red" },
        { reg: /কালো/gi, rep: "sleek black" },
        { reg: /সাদা/gi, rep: "pure white" },
        { reg: /সবুজ/gi, rep: "lush green" },
        { reg: /নীল/gi, rep: "deep blue" },
        { reg: /হলুদ/gi, rep: "golden yellow" },
        { reg: /গোলাপি/gi, rep: "soft pink" },
        { reg: /সুন্দর/gi, rep: "breathtaking beautiful" },
        { reg: /বসে\s*আছে/gi, rep: "sitting comfortably" },
        { reg: /উড়ছে|উড়ছে/gi, rep: "flying gracefully" },
        { reg: /দৌড়াচ্ছে|দৌড়াচ্ছে/gi, rep: "running dynamically" }
    ];
    for (const item of LOCAL_BN_DICT) {
        result = result.replace(item.reg, item.rep);
    }
    return result;
}

async function enhancePromptLocally(rawPrompt) {
    if (!rawPrompt || !rawPrompt.trim()) {
        return "breathtaking cinematic masterpiece, ultra-detailed 8k resolution, photorealistic, sharp focus";
    }
    
    // Step 1: Translate Bengali / Banglish into English (100% free, 0 Gemini tokens)
    let englishPrompt = await translateBanglaToEnglish(rawPrompt.trim());
    if (!englishPrompt || !englishPrompt.trim()) {
        englishPrompt = rawPrompt.trim();
    }
    
    // Clean up excessive punctuation or repetitive words
    englishPrompt = englishPrompt
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
        
    // Step 2: Append premium quality booster tags for FLUX
    const qualityBoosters = "masterpiece, ultra-detailed 8k resolution, photorealistic, cinematic volumetric lighting, dynamic composition, shallow depth of field, sharp focus, pristine clarity";
    
    return `${englishPrompt}, ${qualityBoosters}`;
}

// Comprehensive dictionary and validator for clean, correctly-spelled English prompts
const ENGLISH_VALID_DICT = new Set(
    ('a,about,above,across,action,actor,adorable,after,against,age,air,alien,all,alone,along,already,also,always,am,amazing,an,ancient,and,angel,anger,angry,animal,anime,another,any,apple,architect,architecture,area,arm,armor,army,around,art,artist,artistic,as,ash,ask,assassin,asset,astronaut,at,atmosphere,atmospheric,aura,autumn,award,away,baby,back,background,bad,ball,banana,band,bar,bare,bark,battle,bay,beach,bear,beast,beautiful,beauty,become,bed,bedroom,bee,before,behind,being,believe,bench,bend,beneath,beside,best,better,between,beyond,bicycle,big,bike,biker,bird,black,blade,blaster,blaze,blazing,blind,blizzard,blood,bloom,blooming,blossom,blue,blur,blurry,board,boat,body,bokeh,bold,bomb,bone,book,boot,boss,botanical,bottle,bottom,bow,bowl,box,boy,branch,brave,bread,break,breeze,brick,bridge,bright,brilliant,broken,bronze,brother,brown,brush,bubble,build,building,bullet,bunch,burn,burning,burst,bush,business,busy,butterfly,cabin,cage,cake,calm,camera,camp,candle,candy,canyon,cape,captain,car,carbon,card,care,carnival,carpet,carriage,cartoon,case,castle,cat,catch,cathedral,cause,cave,celebration,cell,center,ceramic,chain,chair,champion,chaos,character,charge,charming,chase,cheek,cheerful,cherry,chest,chic,chicken,chief,child,children,chill,chilly,chimney,chrome,church,cinema,cinematic,circle,circuit,circular,city,cityscape,clash,classic,classical,claw,clay,clean,clear,cliff,climate,climb,cloak,clock,close,closeup,cloth,clothes,clothing,cloud,cloudy,clover,clown,club,cluster,coach,coal,coast,coat,cockpit,coffee,cold,collar,collection,colony,color,colorful,colossal,column,combat,comic,companion,composition,concept,cone,confident,constellation,construction,contemporary,contrast,cool,copper,coral,corner,corridor,cosmic,costume,cottage,cotton,couch,country,countryside,couple,courage,course,court,courtyard,cover,covered,cow,cowboy,cozy,crab,crack,craft,crane,crash,crate,crater,crazy,cream,creature,creek,crescent,crest,crimson,critical,crocodile,cross,crow,crowd,crowded,crown,crush,crystal,crystalline,cube,cubic,cup,cure,curious,curl,curly,current,curtain,curve,custom,cute,cyber,cybernetic,cyberpunk,cyborg,cyclist,cylinder,daily,damage,dance,dancer,dancing,danger,dangerous,dark,darkness,dawn,day,daylight,daytime,dazzling,dead,death,debris,decay,december,decide,deck,deep,deer,delicate,delicious,delight,dense,depth,desert,design,designer,desk,destination,destroy,detail,detailed,detective,device,devil,diamond,diffuse,diffused,digital,dignity,dim,dinosaur,direction,dirt,dirty,disco,dish,distant,distinct,distortion,dive,diver,divine,dizzy,doctor,dog,doll,dolphin,dome,domestic,door,doorway,dot,double,dove,down,dragon,dramatic,draw,drawer,drawing,dream,dreamy,dress,drift,drink,drive,driver,drone,drop,droplet,drum,dry,duck,dune,dungeon,dusk,dust,dusty,dynamic,eagle,ear,early,earth,east,eastern,easy,eccentric,echo,eclipse,edge,eerie,effect,egg,electric,electrical,electronic,element,elemental,elephant,elf,elven,embarrassed,emerald,emperor,empire,empty,enchanted,enchanting,end,endless,energy,engine,engineer,enigmatic,enormous,enthusiastic,entire,environment,epic,epoch,equator,equipment,era,erupt,escape,esoteric,essence,essential,eternal,ethereal,evening,event,ever,every,everything,evil,evolution,exact,exalted,excellent,excited,exciting,exclusive,exotic,expensive,experience,experiment,expert,explosion,explosive,exposed,expressive,exquisite,extra,extraordinary,extravagant,extreme,eye,eyebrow,eyelash,eyewear,fabric,face,facial,fact,factor,factory,fade,faint,fair,fairytale,falcon,fall,fallen,family,famous,fan,fancy,fantasy,far,farm,farmer,fascinating,fashion,fast,fat,father,fawn,fear,fearless,feather,feature,federal,fee,feed,feel,feeling,feet,female,fence,fern,ferocious,festival,festive,fever,few,fiber,field,fierce,fiery,fight,fighter,figure,figurine,file,film,final,fine,finger,fire,firefly,fireplace,firework,first,fish,fisher,fisherman,fishing,fist,fit,five,flag,flame,flare,flash,flat,flawless,flesh,flight,float,floating,flock,flood,floor,flora,floral,flour,flow,flower,flowing,fluffy,fluid,fluorescent,fly,flying,foam,focus,focused,fog,foggy,foliage,folk,food,foot,football,footpath,footprint,force,forest,forever,forge,fork,form,formal,formation,formula,fortress,fortune,forward,fountain,four,fox,fractal,frame,framed,freeze,freezing,fresh,friend,friendly,frightened,frog,front,frost,frosty,frozen,fruit,fuel,full,fume,fun,fundamental,fur,furniture,furry,furious,fusion,futuristic,galaxy,gale,gallery,game,garage,garbage,garden,gardener,gas,gate,gateway,gather,gauntlet,gaze,gazing,gear,gem,gemstone,general,generation,generator,genius,gentle,genuine,geometric,geometry,ghost,ghostly,giant,gift,gigantic,girl,glacier,gladiator,glamour,glance,glass,glaze,glimmer,glimmering,glint,glisten,glistening,glitch,glitter,glittering,global,globe,gloom,gloomy,glorious,glory,gloss,glossy,glove,glow,glowing,goal,goat,goblin,god,goddess,gold,golden,golf,good,gorgeous,gown,grace,graceful,gradient,grain,grainy,grand,grandeur,granite,grape,graphic,graphite,grass,grassland,grassy,grave,gravity,gray,grease,great,grecian,green,greenhouse,greet,grey,grid,grief,grill,grim,grin,grip,groove,ground,group,grove,grow,growth,guard,guardian,guerrilla,guest,guide,guild,guitar,gulf,gun,gunner,guy,habit,hail,hair,halo,hammer,hand,handcrafted,handle,handsome,hang,harbor,hard,harsh,harvest,hat,haunt,haunted,hazard,haze,hazy,head,headlight,headphone,heal,healing,health,heart,heat,heaven,heavy,hedge,height,helicopter,hell,helmet,help,herb,hero,heroic,hidden,high,highway,hill,hillside,hilly,historic,history,hit,hive,hockey,hold,hole,holiday,hologram,holographic,holy,home,honey,hood,hoodie,hook,horizon,horizontal,horn,horror,horse,horseman,hose,hospital,host,hot,hotel,hound,hour,house,household,hover,hovering,huge,human,humanoid,humble,humor,hunter,hunting,hurricane,hut,hybrid,hydraulic,hyper,hypercar,ice,iceberg,icy,idea,ideal,idle,idol,ignite,illuminate,illuminated,illumination,illusion,illustrate,illustration,image,imagery,imagination,immense,impact,imperial,imposing,impression,incandescent,inch,incidental,incredible,indigo,individual,industrial,industry,infant,infinite,infinity,infrared,ink,inn,inner,innocent,insect,inside,instant,instrument,insane,insignia,inspire,intense,intensity,intricate,intricacy,invasion,invent,invisible,iris,iron,ironic,iridescent,island,isolated,isometric,item,jacket,jagged,jail,jam,japanese,jar,jaw,jawline,jazz,jeans,jelly,jellyfish,jet,jewel,jewelry,journey,joy,judge,juice,jungle,jupiter,justice,keen,keep,keeper,kettle,key,keyboard,kick,kid,king,kingdom,kiss,kitchen,kite,kitten,knife,knight,knit,knitted,knot,lab,laboratory,lace,ladder,lady,lake,lamp,lantern,land,landscape,lane,lantern,laptop,large,laser,last,late,launch,lava,lavender,law,layer,layered,lazy,lead,leader,leaf,league,lean,leap,leather,legend,legendary,lens,leopard,level,lever,library,lie,life,light,lighting,lightning,lilac,lily,limb,lime,limit,line,linear,linen,lion,lip,liquid,list,little,live,lizard,load,lobby,local,lock,lodge,loft,log,logical,lonely,long,look,looking,loom,loop,lord,loss,lost,lotus,loud,lounge,love,lovely,lover,low,loyal,lucid,luck,lucky,lumber,luminous,luna,lunar,lunch,lush,luster,lustrous,luxurious,luxury,machine,machinery,macro,mad,magazine,magic,magical,magician,magma,magnificent,mail,main,majestic,major,make,maker,male,mammal,man,manage,manager,mane,manor,mansion,mantle,manual,many,map,maple,marble,march,marine,mark,marker,market,mars,marsh,mask,masked,masonry,mass,massive,master,masterpiece,match,material,matrix,matter,meadow,meal,mean,meaning,measure,meat,mechanic,mechanical,mechanism,mech,mecha,medal,medieval,medium,meet,mega,melody,melt,melting,member,memory,men,metal,metallic,meteor,meteorite,meter,method,metro,metropolis,metropolitan,midnight,mighty,mile,military,milk,mill,mimic,mind,mine,mineral,mini,miniature,minimal,minimalist,mining,minister,mint,minute,miracle,mirror,mischief,misery,miss,missile,mist,misty,mix,mixed,moat,mobile,model,modern,modest,moisture,molecular,molecule,moment,monarch,monastery,monk,monkey,monolith,monolithic,monster,monstrous,monument,monumental,mood,moody,moon,moonlight,moonlit,moor,morning,morph,mosaic,moss,mossy,moth,mother,motion,motor,motorcycle,mound,mountain,mountainous,mountainside,mouse,mouth,move,movement,movie,mud,muddy,muffler,mug,multi,multiverse,mural,muscle,muscular,museum,music,musical,musician,mutant,mysterious,mystery,mystic,mystical,myth,mythic,mythical,mythology,nail,naive,naked,name,narrow,nation,native,natural,nature,naval,navigate,nebula,neck,necklace,needle,neon,nerve,nest,net,network,neutral,new,news,nexus,nice,night,nightfall,nightmare,ninja,noble,noise,nomad,noon,north,northern,nose,nostalgia,nostalgic,note,nova,novel,nuclear,nucleus,nude,number,numeral,nurse,nut,nylon,oak,oasis,object,obelisk,obscure,observation,observatory,obsidian,obvious,ocean,oceanic,octane,odd,off,office,officer,official,oil,old,olive,olympic,omega,on,once,one,ongoing,online,only,onyx,open,opera,operate,operation,operator,opinion,optic,optical,optimistic,option,orange,orbit,orbital,orchard,orchestra,order,ordinary,ore,organic,organism,origin,original,ornament,ornate,orphan,other,outdoor,outdoors,outer,outfit,outline,outpost,outside,over,overall,overcast,overhead,overlook,overwhelming,owl,owner,oxygen,oyster,pace,pack,package,pad,page,paint,painted,painter,painting,pair,palace,pale,palette,palm,pan,panel,panic,panoramic,panther,paper,parade,paradise,parallel,parchment,park,parking,parliament,parrot,part,particle,particular,partisan,party,passage,passenger,passion,passionate,passive,past,pastel,pasture,pat,patch,path,pathway,patient,patio,patrol,pattern,pause,pavement,pavilion,paw,peace,peaceful,peak,pearl,peasant,pebble,peculiar,pedal,pedestrian,peek,peel,peer,pegasus,pen,pencil,pendant,pendulum,penetrate,penguin,peninsula,pennant,people,pepper,perfect,perfection,perform,performance,performer,perfume,peril,period,periphery,periscope,permanent,perpendicular,perpetual,perplexed,persist,person,personal,perspective,petal,phantom,phase,phenomenon,philosophy,phoenix,photo,photograph,photographer,photographic,photography,photorealistic,physical,physique,piano,pick,picnic,picture,picturesque,piece,pier,pierce,piercing,pig,pigeon,pile,pilgrim,pillar,pilot,pin,pine,pink,pinnacle,pioneer,pipe,pirate,pistol,pit,pitch,pixel,place,plague,plain,plan,plane,planet,planetary,plank,plant,plantation,plaque,plasma,plaster,plastic,plate,plateau,platform,play,player,playful,plaza,pleasure,plenty,plot,plow,plug,plum,plume,plush,pocket,pod,poem,poet,poetry,point,pointed,poison,polar,pole,police,polish,polished,pollen,polygon,pond,pool,poor,pop,popular,porcelain,porch,port,portal,portion,portrait,pose,position,positive,post,posture,pot,potato,potion,pouch,powder,power,powerful,powerhouse,practical,prairie,praise,precious,precise,precision,predator,predict,premium,presence,present,preserve,president,press,pressure,prestige,pretty,previous,prey,price,pride,priest,primal,primary,prime,primitive,prince,princess,print,prism,prismatic,prison,pristine,private,prize,probe,problem,procedure,process,procession,proclaim,produce,product,profile,profound,program,progress,project,projection,promenade,prominent,promise,prong,proof,propeller,proper,property,prophet,proportion,prospect,protect,protector,protocol,proud,prove,proverb,provide,province,provoke,prowl,prowler,prune,pulse,pulsing,pump,pumpkin,punch,punctual,punish,pupil,puppet,puppy,pure,purple,purpose,pursue,pyramid,quaint,quake,quality,quarry,quarter,quartz,queen,quench,quest,quick,quiet,quilt,quiver,rabbit,race,racer,racing,radar,radiance,radiant,radiation,radiator,radical,radio,radius,raft,rafter,rail,railroad,railway,rain,rainbow,rainfall,rainforest,rainy,raise,rally,ram,ramp,rampart,ranch,random,range,ranger,rank,rapid,raptor,rare,rash,rate,ratio,rattle,raven,ravine,raw,ray,raytrace,raytraced,razor,reach,reaction,reactor,read,ready,real,realistic,reality,realm,rear,rebel,rebellion,receipt,receive,recess,recipe,reclaim,reclining,recognize,recoil,record,recover,recruit,rectangle,red,reddish,reed,reef,reel,refine,refined,reflect,reflection,reflective,refract,refuge,regal,region,reign,rein,reindeer,reject,rejoice,relate,relation,relax,relay,release,relic,relief,religion,rely,remain,remark,remarkable,remedy,remember,remnant,remote,render,rendering,renew,renovated,renown,rent,repair,repeat,repel,replica,reply,report,represent,reptile,republic,rescue,research,resemble,reservoir,reset,residence,resident,residual,resin,resist,resolute,resolution,resolve,resort,resound,resource,respect,resplendent,response,rest,restaurant,restless,restore,result,retail,retain,retreat,retrieve,retro,return,reunion,reveal,revel,revenge,revenue,revere,reverse,review,revive,revolution,reward,rhythm,ribbon,rice,rich,rider,ridge,rifle,rift,right,rim,ring,riot,ripple,rise,rising,risk,ritual,rival,river,riverside,rivet,road,roadside,roar,roast,robe,robot,robotic,rock,rocket,rocky,rod,rogue,roll,roller,romance,romantic,roof,rooftop,room,rooster,root,rope,rose,rosette,rot,rotate,rotor,rough,round,route,rover,row,royal,rub,rubber,ruby,rudder,ruin,ruined,ruins,rule,ruler,rumble,run,runner,running,rural,rush,rust,rustic,rusty,saber,sable,sacred,sad,saddle,safari,safe,safety,saga,sail,sailor,saint,salad,salary,sale,saloon,salt,salute,salvation,same,sample,sand,sandal,sandstone,sandy,sapphire,sarcophagus,sash,satellite,satin,satisfy,sauce,saucer,savage,save,savanna,savior,scale,scaled,scalpel,scan,scanner,scar,scarce,scare,scarf,scarlet,scatter,scene,scenery,scenic,scent,scepter,schedule,scheme,scholar,school,science,scientific,scientist,scissors,scoot,scope,scorch,score,scorn,scorpion,scout,scramble,scrap,scrape,scratch,scream,screen,screw,scroll,sculpt,sculptor,sculpture,sea,seagull,seal,seam,search,seashell,seashore,season,seat,second,secret,section,sector,secular,secure,security,sediment,see,seed,seek,seeker,seep,segment,seize,select,self,sell,semaphore,semester,senate,send,senior,sense,sensor,sensory,sentiment,sentinel,separate,sepia,sequence,seraph,serene,serenity,series,serpent,servant,serve,server,service,session,set,setting,settle,settlement,seven,severe,sew,shade,shadow,shadowy,shaft,shaggy,shake,shallow,shaman,shame,shape,shard,share,shark,sharp,shatter,she,sheath,shed,sheep,sheet,shelf,shell,shelter,shield,shift,shimmer,shimmering,shine,shining,shiny,ship,shipwreck,shirt,shock,shoe,shoot,shooter,shop,shore,short,shot,shoulder,shout,shove,show,shower,shred,shrine,shrink,shroud,shrub,shudder,shut,shutter,sibling,sick,side,sidewalk,siege,sierra,sigh,sight,signal,signature,signet,silence,silent,silhouette,silk,silken,silky,silver,similar,simple,simplicity,sin,sincere,sing,single,sink,siren,sister,sit,site,sitting,situation,six,size,skate,skeleton,skeptical,sketch,ski,skill,skin,skirt,skull,sky,skylight,skyline,skyscraper,slab,slack,slanted,slate,sleek,sleep,sleepy,sleeve,slender,slice,slide,slime,sling,slip,slit,slope,slot,slow,slumber,small,smart,smash,smell,smile,smiling,smoke,smoky,smooth,smuggle,snake,snap,snarl,sneaker,snow,snowball,snowflake,snowy,soak,soap,soar,sober,social,socket,soft,softness,soil,solar,soldier,sole,solemn,solid,solitary,solitude,solo,somber,some,somebody,someday,someone,something,somewhere,son,song,sonic,soon,soot,sorcerer,sorcery,sore,sorrow,soul,sound,source,south,southern,sovereign,space,spacecraft,spaceship,spacesuit,spacious,span,spark,sparkle,sparkling,sparrow,spatial,spawn,speak,speaker,spear,special,species,specific,specimen,speck,spectacle,spectacular,specter,spectrum,speed,spell,sphere,spherical,spice,spider,spike,spiky,spill,spin,spine,spiral,spire,spirit,spiritual,splash,splendid,splendor,split,spoke,sponge,sponsor,spontaneous,spooky,spoon,sport,spot,spout,spray,spread,spring,sprinkle,sprint,sprout,spur,spy,squad,square,squash,squat,squeak,squeeze,squid,stadium,staff,stage,stain,stainless,stair,staircase,stake,stalk,stall,stamp,stance,stand,standard,standing,star,stare,staring,starlight,starry,start,startle,statue,steam,steampunk,steel,steep,steer,stem,step,stereo,stern,stew,stick,sticky,stiff,still,stimulate,sting,stir,stitch,stock,stone,stony,stool,stop,storage,store,storm,stormy,story,stout,stove,straight,strain,strand,strange,stranger,strap,stratosphere,straw,stream,street,strength,stress,stretch,strict,strike,string,strip,stripe,striped,stroke,strong,structure,struggle,student,studio,study,stuff,stumble,stun,stunning,sturdy,style,stylish,sublime,submarine,subtle,suburb,subway,success,succulent,sudden,sugar,suit,suite,sulfur,summer,summit,sun,sunbeam,sunburst,sunflower,sunglasses,sunlight,sunny,sunrise,sunset,sunshine,super,supercar,superhero,superior,supernova,supper,supply,support,supreme,surface,surge,surgeon,surreal,surround,survey,survive,suspense,swamp,swan,swarm,sway,swear,sweat,sweater,sweep,sweet,swell,swift,swim,swimmer,swimming,swing,swirl,swirling,switch,sword,swordsman,symbol,symmetry,symphony,synthetic,system,table,tablet,tactical,tail,talented,tale,tall,tame,tank,tan,tap,tapestry,target,tariff,taste,tasty,tavern,tea,teacher,team,tear,tech,technical,technique,technology,teddy,tee,teeth,telescope,tell,temper,temperature,temple,temporal,ten,tender,tent,tentacle,terminal,terra,terrace,terrain,terrarium,terrestrial,territory,terror,test,texture,textured,theater,theme,theory,thermal,thick,thief,thigh,thin,thing,think,third,thirst,thirteen,thirty,thorn,thought,thousand,thread,threat,three,threshold,thrill,throne,through,throw,thrust,thumb,thunder,thunderstorm,tide,tidy,tie,tiger,tight,tile,tilted,timber,time,timeless,timid,tin,tint,tiny,tip,tire,titan,titanium,title,toad,toast,today,toe,together,token,toll,tomato,tomb,tone,tongue,tool,tooth,top,topaz,topic,torch,tornado,torpedo,torrent,torso,total,touch,tough,tour,tourism,tourist,tournament,toward,towel,tower,town,toxic,trace,track,tractor,trade,tradition,traditional,traffic,trail,trailer,train,traitor,tramp,trance,tranquil,transfer,transform,transit,transmit,transparent,transport,trap,trash,travel,traveler,treasure,treat,treaty,tree,tremble,trench,trend,triangle,tribal,tribe,tribute,trick,trigger,trim,trip,triple,triumph,troop,trophy,tropical,trouble,trough,trousers,truck,true,trumpet,trunk,trust,truth,try,tsunami,tub,tube,tulip,tumble,tundra,tune,tunnel,turbine,turbo,turbulent,turf,turkey,turn,turret,turtle,tusk,tutor,twelve,twenty,twig,twilight,twin,twinkle,twist,twisted,two,type,typhoon,typical,tyrant,ugly,ultimate,ultra,ultraviolet,umbrella,umpire,unbroken,unreal,under,underground,underwater,uniform,unique,universe,universal,unknown,unseen,unusual,up,upon,upper,uprising,uproar,upset,uranium,urban,urge,urn,use,user,usher,usual,utility,utopia,utter,vacant,vacuum,vagrant,vague,vail,valiant,valid,valley,valuable,value,valve,vampire,van,vanguard,vanilla,vanish,vapor,variable,varnish,vary,vase,vast,vault,vector,veil,vein,velocity,velvet,venom,venture,venue,venus,veranda,verdict,verge,vermilion,verse,version,versus,vertical,vessel,vest,veteran,vibrant,vibration,vicar,vicious,victim,victory,video,view,viewer,vigil,vigor,viking,vile,village,villager,villain,vine,vineyard,vintage,vinyl,viola,violent,violet,violin,viper,viral,virtual,virtue,visible,vision,visionary,visit,visitor,visual,vital,vivid,vixen,vocal,voice,volcano,volcanic,volleyball,volt,voltage,volume,voluntary,volunteer,vortex,vote,vow,vowel,voyage,vulture,wade,wafer,waffle,waft,wage,wagon,waist,wait,waiter,wake,walk,walker,walking,wall,wallet,walnut,walrus,wander,wanderer,want,war,ward,wardrobe,warehouse,warfare,warm,warmth,warn,warning,warp,warrior,wary,wash,waste,watch,watcher,water,waterfall,waterfront,watershed,wave,wavy,wax,way,weak,wealth,weapon,wear,weary,weather,weave,weaver,web,wedding,wedge,weed,week,weep,weigh,weight,welcome,weld,welfare,well,west,western,wet,whale,wharf,wheat,wheel,whim,whip,whirl,whirlpool,whirlwind,whisper,whistle,white,whole,wicked,wide,widow,width,wield,wife,wild,wilderness,wildfire,wildlife,will,willow,win,wind,winding,windmill,window,wine,wing,winged,wink,winner,winter,wire,wisdom,wise,wish,witch,witchcraft,wither,wizard,wolf,woman,womb,wonder,wonderful,wood,wooden,woodland,woods,wool,woolen,word,work,worker,workshop,world,worm,worry,worship,worth,worthy,wound,wrap,wrapper,wrath,wreath,wreck,wrestle,wrist,write,writer,wrong,yacht,yard,yarn,yawn,year,yearn,yeast,yellow,yield,yoga,yoke,yolk,young,youth,zenith,zephyr,zero,zest,zigzag,zinc,zone,zoo,zoology' +
    ',a,an,the,in,on,at,to,for,with,by,from,of,as,into,onto,upon,over,under,above,below,between,through,during,before,after,around,along,behind,beyond,about,against,and,or,but,nor,so,yet,if,because,although,while,where,when,how,what,which,who,whom,whose,why,i,you,he,she,it,we,they,me,him,her,us,them,my,your,his,its,our,their,mine,yours,hers,ours,theirs,this,that,these,those,is,am,are,was,were,be,been,being,have,has,had,do,does,did,will,would,shall,should,can,could,may,might,must').split(',')
);

function isValidEnglishWord(w) {
    if (!w || w.length === 0) return false;
    if (/^\d+$/.test(w)) return true;
    if (ENGLISH_VALID_DICT.has(w)) return true;
    // Common English suffixes and grammatical stems
    if (w.endsWith('s') && ENGLISH_VALID_DICT.has(w.slice(0, -1))) return true;
    if (w.endsWith('es') && ENGLISH_VALID_DICT.has(w.slice(0, -2))) return true;
    if (w.endsWith('ed') && (ENGLISH_VALID_DICT.has(w.slice(0, -2)) || ENGLISH_VALID_DICT.has(w.slice(0, -1)))) return true;
    if (w.endsWith('ing') && (ENGLISH_VALID_DICT.has(w.slice(0, -3)) || ENGLISH_VALID_DICT.has(w.slice(0, -3) + 'e') || ENGLISH_VALID_DICT.has(w.slice(0, -4)))) return true;
    if (w.endsWith('ly') && (ENGLISH_VALID_DICT.has(w.slice(0, -2)) || ENGLISH_VALID_DICT.has(w.slice(0, -2) + 'e'))) return true;
    if (w.endsWith('er') && (ENGLISH_VALID_DICT.has(w.slice(0, -2)) || ENGLISH_VALID_DICT.has(w.slice(0, -1)))) return true;
    if (w.endsWith('est') && (ENGLISH_VALID_DICT.has(w.slice(0, -3)) || ENGLISH_VALID_DICT.has(w.slice(0, -2)))) return true;
    return false;
}

function isCleanEnglishPrompt(text) {
    if (!text || !text.trim()) return false;
    // Must not contain any Bengali script characters
    if (/[\u0980-\u09ff]/.test(text)) return false;
    
    // Extract words
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (words.length === 0) return false;
    
    // Reject common Banglish words
    const BANGLISH_MARKERS = new Set([
        'ekta', 'ekti', 'akta', 'duita', 'biral', 'bilai', 'kukur', 'kutta', 'pakhi', 'bagh', 'shingho', 'singho',
        'hathi', 'ghora', 'gari', 'gaari', 'nouka', 'mach', 'ful', 'golap', 'gach', 'pata', 'banao', 'banau',
        'toiri', 'koro', 'akash', 'megh', 'bristi', 'chand', 'surjo', 'nodi', 'pahar', 'sundor', 'shundor',
        'choto', 'boro', 'lal', 'kalo', 'sada', 'shada', 'sobuj', 'neel', 'nil', 'holud', 'boshe', 'darie',
        'urche', 'douracche', 'meye', 'chele', 'baccha', 'shishu', 'rasta', 'gram', 'shohor', 'dekhaw', 'dekhao', 'dao'
    ]);
    if (words.some(w => BANGLISH_MARKERS.has(w))) return false;
    
    // Check every word against English dictionary
    return words.every(isValidEnglishWord);
}

// Search Google Sheet (offline cached + synced) for similar past image prompts
function findCachedImagePrompt(rawUserPrompt) {
    if (!rawUserPrompt || !rawUserPrompt.trim()) return null;
    const cleanUserQuery = rawUserPrompt.trim();
    
    const candidateRecords = [];
    
    // 1. Check in runtime database (contains embedded + synced Google Sheet data)
    database.forEach(item => {
        const qLower = (item.q || "").toLowerCase().trim();
        if (qLower.includes('[img_prompt]') || qLower.includes('[img')) {
            const rawQ = (item.q || "").replace(/\[img_prompt\]/i, '').replace(/\[img\]/i, '').trim();
            const rawA = (item.a || "").replace(/\[img_expanded\]/i, '').replace(/\[img\]/i, '').trim();
            if (rawQ && rawA) {
                candidateRecords.push({ userPrompt: rawQ, expandedPrompt: rawA });
            }
        }
    });
    
    // 2. Check in localStorage cached Google Sheet data
    try {
        const cached = getCachedGoogleSheetData();
        cached.forEach(item => {
            const qStr = (item.question || item.q || "").toString();
            const aStr = (item.answer || item.a || "").toString();
            if (qStr.toLowerCase().includes('[img_prompt]') || qStr.toLowerCase().includes('[img')) {
                const rawQ = qStr.replace(/\[img_prompt\]/i, '').replace(/\[img\]/i, '').trim();
                const rawA = aStr.replace(/\[img_expanded\]/i, '').replace(/\[img\]/i, '').trim();
                if (rawQ && rawA) {
                    const exists = candidateRecords.some(c => c.userPrompt.toLowerCase() === rawQ.toLowerCase());
                    if (!exists) {
                        candidateRecords.push({ userPrompt: rawQ, expandedPrompt: rawA });
                    }
                }
            }
        });
    } catch (e) {}
    
    if (candidateRecords.length === 0) return null;
    
    let bestMatch = null;
    let highestScore = 0;
    
    for (const record of candidateRecords) {
        // Compare current user prompt against both the stored user prompt AND the stored expanded prompt
        const scoreUser = calculateMatchScore(cleanUserQuery, record.userPrompt);
        const scoreExpanded = calculateMatchScore(cleanUserQuery, record.expandedPrompt);
        const score = Math.max(scoreUser, scoreExpanded);
        
        // Exact match
        if (cleanUserQuery.toLowerCase() === record.userPrompt.toLowerCase()) {
            console.log(`[Shepu Image Cache] Exact match in Google Sheet for "${cleanUserQuery}" -> "${record.expandedPrompt}"`);
            return record.expandedPrompt;
        }
        
        if (score > highestScore) {
            highestScore = score;
            bestMatch = record.expandedPrompt;
        }
    }
    
    // If high match found (>= 0.65 similarity), reuse the cached expanded prompt
    if (highestScore >= 0.65 && bestMatch) {
        console.log(`[Shepu Image Cache] High similarity match (${(highestScore * 100).toFixed(1)}%) in Google Sheet: "${bestMatch}"`);
        return bestMatch;
    }
    
    return null;
}

// Expand image prompt using Gemini API and save pair to Google Sheet
async function expandImagePromptWithGemini(rawPrompt) {
    const apiKey = typeof ShepuAPI !== 'undefined' ? ShepuAPI.getActiveKey() : "";
    if (!apiKey) {
        console.warn("[Shepu Image Gemini] No Gemini API key available, using local engine.");
        return await enhancePromptLocally(rawPrompt);
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const systemPrompt = `You are an expert AI prompt engineer for FLUX image diffusion model.
The user requested an image: "${rawPrompt}". It may be in Bengali, Banglish, or English.
Transform this request into a vivid, descriptive English prompt for FLUX.
STRICT RULES:
1. Stay 100% faithful to user's desired subject, atmosphere, colors, lighting, and composition. Do not hallucinate random unrelated subjects.
2. Output ONLY the descriptive English prompt text. Do NOT include markdown, explanations, conversational text, or quotation marks.
3. Keep it within 35 to 65 words.`;

    const payload = {
        contents: [{
            role: 'user',
            parts: [{ text: systemPrompt }]
        }]
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                let expanded = data.candidates[0].content.parts[0].text.trim();
                expanded = expanded.replace(/^["'“`]+|["'”`]+$/g, '').trim();
                if (expanded.length > 5) {
                    console.log("[Shepu Image Gemini] Generated expanded prompt:", expanded);
                    
                    // Save to Google Sheet with special image prefixes so normal chat lines are never contaminated
                    const sheetQuestion = `[IMG_PROMPT] ${rawPrompt}`;
                    const sheetAnswer = `[IMG_EXPANDED] ${expanded}`;
                    saveToGoogleSheet(sheetQuestion, sheetAnswer);
                    
                    // Immediately cache locally in memory database & localStorage
                    database.push({
                        q: sheetQuestion.toLowerCase().trim(),
                        a: sheetAnswer
                    });
                    try {
                        let cached = getCachedGoogleSheetData();
                        cached.push({ question: sheetQuestion, answer: sheetAnswer });
                        localStorage.setItem(LOCAL_STORAGE_GSHEET_KEY, JSON.stringify(cached));
                    } catch (e) {}
                    
                    return expanded;
                }
            }
        }
    } catch (e) {
        console.warn("[Shepu Image Gemini] Gemini request failed or timed out. Falling back to local engine:", e);
        if (typeof ShepuAPI !== 'undefined') {
            ShepuAPI.rotateKey();
        }
    }
    
    // Fallback to local translation + enhancement if Gemini fails
    return await enhancePromptLocally(rawPrompt);
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function handleImageGenerationRequest(userText, existingEnhanced = null) {
    isBotAnswering = true;
    clearIdleTimers();

    const rawPrompt = extractImagePrompt(userText) || userText;
    const cardId = 'gen-card-' + Date.now();
    
    const div = document.createElement('div');
    div.className = 'msg bot';
    const botAvatar = document.body.classList.contains('hacking-mode') ? 'app/assets/hai.ico' : 'app/assets/upai.png';
    const escapedRawPrompt = escapeHtml(rawPrompt);
    
    div.innerHTML = `
        <div class="avatar">
            <img src="${botAvatar}" alt="AI" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\\'fas fa-robot\\'></i>'">
        </div>
        <div class="msg-content">
            <div class="image-generating-card" id="${cardId}">
                <div class="gen-preview-skeleton">
                    <div class="gen-skeleton-shimmer"></div>
                    <div class="gen-skeleton-center">
                        <div class="gen-spinner-ring"></div>
                        <i class="fas fa-wand-magic-sparkles gen-sparkle-icon"></i>
                    </div>
                </div>
                <div class="gen-info-box">
                    <div class="gen-status-row">
                        <span class="gen-status-text" id="${cardId}-stage">
                            <i class="fas fa-circle-notch fa-spin"></i> প্রম্পট প্রস্তুত হচ্ছে...
                        </span>
                        <span class="gen-badge">Shepu-AI(SSv1.0)</span>
                    </div>
                    <div class="gen-prompt-text">"${escapedRawPrompt}"</div>
                    <div class="gen-progress-track">
                        <div class="gen-progress-bar"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    chatContainer.appendChild(div);
    scrollToBottom(true);
    
    let enhancedPrompt = existingEnhanced;
    if (!enhancedPrompt) {
        // Priority 1: If user wrote in English and all words are correctly spelled, DO NOT use Gemini!
        if (isCleanEnglishPrompt(rawPrompt)) {
            console.log("[Shepu Image] User provided clean English prompt with correct spelling. Skipping Gemini API entirely:", rawPrompt);
            enhancedPrompt = rawPrompt;
        } else {
            // Priority 2: Check Google Sheet cache for exact or close similarity match (0 Gemini API cost)
            const cachedMatch = findCachedImagePrompt(rawPrompt);
            if (cachedMatch) {
                console.log("[Shepu Image] Using cached expanded prompt from Google Sheet:", cachedMatch);
                enhancedPrompt = cachedMatch;
            } else {
                // Priority 3: No sheet match found and needs translation/expansion -> call Gemini API and auto-save to Google Sheet!
                console.log("[Shepu Image] Calling Gemini API to expand prompt and save to Google Sheet...");
                enhancedPrompt = await expandImagePromptWithGemini(rawPrompt);
            }
        }
    }
    
    if (!enhancedPrompt.includes('masterpiece') && !enhancedPrompt.includes('8k')) {
        enhancedPrompt += ", masterpiece, ultra-detailed 8k resolution, cinematic lighting, photorealistic, sharp focus";
    }
    
    // Update stage text to generating
    const stageElem = document.getElementById(`${cardId}-stage`);
    if (stageElem) {
        stageElem.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> ছবি তৈরি হচ্ছে...';
    }
    
    const seed = Math.floor(Math.random() * 100000000);
    // Primary FLUX model URL
    const primaryUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?model=flux&width=1024&height=1024&nologo=true&seed=${seed}`;
    // Fallback Turbo model URL (instant rendering if public FLUX GPU cluster is overloaded)
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?model=turbo&width=1024&height=1024&nologo=true&seed=${seed}`;
    
    console.log("[Shepu Image] Fetching Shepu-AI(SSv1.0) image with prompt:", enhancedPrompt);
    console.log("[Shepu Image] Primary Endpoint URL:", primaryUrl);

    let activeUrl = primaryUrl;
    let hasAttemptedFallback = false;

    function renderSuccess(finalUrl) {
        const cardElem = document.getElementById(cardId);
        if (cardElem) {
            const contentDiv = cardElem.closest('.msg-content');
            if (contentDiv) {
                const escapedSafeRaw = escapedRawPrompt.replace(/'/g, "\\'");
                const escapedEnhanced = escapeHtml(enhancedPrompt);
                const escapedSafeEnhanced = escapedEnhanced.replace(/'/g, "\\'");
                contentDiv.innerHTML = `
                    <div class="flux-image-card">
                        <div class="image-card-preview" onclick="openImageLightbox('${finalUrl}', '${escapedSafeRaw}')">
                            <img src="${finalUrl}" alt="${escapedRawPrompt}" />
                            <div class="image-hover-overlay">
                                <span class="image-zoom-hint"><i class="fas fa-expand"></i> বড় করে দেখতে ক্লিক করুন</span>
                            </div>
                            <div class="image-watermark">Shepu-AI</div>
                        </div>
                        <div class="image-card-footer">
                            <div class="image-card-info">
                                <div class="image-prompt-text">${escapedRawPrompt}</div>
                                <span class="image-badge">Shepu-AI(SSv1.0) • 1024×1024 HD</span>
                            </div>
                            <div class="image-actions-row">
                                <button class="image-action-btn primary" onclick="downloadGeneratedImage('${finalUrl}', '${escapedSafeRaw}')">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                <button class="image-action-btn secondary" onclick="openImageLightbox('${finalUrl}', '${escapedSafeRaw}')" title="Fullscreen">
                                    <i class="fas fa-expand"></i>
                                </button>
                                <button class="image-action-btn secondary" onclick="regenerateFluxImage('${escapedSafeRaw}', '${escapedSafeEnhanced}')" title="Regenerate">
                                    <i class="fas fa-redo-alt"></i>
                                </button>
                                <button class="image-action-btn secondary" onclick="copyPromptText('${escapedSafeEnhanced || escapedSafeRaw}')" title="Copy Prompt">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        saveMessageToConversation('bot', rawPrompt, { type: 'image', imageUrl: finalUrl, prompt: rawPrompt, enhancedPrompt: enhancedPrompt });
        addToChatHistory('bot', `[Generated Image: ${rawPrompt}]`);
        // NOTE: We do NOT disableImageMode() here! Image mode stays active until user switches back.
        isBotAnswering = false;
        resetIdleTimer();
        scrollToBottom(true);
    }

    const img = new Image();
    img.src = activeUrl;

    img.onload = () => {
        renderSuccess(activeUrl);
    };

    img.onerror = () => {
        // If primary FLUX failed due to public server timeout/congestion, try Turbo fallback automatically!
        if (!hasAttemptedFallback) {
            console.warn("[Shepu Image] Primary FLUX endpoint failed or timed out. Switching to Turbo fallback endpoint...");
            hasAttemptedFallback = true;
            activeUrl = fallbackUrl;
            img.src = activeUrl;
            return;
        }

        // If both failed, display clean retry UI
        const cardElem = document.getElementById(cardId);
        if (cardElem) {
            const contentDiv = cardElem.closest('.msg-content');
            if (contentDiv) {
                contentDiv.innerHTML = `
                    <div style="padding: 14px; background: rgba(255, 68, 68, 0.1); border: 1px solid rgba(255, 68, 68, 0.2); border-radius: 12px; color: #ff6b6b;">
                        <p><strong><i class="fas fa-exclamation-triangle"></i> ইমেজ সার্ভার সাময়িক ব্যস্ত!</strong></p>
                        <p style="font-size: 13px; margin: 6px 0;">পাবলিক সার্ভার কনজেশনের কারণে লোড হতে পারেনি। নিচের বাটনে ক্লিক করে আবার চেষ্টা করুন।</p>
                        <button class="image-action-btn primary" onclick="regenerateFluxImage('${escapedRawPrompt.replace(/'/g, "\\'")}', '${escapeHtml(enhancedPrompt).replace(/'/g, "\\'")}')">
                            <i class="fas fa-redo-alt"></i> আবার চেষ্টা করুন
                        </button>
                    </div>
                `;
            }
        }
        // NOTE: Do NOT disableImageMode() on error either
        isBotAnswering = false;
        resetIdleTimer();
    };
}

function renderFluxImageCard(imageUrl, rawPrompt, enhancedPrompt = '', animate = false) {
    const div = document.createElement('div');
    div.className = 'msg bot';
    const botAvatar = document.body.classList.contains('hacking-mode') ? 'app/assets/hai.ico' : 'app/assets/upai.png';
    const escapedPrompt = escapeHtml(rawPrompt);
    const escapedSafePrompt = escapedPrompt.replace(/'/g, "\\'");
    const escapedEnhanced = escapeHtml(enhancedPrompt);
    const escapedSafeEnhanced = escapedEnhanced.replace(/'/g, "\\'");

    div.innerHTML = `
        <div class="avatar">
            <img src="${botAvatar}" alt="AI" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\\'fas fa-robot\\'></i>'">
        </div>
        <div class="msg-content">
            <div class="flux-image-card">
                <div class="image-card-preview" onclick="openImageLightbox('${imageUrl}', '${escapedSafePrompt}')">
                    <img src="${imageUrl}" alt="${escapedPrompt}" loading="lazy" />
                    <div class="image-hover-overlay">
                        <span class="image-zoom-hint"><i class="fas fa-expand"></i> বড় করে দেখতে ক্লিক করুন</span>
                    </div>
                    <div class="image-watermark">Shepu-AI</div>
                </div>
                <div class="image-card-footer">
                    <div class="image-card-info">
                        <div class="image-prompt-text">${escapedPrompt}</div>
                        <span class="image-badge">Shepu-AI(SSv1.0) • 1024×1024 HD</span>
                    </div>
                    <div class="image-actions-row">
                        <button class="image-action-btn primary" onclick="downloadGeneratedImage('${imageUrl}', '${escapedSafePrompt}')">
                            <i class="fas fa-download"></i> Download
                        </button>
                        <button class="image-action-btn secondary" onclick="openImageLightbox('${imageUrl}', '${escapedSafePrompt}')" title="Fullscreen">
                            <i class="fas fa-expand"></i>
                        </button>
                        <button class="image-action-btn secondary" onclick="regenerateFluxImage('${escapedSafePrompt}', '${escapedSafeEnhanced}')" title="Regenerate">
                            <i class="fas fa-redo-alt"></i>
                        </button>
                        <button class="image-action-btn secondary" onclick="copyPromptText('${escapedSafeEnhanced || escapedSafePrompt}')" title="Copy Prompt">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    chatContainer.appendChild(div);
}

function toggleEnhancedPrompt(toggleBtn) {
    const box = toggleBtn.nextElementSibling;
    const arrow = toggleBtn.querySelector('.fa-chevron-down, .fa-chevron-up');
    if (!box) return;
    if (box.style.display === 'block') {
        box.style.display = 'none';
        if (arrow) arrow.className = 'fas fa-chevron-down';
    } else {
        box.style.display = 'block';
        if (arrow) arrow.className = 'fas fa-chevron-up';
    }
}

function copyPromptText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    }
    showToast('প্রম্পট কপি করা হয়েছে! 📋', 'fa-copy');
}

async function regenerateFluxImage(originalPrompt, enhancedPrompt) {
    showToast('নতুন ভ্যারিয়েন্ট তৈরি হচ্ছে... ⚡', 'fa-redo-alt');
    await handleImageGenerationRequest(originalPrompt, enhancedPrompt);
}

async function downloadGeneratedImage(url, promptName) {
    showToast('ইমেজ ডাউনলোড শুরু হচ্ছে... 📥', 'fa-download');
    try {
        const cleanName = (promptName || 'shepu-ai')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 30);
        const fileName = `shepu-ai-${cleanName || 'image'}-${Date.now()}.jpg`;

        let blobToDownload = null;
        try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            await new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = url;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || 1024;
            canvas.height = img.naturalHeight || 1024;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // Stamp subtle watermark "Shepu-AI" at bottom right
            const fontSize = Math.max(16, Math.floor(canvas.width * 0.022));
            ctx.font = `600 ${fontSize}px sans-serif`;
            const text = "Shepu-AI";
            const textMetrics = ctx.measureText(text);
            const padX = fontSize * 0.65;
            const padY = fontSize * 0.35;
            const boxW = textMetrics.width + padX * 2;
            const boxH = fontSize + padY * 2;
            const margin = Math.floor(canvas.width * 0.022);
            const boxX = canvas.width - boxW - margin;
            const boxY = canvas.height - boxH - margin;

            ctx.save();
            ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(boxX, boxY, boxW, boxH, 8);
                ctx.fill();
            } else {
                ctx.fillRect(boxX, boxY, boxW, boxH);
            }
            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.textBaseline = "middle";
            ctx.fillText(text, boxX + padX, boxY + boxH / 2);
            ctx.restore();

            blobToDownload = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
        } catch (canvasErr) {
            console.warn("[Shepu Image] Canvas watermarking skipped, falling back to direct blob:", canvasErr);
            const res = await fetch(url);
            if (!res.ok) throw new Error("Fetch response not ok: " + res.status);
            blobToDownload = await res.blob();
        }

        const blobUrl = URL.createObjectURL(blobToDownload);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 40000);
        showToast('ইমেজ সফলভাবে ডাউনলোড হয়েছে! ✅', 'fa-check-circle');
    } catch (err) {
        console.warn("[Shepu Image] Blob download failed, falling back to direct link:", err);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = `shepu-ai-${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('ইমেজ ওপেন করা হয়েছে, সেভ করে নিন! 🖼️', 'fa-image');
    }
}

function openImageLightbox(url, promptText) {
    currentLightboxUrl = url;
    currentLightboxPrompt = promptText || '';
    const modal = document.getElementById('imageLightboxModal');
    const img = document.getElementById('lightboxImg');
    const promptDiv = document.getElementById('lightboxPrompt');
    const dlBtn = document.getElementById('lightboxDownloadBtn');
    
    if (img) img.src = url;
    if (promptDiv) promptDiv.innerText = currentLightboxPrompt ? `Prompt: ${currentLightboxPrompt}` : '';
    if (dlBtn) {
        dlBtn.onclick = () => downloadGeneratedImage(currentLightboxUrl, currentLightboxPrompt);
    }
    if (modal) {
        modal.classList.add('active');
    }
}

function closeImageLightbox(e) {
    if (e && e.target && e.target.id !== 'imageLightboxModal' && !e.target.closest('.lightbox-btn')) {
        return;
    }
    const modal = document.getElementById('imageLightboxModal');
    if (modal) modal.classList.remove('active');
}

function clearHistory() {
    const modal = document.getElementById('customModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (!modal || !confirmBtn) return;

    modal.classList.add('active');
    
    confirmBtn.onclick = () => {
        localStorage.removeItem('chatHistory');
        const list = document.getElementById('historyList');
        if (list) list.innerHTML = '';
        closeModal();
        chatHistoryContext = [];
        currentConversationId = null;
        hasAskedProactiveQuestion = false;
        addMessage("চ্যাট হিস্ট্রি সফলভাবে ডিলিট করা হয়েছে।", "bot");
    };
}

function closeModal() {
    const modal = document.getElementById('customModal');
    if (modal) modal.classList.remove('active');
}

function showInstallModal() {
    const modal = document.getElementById('installModal');
    if (modal) modal.classList.add('active');
}

function closeInstallModal() {
    const modal = document.getElementById('installModal');
    if (modal) modal.classList.remove('active');
}

function downloadDesktopShortcut() {
    const currentUrl = window.location.href;
    const shortcutContent = `[InternetShortcut]\r\nURL=${currentUrl}\r\nIconIndex=0\r\n`;
    const blob = new Blob([shortcutContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Shepu-AI.url';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function changeVersion(select) {
    const val = select.value;
    if (val) window.location.href = val;
}

function handleSuggestions(val) {
    val = val.toLowerCase().trim();
    if (val.length < 2) { suggestionBox.style.display = 'none'; return; }
    
    const matches = database.filter(item => item.q.includes(val))
        .sort((a, b) => {
            const aStarts = a.q.startsWith(val);
            const bStarts = b.q.startsWith(val);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.q.length - b.q.length;
        })
        .slice(0, 5);
    if (matches.length > 0) {
        suggestionBox.innerHTML = '';
        matches.forEach(m => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerText = m.q;
            div.onclick = () => {
                userInput.value = m.q;
                suggestionBox.style.display = 'none';
                userInput.focus();
                userInput.dispatchEvent(new Event('input'));
                sendMessage();
            };
            suggestionBox.appendChild(div);
        });
        suggestionBox.style.display = 'flex';
    } else {
        suggestionBox.style.display = 'none';
    }
}

function addMessage(text, sender, animate = true) {
    if (text === undefined || text === null) text = "";
    if (sender === 'bot') {
        isBotAnswering = true;
    }
    const div = document.createElement('div');
    div.className = `msg ${sender}`;
    const id = 'msg-' + Date.now();
    div.id = id;
    
    const savedUserAvatar = localStorage.getItem('shepu_user_avatar');
    let avatarHTML = sender === 'bot'
        ? `<img src="${document.body.classList.contains('hacking-mode') ? 'app/assets/hai.ico' : 'app/assets/upai.png'}" alt="AI" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\\'fas fa-robot\\'></i>'">`
        : (savedUserAvatar 
            ? `<img src="${savedUserAvatar}" alt="User Avatar">` 
            : `<i class="fas fa-user"></i>`);
    
    div.innerHTML = `<div class="avatar">${avatarHTML}</div><div class="msg-content"></div>`;
    chatContainer.appendChild(div);
    const contentDiv = div.querySelector('.msg-content');

    if (sender === 'bot') {
        const fullHTML = formatText(text);

        if (!animate) {
            contentDiv.innerHTML = fullHTML;
            const rawText = contentDiv.innerText.trim().replace(/"/g, '&quot;');
            const safeMarkdown = text.replace(/"/g, '&quot;');
            contentDiv.innerHTML += `
                <div class="message-actions">
                    <button class="msg-action-btn" onclick="speakMessage(this)" data-text="${rawText}" title="Read Aloud"><i class="fas fa-volume-up"></i></button>
                    <button class="msg-action-btn" onclick="copyMessage(this)" data-text="${safeMarkdown}" title="Copy Text"><i class="fas fa-copy"></i></button>
                </div>
            `;
            if (window.hljs) hljs.highlightAll();
            isBotAnswering = false; // Reset block
            resetIdleTimer();
        } else {
            const tokens = parseHTMLToTokens(fullHTML);
            const speed = 15;
            let tokenIndex = 0;
            let currentHTML = "";
            let typingActive = true;

            div.style.cursor = 'pointer';
            div.title = 'Click to skip typing';
            
            const skipTyping = () => {
                if (typingActive) {
                    typingActive = false;
                    finishTyping();
                }
            };
            
            div.addEventListener('click', skipTyping);

            function parseHTMLToTokens(htmlString) {
                const tokens = [];
                let i = 0;
                while (i < htmlString.length) {
                    if (htmlString[i] === '<') {
                        let tag = '';
                        while (i < htmlString.length && htmlString[i] !== '>') {
                            tag += htmlString[i];
                            i++;
                        }
                        if (i < htmlString.length) {
                            tag += '>';
                            i++;
                        }
                        tokens.push({ type: 'tag', val: tag });
                    } else if (htmlString[i] === '&') {
                        let entity = '';
                        while (i < htmlString.length && htmlString[i] !== ';') {
                            entity += htmlString[i];
                            i++;
                        }
                        if (i < htmlString.length) {
                            entity += ';';
                            i++;
                        }
                        tokens.push({ type: 'char', val: entity });
                    } else {
                        tokens.push({ type: 'char', val: htmlString[i] });
                        i++;
                    }
                }
                return tokens;
            }

            function type() {
                if (!typingActive) return;
                
                if (tokenIndex < tokens.length) {
                    let step = 1;
                    if (text.length > 800) step = 5;
                    else if (text.length > 300) step = 2;

                    for (let s = 0; s < step; s++) {
                        if (tokenIndex >= tokens.length) break;
                        const token = tokens[tokenIndex];
                        currentHTML += token.val;
                        tokenIndex++;
                        
                        while (tokenIndex < tokens.length && tokens[tokenIndex].type === 'tag') {
                            currentHTML += tokens[tokenIndex].val;
                            tokenIndex++;
                        }
                    }
                    
                    contentDiv.innerHTML = currentHTML;
                    scrollToBottom();
                    
                    if (tokenIndex < tokens.length) {
                        setTimeout(type, speed);
                    } else {
                        finishTyping();
                    }
                } else {
                    finishTyping();
                }
            }

            function finishTyping() {
                typingActive = false;
                div.removeEventListener('click', skipTyping);
                div.style.cursor = '';
                div.title = '';
                
                contentDiv.innerHTML = fullHTML;
                
                const rawText = contentDiv.innerText.trim().replace(/"/g, '&quot;');
                const safeMarkdown = text.replace(/"/g, '&quot;');
                contentDiv.innerHTML += `
                    <div class="message-actions">
                        <button class="msg-action-btn" onclick="speakMessage(this)" data-text="${rawText}" title="Read Aloud"><i class="fas fa-volume-up"></i></button>
                        <button class="msg-action-btn" onclick="copyMessage(this)" data-text="${safeMarkdown}" title="Copy Text"><i class="fas fa-copy"></i></button>
                    </div>
                `;
                if (window.hljs) hljs.highlightAll();
                scrollToBottom(true);
                isBotAnswering = false; // Reset block only AFTER typing is completely finished
                resetIdleTimer();
            }

            type();
        }
    } else {
        contentDiv.innerHTML = formatText(text);
    }

    scrollToBottom(true);
    return id;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// typing indicators, formatting helper
function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = `msg bot`;
    div.id = 'typing-' + Date.now();
    div.innerHTML = `
        <div class="avatar"><img src="${document.body.classList.contains('hacking-mode') ? 'app/assets/hai.ico' : 'app/assets/upai.png'}" alt="AI"></div>
        <div class="msg-content"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>
    `;
    chatContainer.appendChild(div);
    scrollToBottom();
    return div.id;
}

function scrollToBottom(force = false) {
    if (!chatContainer) return;
    if (shouldAutoScroll || force) {
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: force ? 'smooth' : 'auto'
        });
    }
}

function formatText(text) {
    if (!text) return "";
    
    let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        try {
            return marked.parse(safeText);
        } catch (e) {
            console.error("[Shepu Markdown] Error parsing with marked.js, falling back...", e);
        }
    }

    // Fallback basic parser in case marked.js fails to load
    safeText = safeText.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    safeText = safeText.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    safeText = safeText.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safeText = safeText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    safeText = safeText.replace(/__(.*?)__/g, '<strong>$1</strong>');
    safeText = safeText.replace(/_(.*?)_/g, '<em>$1</em>');
    
    safeText = safeText.replace(/^[\s]*[•\-*]\s+(.*)/gm, '<li>$1</li>');
    safeText = safeText.replace(/^[\s]*(\d+)\.\s+(.*)/gm, '<li>$2</li>');
    
    safeText = safeText.replace(/((?:<li>.*?<\/li>[\s\n]*)+)/gs, '<ul>$1</ul>');

    safeText = safeText.replace(/\n/g, '<br>');
    safeText = safeText.replace(/<\/li><br><li>/g, '</li><li>');
    safeText = safeText.replace(/<ul><br>/g, '<ul>').replace(/<\/ul><br>/g, '</ul>');
    safeText = safeText.replace(/<li><br>/g, '<li>').replace(/<br><\/li>/g, '</li>');
    
    return safeText;
}

function changeVersion(selectElement) {
    if (!selectElement) return;
    const targetUrl = selectElement.value;
    if (targetUrl) {
        window.location.href = targetUrl;
    }
}

function openVersionModal() {
    const modal = document.getElementById('versionModal');
    if (modal) modal.classList.add('active');
}

function closeVersionModal() {
    const modal = document.getElementById('versionModal');
    if (modal) modal.classList.remove('active');
}

function switchToVersion(targetUrl, e) {
    if (e) {
        e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
    }
    if (targetUrl) {
        window.location.replace(targetUrl);
    }
}

function toggleVersionDropdown(e) {
    if (e) e.stopPropagation();
    const btn = document.getElementById('versionSelectBtn');
    if (btn) {
        btn.classList.toggle('active');
    }
}

document.addEventListener('click', (e) => {
    const btn = document.getElementById('versionSelectBtn');
    if (btn && btn.classList.contains('active') && !btn.contains(e.target)) {
        btn.classList.remove('active');
    }
});

function toggleThemeDropdown(e) {
    if (e) e.stopPropagation();
    const btn = document.getElementById('themeSelectBtn');
    if (btn) {
        btn.classList.toggle('active');
        updateActiveThemeOption();
    }
}

function updateActiveThemeOption() {
    const activeTheme = localStorage.getItem('theme') || 'dark-mode';
    document.querySelectorAll('.custom-theme-option').forEach(opt => opt.classList.remove('active'));
    const targetOpt = document.getElementById(`themeOpt-${activeTheme}`);
    if (targetOpt) targetOpt.classList.add('active');
}

function applyCustomTheme(themeName, e) {
    if (e) e.stopPropagation();
    if (typeof changeTheme === 'function') {
        changeTheme(themeName);
    }
    updateActiveThemeOption();
    const btn = document.getElementById('themeSelectBtn');
    if (btn) btn.classList.remove('active');
    
    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }
}

function createNewChat() {
    if (typeof isTrainAiViewOpen !== 'undefined' && isTrainAiViewOpen) {
        closeTrainAiPage();
    }
    currentConversationId = null;
    chatHistoryContext = [];
    hasAskedProactiveQuestion = false;
    isBotAnswering = false;
    disableImageMode();
    
    if (chatContainer) {
        chatContainer.innerHTML = '';
        setDynamicGreeting();
    }
    
    if (userInput) {
        userInput.value = '';
        userInput.focus();
    }

    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }
}

function showToast(message, iconClass = 'fa-check-circle') {
    const toast = document.getElementById('toastNotification');
    const msgEl = document.getElementById('toastMessage');
    const iconEl = document.getElementById('toastIcon');
    if (!toast || !msgEl) return;
    
    msgEl.innerText = message;
    if (iconEl) iconEl.className = `fas ${iconClass}`;
    
    toast.classList.add('active');
    setTimeout(() => {
        toast.classList.remove('active');
    }, 2800);
}

function toggleSettingsDropdown(e) {
    if (e) e.stopPropagation();
    const btn = document.getElementById('settingsBtn');
    if (btn) {
        btn.classList.toggle('active');
    }
}

function toggleThemeSubDropdown(e) {
    if (e) e.stopPropagation();
    const btn = document.getElementById('themeSelectBtn');
    if (btn) {
        btn.classList.toggle('active');
        updateActiveThemeOption();
    }
}

function toggleProfileSubDropdown(e) {
    if (e) e.stopPropagation();
    const btn = document.getElementById('profileEditBtn');
    if (btn) {
        btn.classList.toggle('active');
        updateProfileButtonText();
        
        if (btn.classList.contains('active')) {
            setTimeout(() => {
                const nameInput = document.getElementById('userNameInput');
                if (nameInput) {
                    nameInput.focus();
                    nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        }
    }
}

function saveUserName(e) {
    if (e) e.stopPropagation();
    const input = document.getElementById('userNameInput');
    if (!input) return;
    const name = input.value.trim();
    if (name.length > 0) {
        localStorage.setItem('shepu_user_name', name);
        updateProfileButtonText();
        showToast(`Name updated to "${name}"! 👤`, 'fa-user-check');
    } else {
        localStorage.removeItem('shepu_user_name');
        updateProfileButtonText();
        showToast('Profile name cleared', 'fa-info-circle');
    }
}

function triggerProfilePictureUpload() {
    const input = document.getElementById('userAvatarInput');
    if (input) input.click();
}

function handleProfilePictureUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 8 * 1024 * 1024) {
        showToast('File size must be less than 8MB', 'fa-exclamation-triangle');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Image = e.target.result;
        try {
            localStorage.setItem('shepu_user_avatar', base64Image);
            updateProfileButtonText();
            updateUserAvatarsInChat();
            showToast('Profile picture updated successfully! 📸', 'fa-camera');
        } catch (err) {
            showToast('Failed to save image. Please select a smaller photo.', 'fa-exclamation-triangle');
        }
    };
    reader.readAsDataURL(file);
}

function updateProfileButtonText() {
    const mainBtnText = document.getElementById('profileMainBtnText');
    const photoOptText = document.getElementById('profilePhotoOptText');
    const nameInput = document.getElementById('userNameInput');

    const savedAvatar = localStorage.getItem('shepu_user_avatar');
    const savedName = localStorage.getItem('shepu_user_name');

    if (mainBtnText) {
        mainBtnText.innerText = (savedAvatar || savedName) ? 'Update Your Profile' : 'Edit Your Profile';
    }

    if (photoOptText) {
        photoOptText.innerText = savedAvatar ? 'Change Profile Picture' : 'Upload Profile Picture';
    }

    if (nameInput && savedName) {
        nameInput.value = savedName;
    }
}

function updateUserAvatarsInChat() {
    const savedAvatar = localStorage.getItem('shepu_user_avatar');
    if (!savedAvatar) return;
    document.querySelectorAll('.msg.user .avatar').forEach(avatarDiv => {
        avatarDiv.innerHTML = `<img src="${savedAvatar}" alt="User Avatar">`;
    });
}

/* ==========================================================================
   Train AI Feature Logic (Custom Local Training Engine)
   ========================================================================== */

let isTrainAiViewOpen = false;

function openTrainAiPage() {
    isTrainAiViewOpen = true;
    const chatContainer = document.getElementById('chatContainer');
    const inputWrapper = document.querySelector('.input-wrapper');
    const scrollToBottom = document.getElementById('scrollToBottom');
    const trainContainer = document.getElementById('trainAiContainer');
    const backBtn = document.getElementById('backBtn');

    if (chatContainer) chatContainer.style.display = 'none';
    if (inputWrapper) inputWrapper.style.display = 'none';
    if (scrollToBottom) scrollToBottom.style.display = 'none';
    if (trainContainer) trainContainer.style.display = 'flex';
    if (backBtn) backBtn.style.display = 'inline-flex';

    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }

    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.classList.remove('active');

    renderTrainedList();
}

function closeTrainAiPage() {
    isTrainAiViewOpen = false;
    const chatContainer = document.getElementById('chatContainer');
    const inputWrapper = document.querySelector('.input-wrapper');
    const scrollToBottom = document.getElementById('scrollToBottom');
    const trainContainer = document.getElementById('trainAiContainer');
    const backBtn = document.getElementById('backBtn');

    if (chatContainer) chatContainer.style.display = 'flex';
    if (inputWrapper) inputWrapper.style.display = 'block';
    if (scrollToBottom) scrollToBottom.style.display = 'flex';
    if (trainContainer) trainContainer.style.display = 'none';
    
    if (!ultraSmartness && backBtn) {
        backBtn.style.display = 'none';
    }
}

function saveCustomTrainPair() {
    const qInput = document.getElementById('customQuestionInput');
    const aInput = document.getElementById('customAnswerInput');
    if (!qInput || !aInput) return;

    const question = qInput.value.trim();
    const answer = aInput.value.trim();

    if (!question || !answer) {
        showToast('Please enter both question and answer', 'fa-exclamation-circle');
        return;
    }

    const rawData = localStorage.getItem('shepu_user_trained_data');
    let pairs = [];
    if (rawData) {
        try { pairs = JSON.parse(rawData); } catch (e) { pairs = []; }
    }

    const newPair = {
        id: Date.now(),
        q: question,
        a: answer
    };

    pairs.unshift(newPair);
    localStorage.setItem('shepu_user_trained_data', JSON.stringify(pairs));

    qInput.value = '';
    aInput.value = '';

    showToast('Knowledge saved successfully! 🧠', 'fa-check-circle');
    renderTrainedList();
}

function deleteTrainedPair(id) {
    const rawData = localStorage.getItem('shepu_user_trained_data');
    if (!rawData) return;
    try {
        let pairs = JSON.parse(rawData);
        pairs = pairs.filter(item => item.id !== id);
        localStorage.setItem('shepu_user_trained_data', JSON.stringify(pairs));
        showToast('Knowledge pair deleted', 'fa-trash-alt');
        renderTrainedList();
    } catch (e) {}
}

function renderTrainedList() {
    const listContainer = document.getElementById('trainedList');
    const badge = document.getElementById('trainedCountBadge');
    if (!listContainer) return;

    const rawData = localStorage.getItem('shepu_user_trained_data');
    let pairs = [];
    if (rawData) {
        try { pairs = JSON.parse(rawData); } catch (e) { pairs = []; }
    }

    if (badge) badge.innerText = `${pairs.length} pair${pairs.length === 1 ? '' : 's'}`;

    if (pairs.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-secondary); font-size: 13px;">
                <i class="fas fa-folder-open" style="font-size: 24px; margin-bottom: 8px; opacity: 0.5;"></i><br>
                কোনো ট্রেন ডেটা পাওয়া যায়নি। উপরে নতুন প্রশ্ন-উত্তর যুক্ত করুন!
            </div>
        `;
        return;
    }

    listContainer.innerHTML = pairs.map(item => `
        <div class="trained-item">
            <div class="trained-qa-info">
                <div class="trained-q"><i class="fas fa-question-circle" style="color: var(--accent-color); margin-right: 6px;"></i> ${escapeHtml(item.q)}</div>
                <div class="trained-a"><i class="fas fa-reply" style="opacity: 0.6; margin-right: 6px;"></i> ${escapeHtml(item.a)}</div>
            </div>
            <button class="trained-delete-btn" onclick="deleteTrainedPair(${item.id})" title="Delete">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');
}

function getCustomTrainedAnswer(userQuery) {
    const rawData = localStorage.getItem('shepu_user_trained_data');
    if (!rawData) return null;
    try {
        const customPairs = JSON.parse(rawData);
        if (!Array.isArray(customPairs) || customPairs.length === 0) return null;

        const cleanQuery = userQuery.toLowerCase().trim();
        let bestMatch = null;
        let highestScore = 0;

        for (const item of customPairs) {
            const trainQ = (item.q || "").toLowerCase().trim();
            const trainA = (item.a || "").trim();
            if (!trainQ || !trainA) continue;

            // 1. Exact Match
            if (cleanQuery === trainQ) {
                return trainA;
            }

            // 2. Contains Match
            if (cleanQuery.includes(trainQ) || trainQ.includes(cleanQuery)) {
                return trainA;
            }

            // 3. Keyword / Near Match Scoring
            const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 1);
            const trainWords = trainQ.split(/\s+/).filter(w => w.length > 1);
            
            if (queryWords.length > 0 && trainWords.length > 0) {
                let matchCount = 0;
                for (const qw of queryWords) {
                    if (trainWords.some(tw => tw.includes(qw) || qw.includes(tw))) {
                        matchCount++;
                    }
                }
                const score = matchCount / Math.max(queryWords.length, trainWords.length);
                if (score > highestScore && score >= 0.4) {
                    highestScore = score;
                    bestMatch = trainA;
                }
            }
        }

        return bestMatch;
    } catch (e) {
        console.error("[Shepu Train AI] Error searching custom training data:", e);
        return null;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

