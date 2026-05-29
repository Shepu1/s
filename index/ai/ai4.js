const EMBEDDED_DB = [
    { q: "hi", a: "হ্যালো! আমি Shepu-AI। আপনাকে কীভাবে সাহায্য করতে পারি?" },
    { q: "who are you", a: "আমি **শেপু-আই v3.0**, আপনার স্মার্ট এআই অ্যাসিস্ট্যান্ট।" },
    { q: "bye", a: "বিদায়! আপনার দিনটি ভালো কাটুক।" },
    { q: "ki korte paro", a: "আমি অংক সমাধান করতে পারি, ফাইল থেকে তথ্য খুঁজতে পারি এবং আপনার যেকোনো প্রশ্নের উত্তর দেওয়ার চেষ্টা করতে পারি।" }
];

let database = [];
let golpoDatabase = [];
let conversationContext = [];
let idleTimer;
let questionTimer;
let proactiveTypingId = null;
let activeProactiveItem = null;
let ultraSmartness = true;

const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const suggestionBox = document.getElementById('suggestionBox');
const voiceBtn = document.getElementById('voiceBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuBtn = document.getElementById('menuBtn');
const mainContent = document.getElementById('mainContent');
const scrollToBottomBtn = document.getElementById('scrollToBottom');

window.addEventListener('DOMContentLoaded', async () => {
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.classList.add('fade-out');
    }, 1200);

    await loadData();
    setDynamicGreeting();
    userInput.focus();
    resetIdleTimer();

    const toggleSidebar = () => {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
    };

    menuBtn.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

    chatContainer.addEventListener('scroll', () => {
        const isScrolledUp = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight > 200;
        if (isScrolledUp) {
            scrollToBottomBtn.classList.add('visible');
        } else {
            scrollToBottomBtn.classList.remove('visible');
        }
    });
});

function resetIdleTimer() {
    clearTimeout(idleTimer);
    clearTimeout(questionTimer);
    removeProactiveTyping();
    
    idleTimer = setTimeout(() => {
        if (userInput.value.trim().length === 0 && ultraSmartness) {
            proactiveTypingId = addTypingIndicator();
        }
    }, 3000); 
    
    questionTimer = setTimeout(askProactiveQuestion, 10000);
}

function removeProactiveTyping() {
    if (proactiveTypingId) {
        removeMessage(proactiveTypingId);
        proactiveTypingId = null;
    }
}

function askProactiveQuestion() {
    if (!ultraSmartness) return;
    if (userInput.value.trim().length > 0) {
        removeProactiveTyping();
        resetIdleTimer();
        return;
    }
    if (golpoDatabase.length === 0) return;
    
    removeProactiveTyping();
    activeProactiveItem = golpoDatabase[Math.floor(Math.random() * golpoDatabase.length)];
    addMessage(activeProactiveItem.q, 'bot');
}

function toggleUltraSmartness() {
    ultraSmartness = !ultraSmartness;
    const status = document.getElementById('smartnessStatus');
    const toggleBtn = document.getElementById('smartnessToggle');
    
    if (ultraSmartness) {
        status.innerText = "ON";
        toggleBtn.classList.remove('off');
        resetIdleTimer();
        addMessage("Ultra Smartness Activated! আমি এখন নিজেই কথা শুরু করবো।", "bot");
    } else {
        status.innerText = "OFF";
        toggleBtn.classList.add('off');
        clearTimeout(idleTimer);
        clearTimeout(questionTimer);
        removeProactiveTyping();
        addMessage("Ultra Smartness Deactivated. আমি আর নিজে থেকে কথা বলবো না।", "bot");
    }
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
    let greetingText;
    if (hour < 12) greetingText = "শুভ সকাল, আমি Shepu-AI v3.0";
    else if (hour < 18) greetingText = "শুভ অপরাহ্ন, আমি Shepu-AI v3.0";
    else greetingText = "শুভ সন্ধ্যা, আমি Shepu-AI v3.0";
    h2.innerText = greetingText;
}

