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

window.addEventListener('DOMContentLoaded', async () => {
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
    
    // Apply saved theme
    changeTheme(currentTheme, true);

    // Load saved history from localStorage
    loadConversations();

    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.classList.add('fade-out');
    }, 2300);

    await loadData();
    setDynamicGreeting();
    
    // Ensure voices are loaded for TTS
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    userInput.focus();
    resetIdleTimer();

    userInput.addEventListener('input', handleUserInput);

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

    const toggleSidebar = () => {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
    };

    menuBtn.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    }

    chatContainer.addEventListener('scroll', () => {
        const threshold = 50; 
        const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight <= threshold;
        shouldAutoScroll = isAtBottom;

        const isScrolledUp = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight > 200;
        if (isScrolledUp) {
            scrollToBottomBtn.classList.add('visible');
        } else {
            scrollToBottomBtn.classList.remove('visible');
        }
    });

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            sendMessage(); 
        }
    });

    if ('webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'bn-BD';
        voiceBtn.addEventListener('click', () => {
            try { recognition.start(); voiceBtn.classList.add('recording'); } catch (e) { recognition.stop(); }
        });
        recognition.onresult = (e) => {
            userInput.value = e.results[0][0].transcript;
            voiceBtn.classList.remove('recording');
            sendMessage();
        };
        recognition.onend = () => voiceBtn.classList.remove('recording');
        recognition.onerror = () => voiceBtn.classList.remove('recording');
    } else { 
        if (voiceBtn) voiceBtn.style.display = 'none'; 
    }
});

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

    // Load from Google Sheets Web App URL
    const GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzqIqfPdBPZDWKkI65qjJFEcnVq1_eafRryFYH9yGipdvzSSFnxEAgdwHmHe8jErvLB3g/exec";
    try {
        let res = await fetch(GOOGLE_SHEET_WEBAPP_URL);
        if (res.ok) {
            let data = await res.json();
            if (Array.isArray(data)) {
                data.forEach(item => {
                    if (item.question && item.answer) {
                        database.push({
                            q: item.question.toString().trim().toLowerCase(),
                            a: item.answer.toString().trim()
                        });
                    }
                });
                console.log("[Shepu System] Loaded " + data.length + " entries from Google Sheet.");
            }
        }
    } catch (e) {
        console.error("[Shepu System] Error loading from Google Sheet:", e);
    }
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
        const dbQ = item.q.toLowerCase().trim();
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

// Sync Gemini Q&A to Google Sheets Web App
async function saveToGoogleSheet(question, answer) {
    const GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzqIqfPdBPZDWKkI65qjJFEcnVq1_eafRryFYH9yGipdvzSSFnxEAgdwHmHe8jErvLB3g/exec";
    try {
        console.log("[Shepu System] Saving Q&A to Google Sheets...");
        await fetch(GOOGLE_SHEET_WEBAPP_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ question: question, answer: answer })
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
    <a href="ai5.html" class="new-chat-btn" style="display: inline-flex; text-decoration: none; align-items: center; justify-content: center; gap: 8px; width: auto; max-width: 250px; margin-bottom: 0;">
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

    const payload = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: systemInstruction }]
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
        
        return "দুঃখিত, এই মুহূর্তে সব ব্যাকআপ এপিআই (API) লিমিট শেষ হওয়ার কারণে অথবা নেটওয়ার্ক সমস্যার কারণে উত্তর দেওয়া সম্ভব হচ্ছে না। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা Shepu-AI v3.1 ব্যবহার করুন।";
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

function speakText(text, buttonElement = null) {
    if (!window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    document.querySelectorAll('.msg-action-btn').forEach(btn => btn.classList.remove('active'));
    
    let cleanText = text.replace(/<[^>]*>?/gm, '').replace(/\*\*/g, '').replace(/__/g, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    const voices = window.speechSynthesis.getVoices();
    const bnVoices = voices.filter(v => v.lang.toLowerCase().includes('bn') || v.name.toLowerCase().includes('bengali'));
    
    let selectedVoice = null;
    if (bnVoices.length > 0) {
        // Prioritize Edge Natural/Online voices (super human-like)
        selectedVoice = bnVoices.find(v => v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online'));
        if (!selectedVoice) {
            // Prioritize Google voices
            selectedVoice = bnVoices.find(v => v.name.toLowerCase().includes('google'));
        }
        if (!selectedVoice) {
            // Prioritize Kalpana/Sabina
            selectedVoice = bnVoices.find(v => v.name.toLowerCase().includes('kalpana') || v.name.toLowerCase().includes('sabina'));
        }
        if (!selectedVoice) {
            selectedVoice = bnVoices[0];
        }
    }
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    } else {
        utterance.lang = 'bn-BD';
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => { if (buttonElement) buttonElement.classList.add('active'); };
    utterance.onend = () => { if (buttonElement) buttonElement.classList.remove('active'); };
    utterance.onerror = () => { if (buttonElement) buttonElement.classList.remove('active'); };

    setTimeout(() => {
        window.speechSynthesis.speak(utterance);
    }, 50);
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
    const originalClass = icon.className;
    icon.className = 'fas fa-check';
    setTimeout(() => icon.className = originalClass, 2000);
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    
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

function saveMessageToConversation(sender, text) {
    let conversations = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    
    if (currentConversationId === null) {
        currentConversationId = Date.now();
        const newConv = {
            id: currentConversationId,
            title: text.length > 30 ? text.substring(0, 30) + '...' : text,
            messages: [{ sender: sender, text: text }]
        };
        conversations.push(newConv);
        localStorage.setItem('chatHistory', JSON.stringify(conversations));
        loadConversations();
    } else {
        const convIndex = conversations.findIndex(c => c.id === currentConversationId);
        if (convIndex !== -1) {
            conversations[convIndex].messages.push({ sender: sender, text: text });
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
    
    conv.messages.forEach(msg => {
        addMessage(msg.text, msg.sender, false);
        addToChatHistory(msg.sender, msg.text);
    });
    
    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }
    
    scrollToBottom(true);
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
    
    let avatarHTML = sender === 'bot'
        ? `<img src="${document.body.classList.contains('hacking-mode') ? 'app/assets/hai.ico' : 'app/assets/upai.png'}" alt="AI" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\\'fas fa-robot\\'></i>'">`
        : `<i class="fas fa-user"></i>`;
    
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
