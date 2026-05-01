const EMBEDDED_DB = [
    { q: "hi", a: "হ্যালো! আমি Shepu-AI। আপনাকে কীভাবে সাহায্য করতে পারি?" },
    { q: "who are you", a: "আমি **শেপু-আই v3.1**, আপনার স্মার্ট এআই অ্যাসিস্ট্যান্ট।" },
    { q: "bye", a: "বিদায়! আপনার দিনটি ভালো কাটুক।" },
    { q: "ki korte paro", a: "আমি অংক সমাধান করতে পারি, ফাইল থেকে তথ্য খুঁজতে পারি এবং আপনার যেকোনো প্রশ্নের উত্তর দেওয়ার চেষ্টা করতে পারি।" }
];

let database = [];
let golpoDatabase = [];
let conversationContext = { lastSubject: null, globalKeywords: new Set() };
let idleTimer;
let questionTimer;
let proactiveTypingId = null;
let activeProactiveItem = null;
let ultraSmartness = localStorage.getItem('ultraSmartness') !== 'false'; // Default to true
let currentTheme = localStorage.getItem('theme') || 'dark-mode';

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
    document.body.className = currentTheme;
    const aiAvatar = document.getElementById('ai-avatar');
    if (aiAvatar) {
        aiAvatar.src = currentTheme === 'hacking-mode' ? "hai.ico" : "pai.png";
    }

    // Load saved history from localStorage
    const savedHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    savedHistory.forEach(text => addToHistory(text, false));

    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.classList.add('fade-out');
    }, 1200);

    await loadData();
    setDynamicGreeting();
    
    // Ensure voices are loaded for TTS
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    userInput.focus();
    resetIdleTimer();
    
    // Set toggle button state
    const status = document.getElementById('smartnessStatus');
    const toggleBtn = document.getElementById('smartnessToggle');
    if (status) status.innerText = ultraSmartness ? "ON" : "OFF";
    if (toggleBtn && !ultraSmartness) toggleBtn.classList.add('off');

    userInput.addEventListener('input', handleUserInput);

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