function setHackingMode() {
    document.body.classList.remove('light-mode');
    document.body.classList.toggle('hacking-mode');
    const aiAvatar = document.getElementById('ai-avatar');
    if (aiAvatar) {
        aiAvatar.src = document.body.classList.contains('hacking-mode') ? "hai.ico" : "pai.png";
    }
    if (document.body.classList.contains('hacking-mode')) {
        addMessage("Hacking Mode Activated... Terminal initialized.", "bot");
    }
}

function toggleTheme() {
    document.body.classList.remove('hacking-mode');
    document.body.classList.toggle('light-mode');
    const aiAvatar = document.getElementById('ai-avatar');
    if (aiAvatar) aiAvatar.src = "pai.png";
}

async function loadData() {
    EMBEDDED_DB.forEach(item => database.push({ q: item.q.toLowerCase(), a: item.a }));
    const files = ['bar.txt', 'golpo.txt', 'new.txt', 'book.txt', 'knowledge.txt'];
    for (let file of files) {
        try {
            let res = await fetch(file);
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
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
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

function findAnswer(query) {
    query = query.toLowerCase().trim();
    if (!query) return null;

    if (/^[\d\s\+\-\*\/\(\)\.\^\%]+$/.test(query) && /\d/.test(query)) {
        try {
            let result = eval(query.replace(/\^/g, '**'));
            return `আমি আপনার জন্য হিসাব করেছি: **${result}**`;
        } catch (e) { }
    }

    const cleanQuery = query.replace(/[?.!,]/g, '').toLowerCase().trim();
    const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 2);

    let finalAnswers = [];
    let usedAnswers = new Set();
    
    const intents = {
        greeting: /(hi|hello|hey|hola|kemon|ki obostha)/i,
        identity: /(who are you|tomar nam|about you|nijer kotha)/i
    };

    if (intents.greeting.test(cleanQuery)) {
        finalAnswers.push("হ্যালো!");
        usedAnswers.add("হ্যালো!");
    }
    if (intents.identity.test(cleanQuery)) {
        finalAnswers.push("আমি শেপু-আই v3.0");
        usedAnswers.add("আমি শেপু-আই v3.0");
    }

    let matchedItems = [];
    database.forEach(item => {
        let score = 0;
        if (cleanQuery.includes(item.q)) score = 1.0;
        else {
            const dbWords = item.q.split(/\s+/);
            const matches = queryWords.filter(w => dbWords.includes(w)).length;
            score = matches / Math.max(dbWords.length, 1);
        }
        if (score > 0.6) matchedItems.push({ q: item.q, a: item.a, score: score });
    });

    matchedItems.sort((a, b) => b.score - a.score);
    matchedItems.forEach(item => {
        if (!usedAnswers.has(item.a)) {
            finalAnswers.push(item.a);
            usedAnswers.add(item.a);
        }
    });

    if (finalAnswers.length > 1) {
        let response = "";
        let finalSeen = new Set();
        finalAnswers.forEach(ans => {
            if(!finalSeen.has(ans)) {
                response += `• ${ans}\n\n`;
                finalSeen.add(ans);
            }
        });
        return response;
    } else if (finalAnswers.length === 1) {
        return finalAnswers[0];
    }

    let bestMatch = null;
    let highestScore = -1;
    database.forEach(item => {
        let score = 0;
        const dbQ = item.q;
        if (cleanQuery === dbQ) score = 1.0;
        else {
            const sim = similarity(cleanQuery, dbQ);
            const words = cleanQuery.split(/\s+/);
            const matches = words.filter(w => w.length > 2 && dbQ.includes(w)).length;
            const overlap = matches / Math.max(words.length, dbQ.split(/\s+/).length);
            score = (sim * 0.5) + (overlap * 0.5);
            if (dbQ.includes(cleanQuery)) score += 0.15;
        }
        if (score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    });

    if (bestMatch && highestScore > 0.45) {
        conversationContext.push({ q: query, a: bestMatch.a });
        return beautifyResponse(bestMatch.a);
    }

    const fallbacks = [
        "আমি এই বিষয়টি সম্পর্কে নিশ্চিত নই। আপনি কি অন্যভাবে বলতে পারেন?",
        "দুঃখিত, আমার কাছে এই তথ্যটি নেই। আমি এটি শেখার চেষ্টা করছি!",
        "অনুগ্রহ করে প্রশ্নটি পরিষ্কার করে বলুন, আমি উত্তর দেওয়ার চেষ্টা করছি।"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function beautifyResponse(text) {
    if (text.length > 100 && !text.includes('\n')) {
        return text.split('. ').join('.\n- ');
    }
    return text;
}

userInput.addEventListener('input', function () {
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
});

function speakText(text, buttonElement = null) {
    window.speechSynthesis.cancel();
    document.querySelectorAll('.msg-action-btn').forEach(btn => btn.classList.remove('active'));
    let cleanText = text.replace(/<[^>]*>?/gm, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'bn-BD';
    utterance.onstart = () => { if (buttonElement) buttonElement.classList.add('active'); };
    utterance.onend = () => { if (buttonElement) buttonElement.classList.remove('active'); };
    window.speechSynthesis.speak(utterance);
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
    userInput.value = '';
    userInput.style.height = '48px';
    sendBtn.classList.remove('has-text');
    suggestionBox.style.display = 'none';
    addMessage(text, 'user');
    addToHistory(text);
    resetIdleTimer();
    const thinkingId = addTypingIndicator();
    setTimeout(() => {
        removeMessage(thinkingId);
        let answer = checkProactiveAnswer(text);
        if (!answer) answer = findAnswer(text);
        addMessage(answer, 'bot');
    }, 600);
}

function addToHistory(text) {
    const list = document.getElementById('historyList');
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerText = text;
    item.onclick = () => {
        userInput.value = text;
        userInput.dispatchEvent(new Event('input'));
        sendMessage();
    };
    list.prepend(item);
}

function changeVersion(select) {
    const val = select.value;
    if (val) window.location.href = val;
}

function handleSuggestions(val) {
    val = val.toLowerCase().trim();
    if (val.length < 2) { suggestionBox.style.display = 'none'; return; }
    const matches = database.filter(item => item.q.includes(val)).slice(0, 5);
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

function addMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `msg ${sender}`;
    const id = 'msg-' + Date.now();
    div.id = id;
    let avatarHTML = sender === 'bot'
        ? `<img src="${document.body.classList.contains('hacking-mode') ? 'hai.ico' : 'pai.png'}" alt="AI" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\\'fas fa-robot\\'></i>'">`
        : `<i class="fas fa-user"></i>`;
    let formattedText = formatText(text);
    div.innerHTML = `<div class="avatar">${avatarHTML}</div><div class="msg-content"></div>`;
    chatContainer.appendChild(div);
    const contentDiv = div.querySelector('.msg-content');
    contentDiv.innerHTML = formattedText;
    if (sender === 'bot') {
        const rawText = contentDiv.innerText.trim().replace(/"/g, '&quot;');
        contentDiv.innerHTML += `
            <div class="message-actions">
                <button class="msg-action-btn" onclick="speakMessage(this)" data-text="${rawText}"><i class="fas fa-volume-up"></i></button>
                <button class="msg-action-btn" onclick="copyMessage(this)" data-text="${rawText}"><i class="fas fa-copy"></i></button>
            </div>
        `;
        hljs.highlightAll();
    }
    scrollToBottom();
    return id;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = `msg bot`;
    div.id = 'typing-' + Date.now();
    div.innerHTML = `
        <div class="avatar"><img src="${document.body.classList.contains('hacking-mode') ? 'hai.ico' : 'pai.png'}" alt="AI"></div>
        <div class="msg-content"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>
    `;
    chatContainer.appendChild(div);
    scrollToBottom();
    return div.id;
}

function scrollToBottom() {
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
}

function formatText(text) {
    if (!text) return "";
    text = text.replace(/"/g, '&quot;');
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\n/g, '<br>');
    return text;
}

function toggleTTS() {
    const btn = document.getElementById('ttsToggle');
    const icon = btn.querySelector('i');
    if (icon.classList.contains('fa-volume-mute')) {
        icon.classList.replace('fa-volume-mute', 'fa-volume-up');
        btn.title = "TTS is ON";
    } else {
        icon.classList.replace('fa-volume-up', 'fa-volume-mute');
        btn.title = "TTS is OFF";
        window.speechSynthesis.cancel();
    }
}

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
} else { voiceBtn.style.display = 'none'; }

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
