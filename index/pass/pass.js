const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    document.body.classList.toggle('dark-theme');
    if (document.body.classList.contains('light-theme')) {
        themeToggle.innerText = 'Dark Theme';
    } else {
        themeToggle.innerText = 'Light Theme';
    }
});
// The rest of the script remains the same
const generateBtn = document.getElementById('generateBtn');
const copyBtn = document.getElementById('copyBtn');
const smartBtn = document.getElementById('smartBtn');
const checkBtn = document.getElementById('checkBtn');
const lengthInput = document.getElementById('length');
const lengthValue = document.getElementById('lengthValue');
const numPasswordsInput = document.getElementById('numPasswords');
const passwordDisplay = document.getElementById('password-display');
const loader = document.getElementById('loader');
const strengthDisplay = document.getElementById('strengthDisplay');
const includeUpper = document.getElementById('includeUpper');
const includeLower = document.getElementById('includeLower');
const includeNumbers = document.getElementById('includeNumbers');
const includeSymbols = document.getElementById('includeSymbols');
const avoidAmbiguous = document.getElementById('avoidAmbiguous');
// Modal Smart Password
const smartModal = document.getElementById('smartModal');
const closeModal = document.querySelector('.close');
const modalGenerate = document.getElementById('modalGenerate');
const userNameInput = document.getElementById('userName');
const userLuckyInput = document.getElementById('userLucky');
// Modal Check Password
const checkModal = document.getElementById('checkModal');
const closeCheck = document.querySelector('.close-check');
const checkInput = document.getElementById('checkInput');
const toggleCheck = document.getElementById('toggleCheck');
const strengthBadge = document.getElementById('strengthBadge');
// Update length value display
lengthInput.addEventListener('input', () => {
    lengthValue.innerText = lengthInput.value;
});
// Toggle show/hide for check input
toggleCheck.addEventListener('click', () => {
    if (checkInput.type === 'password') {
        checkInput.type = 'text';
        toggleCheck.innerText = 'Hide';
    } else {
        checkInput.type = 'password';
        toggleCheck.innerText = 'Show';
    }
});
// Function to shuffle string
function shuffle(str) {
    return str.split('').sort(() => Math.random() - 0.5).join('');
}
// Function to calculate strength
function calculateStrength(pwd) {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[!@#$%^&*()_+]/.test(pwd)) score++;
    let text = '';
    let color = '';
    if (score <= 2) {
        text = 'Weak';
        color = 'var(--strength-weak)';
    } else if (score === 3 || score === 4) {
        text = 'Medium';
        color = 'var(--strength-medium)';
    } else if (score === 5) {
        text = 'Strong';
        color = 'var(--strength-strong)';
    } else {
        text = '-';
        color = 'gray';
    }
    return { text, color };
}
// Display strength
function displayStrength(pwd) {
    const { text, color } = calculateStrength(pwd);
    strengthDisplay.innerText = `Strength: ${text}`;
    strengthDisplay.style.backgroundColor = color + '33';
    strengthDisplay.style.color = color;
}
// Generate Password
function generatePassword() {
    const length = parseInt(lengthInput.value, 10);
    const num = parseInt(numPasswordsInput.value, 10);
    let chars = '';
    if (includeUpper.checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLower.checked) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers.checked) chars += '0123456789';
    if (includeSymbols.checked) chars += '!@#$%^&*()_+';
    if (chars.length === 0) {
        alert('Please select at least one character type.');
        return;
    }
    if (length < 8 || length > 64 || isNaN(length)) {
        alert('Please enter a valid password length (8-64).');
        return;
    }
    if (num < 1 || num > 10 || isNaN(num)) {
        alert('Please enter a valid number of passwords (1-10).');
        return;
    }
    if (avoidAmbiguous.checked) {
        chars = chars.replace(/[0O1lI]/g, '');
    }
    if (chars.length === 0) {
        alert('Character set is empty after exclusions.');
        return;
    }
    passwordDisplay.innerHTML = '';
    passwordDisplay.appendChild(loader);
    loader.style.display = 'block';
    setTimeout(() => {
        loader.style.display = 'none';
        passwordDisplay.classList.add('generated');
        let passwords = [];
        for (let j = 0; j < num; j++) {
            let password = '';
            for (let i = 0; i < length; i++) {
                password += chars[Math.floor(Math.random() * chars.length)];
            }
            passwords.push(password);
        }
        if (num === 1) {
            passwordDisplay.innerText = passwords[0];
            passwordDisplay.addEventListener('click', copyPassword);
            strengthDisplay.style.display = 'inline-block';
            displayStrength(passwords[0]);
        } else {
            strengthDisplay.style.display = 'none';
            let ul = document.createElement('ul');
            ul.style.listStyle = 'none';
            ul.style.padding = '0';
            passwords.forEach(pwd => {
                let li = document.createElement('li');
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                li.style.marginBottom = '10px';
                li.style.background = 'var(--input-bg)';
                li.style.padding = '5px 10px';
                li.style.borderRadius = '5px';
                li.style.border = '1px solid var(--border)';
                let span = document.createElement('span');
                span.innerText = pwd;
                span.style.flex = '1';
                span.style.cursor = 'pointer';
                span.style.userSelect = 'none';
                span.style.color = 'var(--text-primary)';
                span.addEventListener('click', () => {
                    navigator.clipboard.writeText(pwd).then(() => alert('Copied! ✅'));
                });
                let btn = document.createElement('button');
                btn.innerText = 'Copy';
                btn.style.marginLeft = '10px';
                btn.style.padding = '5px 10px';
                btn.style.borderRadius = '5px';
                btn.style.background = '#28a745';
                btn.style.color = '#fff';
                btn.style.border = 'none';
                btn.style.cursor = 'pointer';
                btn.addEventListener('click', () => {
                    navigator.clipboard.writeText(pwd).then(() => {
                        btn.innerText = 'Copied!';
                        setTimeout(() => btn.innerText = 'Copy', 2000);
                    });
                });
                li.appendChild(span);
                li.appendChild(btn);
                ul.appendChild(li);
            });
            passwordDisplay.appendChild(ul);
        }
    }, 1500);
}
// Copy Password
function copyPassword() {
    let text;
    if (passwordDisplay.innerText) {
        text = passwordDisplay.innerText;
    } else {
        const spans = passwordDisplay.querySelectorAll('span');
        if (spans.length > 0) {
            text = Array.from(spans).map(s => s.innerText).join('\n');
        } else {
            alert("Nothing to copy!");
            return;
        }
    }
    if (!text || text === "Click Generate") {
        alert("Nothing to copy!");
        return;
    }
    navigator.clipboard.writeText(text)
        .then(() => {
            alert("Password(s) copied! ✅");
            copyBtn.innerText = 'Copied!';
            setTimeout(() => {
                copyBtn.innerText = 'Copy Password(s)';
            }, 2000);
        })
        .catch(() => alert("Failed to copy."));
}
// Smart Password
smartBtn.addEventListener('click', () => smartModal.style.display = 'flex');
closeModal.addEventListener('click', () => smartModal.style.display = 'none');
window.addEventListener('click', e => { if (e.target === smartModal) smartModal.style.display = 'none'; });
modalGenerate.addEventListener('click', () => {
    const name = userNameInput.value.trim();
    const lucky = userLuckyInput.value.trim();
    const length = parseInt(lengthInput.value, 10);
    const num = parseInt(numPasswordsInput.value, 10);
    let chars = '';
    if (includeUpper.checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLower.checked) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers.checked) chars += '0123456789';
    if (includeSymbols.checked) chars += '!@#$%^&*()_+';
    if (chars.length === 0) {
        alert('Please select at least one character type.');
        return;
    }
    if (!name || !lucky) {
        alert('Please fill all fields!');
        return;
    }
    if (length < 8 || length > 64 || isNaN(length)) {
        alert('Please enter a valid password length (8-64).');
        return;
    }
    if (num < 1 || num > 10 || isNaN(num)) {
        alert('Please enter a valid number of passwords (1-10).');
        return;
    }
    if (avoidAmbiguous.checked) {
        chars = chars.replace(/[0O1lI]/g, '');
    }
    if (chars.length === 0) {
        alert('Character set is empty after exclusions.');
        return;
    }
    let base = name + lucky;
    passwordDisplay.innerHTML = '';
    passwordDisplay.classList.add('generated');
    let passwords = [];
    for (let j = 0; j < num; j++) {
        let shuffledBase = shuffle(base);
        let password = '';
        for (let i = 0; i < length; i++) {
            if (i < shuffledBase.length) {
                password += shuffledBase[i];
            } else {
                password += chars[Math.floor(Math.random() * chars.length)];
            }
        }
        passwords.push(password);
    }
    if (num === 1) {
        passwordDisplay.innerText = passwords[0];
        passwordDisplay.addEventListener('click', copyPassword);
        strengthDisplay.style.display = 'inline-block';
        displayStrength(passwords[0]);
    } else {
        strengthDisplay.style.display = 'none';
        let ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        ul.style.padding = '0';
        passwords.forEach(pwd => {
            let li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.marginBottom = '10px';
            li.style.background = 'var(--input-bg)';
            li.style.padding = '5px 10px';
            li.style.borderRadius = '5px';
            li.style.border = '1px solid var(--border)';
            let span = document.createElement('span');
            span.innerText = pwd;
            span.style.flex = '1';
            span.style.cursor = 'pointer';
            span.style.userSelect = 'none';
            span.style.color = 'var(--text-primary)';
            span.addEventListener('click', () => {
                navigator.clipboard.writeText(pwd).then(() => alert('Copied! ✅'));
            });
            let btn = document.createElement('button');
            btn.innerText = 'Copy';
            btn.style.marginLeft = '10px';
            btn.style.padding = '5px 10px';
            btn.style.borderRadius = '5px';
            btn.style.background = '#28a745';
            btn.style.color = '#fff';
            btn.style.border = 'none';
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', () => {
                navigator.clipboard.writeText(pwd).then(() => {
                    btn.innerText = 'Copied!';
                    setTimeout(() => btn.innerText = 'Copy', 2000);
                });
            });
            li.appendChild(span);
            li.appendChild(btn);
            ul.appendChild(li);
        });
        passwordDisplay.appendChild(ul);
    }
    smartModal.style.display = 'none';
    userNameInput.value = '';
    userLuckyInput.value = '';
});
// Check Password
checkBtn.addEventListener('click', () => checkModal.style.display = 'flex');
closeCheck.addEventListener('click', () => checkModal.style.display = 'none');
window.addEventListener('click', e => { if (e.target === checkModal) checkModal.style.display = 'none'; });
checkInput.addEventListener('input', () => {
    const pwd = checkInput.value.trim();
    const { text, color } = calculateStrength(pwd);
    strengthBadge.innerText = `Strength: ${text}`;
    strengthBadge.style.backgroundColor = color + '33';
    strengthBadge.style.color = color;
});
generateBtn.addEventListener('click', generatePassword);
copyBtn.addEventListener('click', copyPassword);