function resetIdleTimer() {
    clearTimeout(idleTimer);
    clearTimeout(questionTimer);
    removeProactiveTyping();
    
    idleTimer = setTimeout(() => {
        if (userInput && userInput.value.trim().length === 0 && ultraSmartness) {
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
    if (!ultraSmartness || golpoDatabase.length === 0) return;
    removeProactiveTyping();

    let bestItem = null;
    let maxScore = -1;

    const sampleSize = Math.min(30, golpoDatabase.length);
    const candidates = [];
    for(let i=0; i<sampleSize; i++) {
        candidates.push(golpoDatabase[Math.floor(Math.random() * golpoDatabase.length)]);
    }

    candidates.forEach(item => {
        let score = 0;
        const dbKeywords = item.q.toLowerCase().split(/\s+/);
        
        conversationContext.globalKeywords.forEach(kw => {
            if (dbKeywords.includes(kw)) score += 1;
        });

        if (score > maxScore) {
            maxScore = score;
            bestItem = item;
        }
    });

    if (!bestItem || maxScore === 0) {
        bestItem = golpoDatabase[Math.floor(Math.random() * golpoDatabase.length)];
    }

    activeProactiveItem = bestItem;
    addMessage(bestItem.q, "bot");
}

function toggleUltraSmartness() {
    ultraSmartness = !ultraSmartness;
    localStorage.setItem('ultraSmartness', ultraSmartness);
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
    if (hour < 12) greetingText = "শুভ সকাল, আমি Shepu-AI v3.1";
    else if (hour < 18) greetingText = "শুভ অপরাহ্ন, আমি Shepu-AI v3.1";
    else greetingText = "শুভ সন্ধ্যা, আমি Shepu-AI v3.1";
    h2.innerText = greetingText;
}

function setHackingMode() {
    document.body.classList.remove('light-mode');
    document.body.classList.toggle('hacking-mode');
    const newTheme = document.body.classList.contains('hacking-mode') ? 'hacking-mode' : 'dark-mode';
    localStorage.setItem('theme', newTheme);
    
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
    const newTheme = document.body.classList.contains('light-mode') ? 'light-mode' : 'dark-mode';
    localStorage.setItem('theme', newTheme);
    
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

    const stopWords = ["is", "the", "a", "an", "are", "in", "on", "at", "to", "for", "with", "ki", "er", "e", "te", "kore", "kora", "theke", "thekai", "holo", "hoy", "hobe", "niye"];
    const extractKeywords = (str) => str.split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(w));
    const userKeywords = extractKeywords(query);

    if (/^[\d\s\+\-\*\/\(\)\.\^\%]+$/.test(query) && /\d/.test(query) && !/[a-zA-Z]/.test(query)) {
        try {
            let result = Function('"use strict";return (' + query.replace(/\^/g, '**') + ')')();
            return `আমি আপনার জন্য হিসাব করেছি: **${result}**`;
        } catch (e) { }
    }

    let processedQuery = query;
    const pronouns = ["k", "ki", "tar", "oita", "ota", "oitar", "সে কে", "তার নাম"];
    if (query.split(' ').length <= 3 && conversationContext.lastSubject) {
        if (pronouns.some(p => query.includes(p))) {
            processedQuery = conversationContext.lastSubject + " " + query;
        }
    }

    userKeywords.forEach(kw => conversationContext.globalKeywords.add(kw));

    const segments = processedQuery.split(/[?.!,]+/).map(s => s.trim()).filter(s => s.length > 1);
    let finalAnswers = [];
    let usedAnswers = new Set();
    let matchedSegments = [];

    segments.forEach(segment => {
        let bestSegmentMatch = null;
        let highestScore = -1;

        database.forEach(item => {
            let score = 0;
            const dbQ = item.q.toLowerCase().trim();
            const seg = segment.toLowerCase().trim();

            if (seg === dbQ) {
                score = 1.0;
            } else if (seg.includes(dbQ) || dbQ.includes(seg)) {
                const segWords = seg.split(/\s+/);
                const dbWords = dbQ.split(/\s+/);
                const matches = segWords.filter(w => dbWords.includes(w)).length;
                const overlap = matches / Math.max(segWords.length, dbWords.length);
                
                score = overlap * 0.9;
                if (seg.includes(dbQ) && dbWords.length > 1) score += 0.05;
            } else {
                const sim = similarity(seg, dbQ);
                if (sim > 0.8) score = sim * 0.8;
            }

            if (score > highestScore) {
                highestScore = score;
                bestSegmentMatch = item;
            }
        });

        if (bestSegmentMatch && highestScore > 0.65) {
            if (!usedAnswers.has(bestSegmentMatch.a)) {
                finalAnswers.push(bestSegmentMatch.a);
                usedAnswers.add(bestSegmentMatch.a);
                matchedSegments.push(segment);
                const words = bestSegmentMatch.q.split(' ');
                if (words.length > 0) conversationContext.lastSubject = words[0];
            }
        }
    });

    if (finalAnswers.length > 0) {
        if (finalAnswers.length === 1) return beautifyResponse(finalAnswers[0]);
        
        let response = "";
        finalAnswers.forEach(ans => {
            response += `• ${ans}\n\n`;
        });
        return response.trim();
    }

    let bestGlobalMatch = null;
    let highestGlobalScore = -1;
    const cleanQuery = query.replace(/[?.!,]/g, ' ').trim();

    database.forEach(item => {
        const dbQ = item.q.toLowerCase().trim();
        const dbKeywords = extractKeywords(dbQ);
        
        const keywordMatches = userKeywords.filter(w => dbKeywords.includes(w)).length;
        const keywordScore = userKeywords.length > 0 ? (keywordMatches / userKeywords.length) : 0;
        
        const sim = similarity(cleanQuery, dbQ);
        const qWords = cleanQuery.split(/\s+/);
        const dbWords = dbQ.split(/\s+/);
        const matches = qWords.filter(w => dbWords.includes(w)).length;
        const overlap = matches / Math.max(qWords.length, dbWords.length);
        
        const score = (sim * 0.2) + (overlap * 0.3) + (keywordScore * 0.5);

        if (score > highestGlobalScore) {
            highestGlobalScore = score;
            bestGlobalMatch = item;
        }
    });

    if (bestGlobalMatch && highestGlobalScore > 0.1) {
        return beautifyResponse(bestGlobalMatch.a);
    }

    return "আমি আপনার প্রশ্নের কাছাকাছি কোনো উত্তর খুঁজে পাচ্ছি না। দয়া করে একটু অন্যভাবে জিজ্ঞাসা করুন!";
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
    let selectedVoice = voices.find(v => v.lang.includes('bn') || v.lang.includes('Bengali'));
    
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

function addToHistory(text, save = true) {
    const list = document.getElementById('historyList');
    if (!list) return;
    
    const items = list.querySelectorAll('.history-item');
    for (let i of items) if (i.innerText === text) return;

    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerText = text;
    item.onclick = () => {
        userInput.value = text;
        userInput.dispatchEvent(new Event('input'));
        sendMessage();
    };
    list.prepend(item);

    if (save) {
        const currentHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        if (!currentHistory.includes(text)) {
            currentHistory.push(text);
            if (currentHistory.length > 50) currentHistory.shift();
            localStorage.setItem('chatHistory', JSON.stringify(currentHistory));
        }
    }
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
        addMessage("চ্যাট হিস্ট্রি সফলভাবে ডিলিট করা হয়েছে।", "bot");
    };
}

function closeModal() {
    const modal = document.getElementById('customModal');
    if (modal) modal.classList.remove('active');
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

function addMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `msg ${sender}`;
    const id = 'msg-' + Date.now();
    div.id = id;
    
    let avatarHTML = sender === 'bot'
        ? `<img src="${document.body.classList.contains('hacking-mode') ? 'hai.ico' : 'pai.png'}" alt="AI" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\\'fas fa-robot\\'></i>'">`
        : `<i class="fas fa-user"></i>`;
    
    div.innerHTML = `<div class="avatar">${avatarHTML}</div><div class="msg-content"></div>`;
    chatContainer.appendChild(div);
    const contentDiv = div.querySelector('.msg-content');

    if (sender === 'bot') {
        let i = 0;
        const speed = 20; 

        function type() {
            if (i <= text.length) {
                const currentText = text.substring(0, i);
                const lastTagOpen = currentText.lastIndexOf('<');
                const lastTagClose = currentText.lastIndexOf('>');
                
                if (lastTagOpen > lastTagClose) {
                    const tagEnd = text.indexOf('>', i);
                    if (tagEnd !== -1) {
                        i = tagEnd + 1;
                    } else {
                        i++;
                    }
                } else {
                    i++;
                }

                contentDiv.innerHTML = formatText(text.substring(0, i));
                scrollToBottom();
                if (i <= text.length) {
                    setTimeout(type, speed);
                } else {
                    finishTyping();
                }
            }
        }

        function finishTyping() {
            const rawText = contentDiv.innerText.trim().replace(/"/g, '&quot;');
            contentDiv.innerHTML += `
                <div class="message-actions">
                    <button class="msg-action-btn" onclick="speakMessage(this)" data-text="${rawText}" title="Read Aloud"><i class="fas fa-volume-up"></i></button>
                    <button class="msg-action-btn" onclick="copyMessage(this)" data-text="${rawText}" title="Copy Text"><i class="fas fa-copy"></i></button>
                </div>
            `;
            if (window.hljs) hljs.highlightAll();
            scrollToBottom();
        }

        type();
    } else {
        contentDiv.innerHTML = formatText(text);
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
    
    text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    
    text = text.replace(/^[\s]*[•\-*]\s+(.*)/gm, '<li>$1</li>');
    text = text.replace(/^[\s]*(\d+)\.\s+(.*)/gm, '<li>$2</li>');
    
    text = text.replace(/((?:<li>.*?<\/li>[\s\n]*)+)/gs, '<ul>$1</ul>');

    text = text.replace(/\n/g, '<br>');
    text = text.replace(/<\/li><br><li>/g, '</li><li>');
    text = text.replace(/<ul><br>/g, '<ul>').replace(/<\/ul><br>/g, '</ul>');
    text = text.replace(/<li><br>/g, '<li>').replace(/<br><\/li>/g, '</li>');
    
    return text;
}
