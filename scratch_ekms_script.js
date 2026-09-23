let lastBotAnswer = "";

// Dynamic API URL resolver to handle localhost port variations and dev servers
function getApiUrl(endpoint) {
    if (typeof window !== 'undefined' && window.location) {
        if (window.location.protocol === 'file:' || 
           ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && 
             window.location.port !== '3000' && window.location.port !== '8888')) {
            return `http://localhost:3000${endpoint}`;
        }
    }
    return endpoint;
}
window.getApiUrl = getApiUrl;

// Detect if the chatbot is inside a widget/iframe
document.addEventListener('DOMContentLoaded', () => {
    // window !== window.parent means "I am inside an iframe!"
    if (window !== window.parent) {
        const appsMenuBtn = document.getElementById('apps-menu-btn');
        if (appsMenuBtn) {
            appsMenuBtn.style.display = 'none'; // Hides the 9-dot button
        }
    }
});

// --- SMART TYPING ANIMATION ---
window.cancelTyping = false; // Global flag to stop typing

function typeText(element, text, speed = 15, onComplete = null) {
    element.innerHTML = ""; 
    element.classList.add('typing-cursor'); 
    
    let i = 0;
    let isTag = false;
    window.cancelTyping = false; // Reset when starting new message

    function type() {
        // Stop typing immediately if the pause button was clicked
        if (window.cancelTyping) {
            element.classList.remove('typing-cursor');
            window.resetInputButtons(); 
            return; 
        }

        if (i < text.length) {
            let char = text.charAt(i);
            
            if (char === '<') isTag = true;
            if (char === '>') isTag = false;

            element.innerHTML += char;
            i++;

            if (isTag) {
                type();
            } else {
                setTimeout(type, speed);
            }
        } else {
            element.classList.remove('typing-cursor');
            window.resetInputButtons(); // Reset buttons when finished naturally
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }
    }
    
    type(); 
}

// Globals for aborting fetch requests
window.currentAbortController = null;

// The function triggered when clicking the Pause/Stop button
window.stopGenerating = function() {
    // 1. Abort the network request if it is still loading
    if (window.currentAbortController) {
        window.currentAbortController.abort();
    }
    // 2. Stop the typing animation if it is currently typing
    window.cancelTyping = true;
    // 3. Swap the buttons back
    window.resetInputButtons();
};

// Helper to reliably swap the Stop button back to Send
window.resetInputButtons = function() {
    const stopBtn = document.getElementById('stop-btn');
    const sendBtn = document.getElementById('send-btn');

    if (stopBtn) stopBtn.style.display = 'none';
    if (sendBtn) sendBtn.style.display = 'flex';
};

// Global triage session state
let chatBox = null;
let userInput = null;
let sendBtn = null;

let conversationHistory = [];
let currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
let currentSessionTitle = null;
let currentSessionMessages = [];
let currentTriageState = {
    symptom: null,
    severity: null,
    duration: null,
    associated: []
};

// Global helper to format clean, natural chat sentence
function formatChatSentence(rawText) {
    if (!rawText) return "";
    let cleaned = String(rawText).trim();
    cleaned = cleaned.replace(/^Ask\s+(?:the\s+)?(?:IP|patient|caller|user)\s*:\s*/i, '');
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1).trim();
    }
    cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
    return cleaned;
}
window.formatChatSentence = formatChatSentence;

document.addEventListener('DOMContentLoaded', () => {
    chatBox = document.getElementById('chat-box');
    userInput = document.getElementById('user-input');
    sendBtn = document.getElementById('send-btn');

    // Helper to add messages to the screen
    function appendMessage(text, sender) {
        if (!text.trim() || !chatBox) return null;
        
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);

        const textDiv = document.createElement('div');
        textDiv.classList.add('text');
        
        // Replace newlines with <br> for better formatting
        textDiv.innerHTML = text.replace(/\n/g, '<br>');

        // Only append an avatar if the sender is the user
        if (sender === 'user') {
            const avatar = document.createElement('div');
            avatar.classList.add('avatar');
            avatar.textContent = 'YOU';
            messageDiv.appendChild(textDiv);
            messageDiv.appendChild(avatar);
        } else {
            // For the bot, just append the text block without the "AI" tag
            messageDiv.appendChild(textDiv);
        }

        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        return messageDiv;
    }
    window.appendMessage = appendMessage;

    // Update Triage Stepper (1 to 5)
    function updateStepper(stage) {
        const stageOrder = ['symptom', 'severity', 'duration', 'associated', 'navigation'];
        let activeIdx = stageOrder.indexOf(stage);
        if (stage === 'decision') activeIdx = 4;

        stageOrder.forEach((st, idx) => {
            const badge = document.getElementById(`step-badge-${st}`) || 
                          (st === 'navigation' ? document.getElementById('step-badge-decision') : null) ||
                          (st === 'decision' ? document.getElementById('step-badge-navigation') : null);
            if (!badge) return;
            badge.classList.remove('active', 'completed');

            if (idx === activeIdx) {
                badge.classList.add('active');
            } else if (idx < activeIdx || (activeIdx === -1 && idx === 0)) {
                badge.classList.add('completed');
            }
        });
    }
    window.updateStepper = updateStepper;

    // Update Live Case Sheet Bar
    function updateLiveCaseBar(triageSummary, decision) {
        const liveBar = document.getElementById('live-case-bar');
        if (!liveBar) return;

        if (triageSummary && (triageSummary.symptom || triageSummary.severity || triageSummary.duration)) {
            liveBar.style.display = 'flex';
        }

        const symEl = document.getElementById('case-symptom');
        const sevEl = document.getElementById('case-severity');
        const durEl = document.getElementById('case-duration');
        const ascEl = document.getElementById('case-associated');
        const pillEl = document.getElementById('case-status-pill');

        if (symEl) symEl.textContent = triageSummary.symptom || '-';
        if (sevEl) sevEl.textContent = triageSummary.severity || '-';
        if (durEl) durEl.textContent = triageSummary.duration || '-';
        if (ascEl) {
            if (Array.isArray(triageSummary.associated) && triageSummary.associated.length > 0) {
                ascEl.textContent = triageSummary.associated.join(', ');
            } else {
                ascEl.textContent = triageSummary.associated || '-';
            }
        }

        if (pillEl) {
            pillEl.className = 'case-status-pill';
            if (decision && decision.type === 'EMERGENCY') {
                pillEl.classList.add('emergency');
                pillEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> EMERGENCY CASE (108)';
            } else if (decision && decision.type === 'ROUTINE') {
                pillEl.classList.add('routine');
                pillEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> ROUTINE CHECKUP';
            } else {
                pillEl.classList.add('evaluating');
                pillEl.textContent = 'Triage In Progress';
            }
        }
    }
    window.updateLiveCaseBar = updateLiveCaseBar;

    // Reset Call / Start New IP Triage Call
    window.startNewCall = function() {
        conversationHistory.length = 0;
        currentSessionTitle = null;
        currentSessionMessages = [];
        currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        currentTriageState = { symptom: null, severity: null, duration: null, associated: [] };

        // Reset Stepper
        updateStepper('symptom');
        
        // Hide Live Case Bar
        const liveBar = document.getElementById('live-case-bar');
        if (liveBar) liveBar.style.display = 'none';

        // Clear Chatbox and Restore Zero State Greeting
        chatBox.innerHTML = `
            <div class="zero-state-greeting">
                <h1>EKMS AI<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></h1>
                <p class="zero-state-sub" style="color: #9aa0a6; font-size: 0.95rem; margin-top: -10px; margin-bottom: 20px;">Describe how IP / IW feeling or choose a symptom below to start your triage:</p>
                <div class="starter-options-grid" id="starter-options">
                    <button type="button" class="starter-chip" onclick="handleOptionSelect('Fever')">🌡️ Fever</button>
                    <button type="button" class="starter-chip" onclick="handleOptionSelect('Headache')">🤕 Headache</button>
                    <button type="button" class="starter-chip" onclick="handleOptionSelect('Chest Pain')">❤️ Chest Pain</button>
                    <button type="button" class="starter-chip" onclick="handleOptionSelect('Gastric / Abdominal Pain')">🤢 Gastric Pain</button>
                    <button type="button" class="starter-chip" onclick="handleOptionSelect('Blood Pressure (High/Low)')">🩺 Blood Pressure</button>
                    <button type="button" class="starter-chip" onclick="handleOptionSelect('Cough & Cold')">🤧 Cough & Cold</button>
                    <button type="button" class="starter-chip" onclick="handleOptionSelect('Body Ache & Fatigue')">💪 Body Aches</button>
                </div>
            </div>
        `;
        userInput.value = '';
        if (window.resetInputButtons) window.resetInputButtons();
        userInput.focus();
    };
    window.startNewTriage = window.startNewCall;

    // Emergency 108 Connect Action
    window.connectAmbulance108 = function(e) {
        e.preventDefault();
        alert("🚨 DISPATCHING 108 EMERGENCY AMBULANCE:\n\nConnecting IP to 108 Emergency Medical Services. Advise the caller to keep the line open and stay with the patient.");
        window.location.href = "tel:108";
    };

    // Routine Facility Information Helper
    window.selectFacility = function(facName, phone = null) {
        if (phone) {
            const callConfirm = confirm(`Referral to ${facName}:\nHelpline: ${phone}\n\nWould you like to dial ${phone} for the IP?`);
            if (callConfirm) window.location.href = `tel:${phone}`;
        } else {
            alert(`🏥 Refer to ${facName}:\n\nAdvise the IP to carry their ESIC Pehchan Card/e-Pehchan card and visit during standard OPD hours for free medical consultation.`);
        }
    };

    // Function to render Decision Card (Emergency or Routine)
    function renderDecisionCard(container, decision) {
        if (!decision || !container) return;

        const isEmergency = decision.type === 'EMERGENCY';
        const cardDiv = document.createElement('div');
        cardDiv.className = `triage-decision-card ${isEmergency ? 'decision-emergency' : 'decision-routine'}`;

        let facilitiesHtml = '';
        if (isEmergency) {
            facilitiesHtml = `
                <div class="emergency-108-action">
                    <button type="button" class="btn-call-108" onclick="connectAmbulance108(event)">
                        <i class="fa-solid fa-phone"></i> CONNECT 108 EMERGENCY AMBULANCE
                    </button>
                </div>
            `;
        } else if (Array.isArray(decision.facilities)) {
            facilitiesHtml = `
                <div style="font-size: 0.85rem; font-weight: 700; color: #aaa; margin-top: 14px; text-transform: uppercase;">
                    <i class="fa-solid fa-location-dot"></i> Recommended Referral Facilities for IP:
                </div>
                <div class="facility-grid">
                    ${decision.facilities.map(fac => `
                        <div class="facility-card" onclick="selectFacility('${fac.name}', '${fac.phone || ''}')">
                            <div class="fac-header">
                                <span class="fac-icon">${fac.icon || '🏥'}</span>
                                <span class="fac-badge">${fac.badge || 'Available'}</span>
                            </div>
                            <div class="fac-name">${fac.name}</div>
                            <div class="fac-desc">${fac.desc || ''}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        cardDiv.innerHTML = `
            <div class="decision-header">
                <div class="decision-title">
                    <i class="fa-solid ${isEmergency ? 'fa-triangle-exclamation' : 'fa-hospital-user'}"></i>
                    ${isEmergency ? 'EMERGENCY MEDICAL NAVIGATION' : 'ROUTINE HEALTHCARE NAVIGATION'}
                </div>
                <span class="decision-badge">${decision.urgency || (isEmergency ? 'Critical Action' : 'Standard Care')}</span>
            </div>
            <div class="decision-reason">
                <strong>Clinical Evaluation:</strong> ${decision.reason || ''}
            </div>
            <div class="decision-advice-card ${isEmergency ? 'advice-emergency' : 'advice-routine'}">
                <i class="fa-solid fa-bullhorn"></i> <strong>Navigation Advice to IP:</strong> "${formatChatSentence(decision.agentAdviceScript || '')}"
            </div>
            ${facilitiesHtml}
        `;

        container.appendChild(cardDiv);
        cardDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    window.renderDecisionCard = renderDecisionCard;

    // Function to render clickable symptom option chips
    function renderSymptomOptions(botMsgElement, options, stage = null) {
        if (!options || !Array.isArray(options) || options.length === 0 || !botMsgElement) return;

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'symptom-options-container';

        // Check if this step is for multiple associated symptoms
        const isMultiSelect = (stage === 'associated') ||
            options.some(opt => typeof opt === 'string' && opt.toLowerCase().includes('no other symptoms')) ||
            (currentTriageState && currentTriageState.symptom && currentTriageState.severity && currentTriageState.duration && (!currentTriageState.associated || currentTriageState.associated.length === 0));

        if (isMultiSelect) {
            optionsContainer.classList.add('multi-select-container');

            const hintEl = document.createElement('div');
            hintEl.className = 'multi-select-hint';
            hintEl.innerHTML = '<i class="fa-solid fa-list-check"></i> Select one or more symptoms (turns green):';
            optionsContainer.appendChild(hintEl);

            const chipsGrid = document.createElement('div');
            chipsGrid.className = 'multi-chips-grid';

            const submitBtn = document.createElement('button');
            submitBtn.type = 'button';
            submitBtn.className = 'multi-submit-btn';
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Select symptoms to proceed</span> <i class="fa-solid fa-arrow-right"></i>';

            function updateSubmitButton() {
                const selectedChips = Array.from(chipsGrid.querySelectorAll('.option-chip.selected-green'));
                const count = selectedChips.length;

                if (count === 0) {
                    submitBtn.disabled = true;
                    submitBtn.classList.remove('ready');
                    submitBtn.innerHTML = '<span>Select symptoms to proceed</span> <i class="fa-solid fa-arrow-right"></i>';
                } else {
                    submitBtn.disabled = false;
                    submitBtn.classList.add('ready');
                    const hasNoOther = selectedChips.some(c => (c.dataset.value || '').toLowerCase().includes('no other'));
                    if (hasNoOther) {
                        submitBtn.innerHTML = '<span><i class="fa-solid fa-circle-check"></i> Continue: No other symptoms</span> <i class="fa-solid fa-arrow-right"></i>';
                    } else {
                        submitBtn.innerHTML = `<span><i class="fa-solid fa-circle-check"></i> Continue with ${count} selected symptom${count > 1 ? 's' : ''}</span> <i class="fa-solid fa-arrow-right"></i>`;
                    }
                }
            }

            options.forEach(optText => {
                if (!optText || typeof optText !== 'string') return;
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'option-chip multi-chip';
                chip.dataset.value = optText;

                const isNoOther = optText.toLowerCase().includes('no other');
                const iconClass = isNoOther ? 'fa-regular fa-circle' : 'fa-regular fa-square';

                chip.innerHTML = `
                    <span class="chip-icon"><i class="${iconClass}"></i></span>
                    <span class="chip-text">${optText}</span>
                `;

                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isSelected = chip.classList.contains('selected-green');

                    if (isNoOther) {
                        if (isSelected) {
                            chip.classList.remove('selected-green');
                            const icon = chip.querySelector('.chip-icon i');
                            if (icon) icon.className = 'fa-regular fa-circle';
                        } else {
                            // Unselect all other chips
                            chipsGrid.querySelectorAll('.option-chip').forEach(c => {
                                c.classList.remove('selected-green');
                                const isCNoOther = (c.dataset.value || '').toLowerCase().includes('no other');
                                const cIcon = c.querySelector('.chip-icon i');
                                if (cIcon) cIcon.className = isCNoOther ? 'fa-regular fa-circle' : 'fa-regular fa-square';
                            });
                            chip.classList.add('selected-green');
                            const icon = chip.querySelector('.chip-icon i');
                            if (icon) icon.className = 'fa-solid fa-circle-check';
                        }
                    } else {
                        // Unselect "no other symptoms" if selected
                        chipsGrid.querySelectorAll('.option-chip').forEach(c => {
                            if ((c.dataset.value || '').toLowerCase().includes('no other') && c.classList.contains('selected-green')) {
                                c.classList.remove('selected-green');
                                const cIcon = c.querySelector('.chip-icon i');
                                if (cIcon) cIcon.className = 'fa-regular fa-circle';
                            }
                        });

                        if (isSelected) {
                            chip.classList.remove('selected-green');
                            const icon = chip.querySelector('.chip-icon i');
                            if (icon) icon.className = 'fa-regular fa-square';
                        } else {
                            chip.classList.add('selected-green');
                            const icon = chip.querySelector('.chip-icon i');
                            if (icon) icon.className = 'fa-solid fa-square-check';
                        }
                    }

                    updateSubmitButton();
                });

                chipsGrid.appendChild(chip);
            });

            submitBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const selectedChips = Array.from(chipsGrid.querySelectorAll('.option-chip.selected-green'));
                if (selectedChips.length === 0) return;

                // Disable chips & submit button
                chipsGrid.querySelectorAll('.option-chip').forEach(c => c.disabled = true);
                submitBtn.disabled = true;
                submitBtn.classList.remove('ready');

                const selectedTexts = selectedChips.map(c => c.dataset.value);
                const combined = selectedTexts.join(', ');

                handleSend(combined);
            });

            optionsContainer.appendChild(chipsGrid);
            optionsContainer.appendChild(submitBtn);

        } else {
            // Standard single-select options (Symptom category, Severity, Duration, Decision actions)
            options.forEach(optText => {
                if (!optText || typeof optText !== 'string') return;
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'option-chip';
                chip.textContent = optText;

                chip.addEventListener('click', (e) => {
                    e.stopPropagation();

                    if (optText.includes("108") || optText.includes("Emergency Ambulance")) {
                        window.connectAmbulance108(e);
                        return;
                    }
                    if (optText.includes("Start New") || optText.includes("New Triage")) {
                        window.startNewCall();
                        return;
                    }
                    if (optText.includes("Tele-MANAS")) {
                        window.selectFacility("Tele-MANAS Mental Health Helpline", "14416");
                        return;
                    }
                    if (optText.includes("ESIC Dispensary")) {
                        window.selectFacility("ESIC Dispensary (Primary Healthcare)");
                        return;
                    }
                    if (optText.includes("ESIC Hospital")) {
                        window.selectFacility("ESIC Model / Super-Speciality Hospital");
                        return;
                    }

                    // Disable all sibling chips
                    const siblings = optionsContainer.querySelectorAll('.option-chip');
                    siblings.forEach(s => s.disabled = true);
                    chip.classList.add('selected');
                    
                    // Trigger consultation with the selected option
                    handleSend(optText);
                });

                optionsContainer.appendChild(chip);
            });
        }

        const feedbackDiv = botMsgElement.querySelector('.feedback-actions');
        if (feedbackDiv) {
            botMsgElement.insertBefore(optionsContainer, feedbackDiv);
        } else {
            botMsgElement.appendChild(optionsContainer);
        }

        optionsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    window.renderSymptomOptions = renderSymptomOptions;

    // Main function to handle sending messages (typed or option clicked)
    async function handleSend(customText = null) {
        const text = typeof customText === 'string' ? customText.trim() : userInput.value.trim();
        if (!text) return;

        // Hide zero state on first message
        const greeting = document.querySelector('.zero-state-greeting');
        if (greeting) greeting.style.display = 'none';

        // Swap to Stop button
        const sendBtnEl = document.getElementById('send-btn');
        if (sendBtnEl) sendBtnEl.style.display = 'none';
        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) stopBtn.style.display = 'flex';

        // Establish session title on the FIRST message of this consultation
        if (!currentSessionTitle) {
            currentSessionTitle = text;
        }

        // Append IP/User response
        appendMessage(text, 'user');
        conversationHistory.push({ role: 'user', content: text });
        currentSessionMessages.push({ sender: 'user', text: text });
        userInput.value = '';
        userInput.disabled = true;

        // Animated thinking indicator
        const loadingMessage = appendMessage('<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>', 'bot');

        window.currentAbortController = new AbortController();

        try {
            // Call EKMS Tele-Triage Copilot function
            const response = await fetch(getApiUrl('/.netlify/functions/chat'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: text,
                    lastAnswer: lastBotAnswer,
                    history: conversationHistory,
                    sessionId: currentSessionId,
                    currentTriage: currentTriageState
                }),
                signal: window.currentAbortController.signal
            });

            if (!response.ok) {
                let errorDetails = "";
                try {
                    const errorData = await response.json();
                    errorDetails = errorData.answer || errorData.error || response.statusText;
                } catch(e) {
                    errorDetails = response.statusText;
                }
                throw new Error(errorDetails);
            }

            const data = await response.json();

            if (loadingMessage) loadingMessage.remove();

            // 1. Update State & Stepper
            if (data.triageSummary) {
                currentTriageState = { ...currentTriageState, ...data.triageSummary };
            }
            if (data.stage) {
                updateStepper(data.stage);
            }
            updateLiveCaseBar(currentTriageState, data.decision);

            // 2. Create the Bot Message Container (Normal clean chat)
            const botMsg = document.createElement('div');
            botMsg.classList.add('message', 'bot-message');

            const textDiv = document.createElement('div');
            textDiv.classList.add('text');

            // Format as normal, clean sentence without oversized boxes or commentary
            const sentence = formatChatSentence(data.agentScript || data.answer || '');
            textDiv.innerHTML = `<div class="bot-sentence-text">${sentence}</div>`;

            botMsg.appendChild(textDiv);

            // 3. Render Next Question Options directly below the sentence
            if (data.options && data.options.length > 0) {
                renderSymptomOptions(botMsg, data.options, data.stage);
            }

            // 4. Render Decision Card if finalized
            if (data.decision) {
                renderDecisionCard(textDiv, data.decision);
            }

            chatBox.appendChild(botMsg);
            chatBox.scrollTop = chatBox.scrollHeight;

            // 5. Memory tracking & Save Session
            lastBotAnswer = sentence;
            conversationHistory.push({ role: 'assistant', content: sentence });
            currentSessionMessages.push({
                sender: 'bot',
                sentence: sentence,
                options: data.options || [],
                stage: data.stage || null,
                triageSummary: data.triageSummary || null,
                decision: data.decision || null
            });
            saveCurrentSession(data.stage, data.decision);

            // Reset input buttons
            window.resetInputButtons();

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log("Generation stopped by agent.");
                if (loadingMessage) loadingMessage.remove();
                if (typeof window.resetInputButtons === 'function') window.resetInputButtons();
                return;
            }

            console.error("Triage Execution Error:", error);
            if (loadingMessage) loadingMessage.remove();
            appendMessage("EKMS AI Alert: " + error.message, 'bot');
            if (typeof window.resetInputButtons === 'function') window.resetInputButtons();
        } finally {
            userInput.disabled = false;
            if (window.innerWidth > 768) {
                userInput.focus();
            }
        }
    }

    // Expose handleSend and starter option handler to global window
    window.handleOptionSelect = function(optionText) {
        handleSend(optionText);
    };

    // Event listeners for button click and Enter key
    sendBtn.addEventListener('click', () => handleSend());
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
});

// ---------------------------------------------------------
// SECURE LOGIN MODAL & FIREBASE AUTHENTICATION LOGIC
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyC6S7_W2V3_CEIw3DSOjOvF3vLAOFM9HHg",
  authDomain: "ai-chat-c051b.firebaseapp.com",
  projectId: "ai-chat-c051b",
  storageBucket: "ai-chat-c051b.firebasestorage.app",
  messagingSenderId: "674917328141",
  appId: "1:674917328141:web:d198e3276f42fa2e15bc44",
  measurementId: "G-3F7BVFGZ8Q"
};

// Initialize client side Firebase application if not loaded
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// DOM Interface pointers
const settingsBtn = document.getElementById('settings-btn');
const loginModal = document.getElementById('login-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginStatus = document.getElementById('login-status');

// NEW DOM Pointers for the Side Menu
const sideMenu = document.getElementById('side-menu');



// --- SIDE MENU LOGIC ---
// 1. Open the Side Menu and sync Firestore history
settingsBtn.addEventListener('click', () => {
    sideMenu.classList.add('active');
    syncFirestoreHistory();
});



// --- MODAL LOGIC ---
// 3. Open Login Modal from the Side Menu

// 4. Close Login Modal
closeModalBtn.addEventListener('click', () => {
    loginModal.classList.remove('active');
});

// Submit Authentication Request handler
loginSubmitBtn.addEventListener('click', async () => {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    
    if(!email || !password) {
        loginStatus.innerText = "Please fill in all security parameters.";
        loginStatus.style.color = "#ff4c4c";
        return;
    }

    loginStatus.innerText = "Authorizing connection link...";
    loginStatus.style.color = "var(--neon-cyan)";

    try {
        // Authenticate the user directly against Firebase Auth database system
        await auth.signInWithEmailAndPassword(email, password);
        loginStatus.innerText = "Access Authorized. Redirecting...";
        loginStatus.style.color = "#00ff7f";
        
        // Relocate screen to the dedicated admin dashboard page location
        setTimeout(() => {
            window.location.href = "/admin.html";
        }, 1000);
    } catch (error) {
        console.error("Authentication match failure:", error);
        loginStatus.innerText = "Invalid credentials profile verification.";
        loginStatus.style.color = "#ff4c4c";
    }
});



// ---------------------------------------------------------
// USER FEEDBACK LOGIC
// ---------------------------------------------------------
window.submitFeedback = async function(btnElement, rating, question, answer) {
    // Prevent clicking multiple times
    const parent = btnElement.parentElement;
    parent.querySelectorAll('.feedback-btn').forEach(b => b.style.pointerEvents = 'none');
    
    // Highlight the chosen button
    btnElement.classList.add('active');

    try {
        await fetch(getApiUrl('/.netlify/functions/rate-answer'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, answer, rating })
        });
    } catch (error) {
        console.error("Failed to save feedback:", error);
    }
};

// ---------------------------------------------------------
// PERMANENT CHAT SESSIONS & HISTORY SYSTEM (FIRESTORE + LOCAL CACHE)
// ---------------------------------------------------------

// Purge legacy flat chat history arrays so only clean, full sessions are shown
try {
    localStorage.removeItem('ekms_permanent_chat_history');
    localStorage.removeItem('esic_chat_history');
} catch(e) {}

// Retrieve persistent chat sessions from localStorage
function getStoredSessions() {
    try {
        const raw = localStorage.getItem('ekms_saved_chat_sessions');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch(e) {}
    return [];
}

// Store or update a full conversation session
function storeSessionLocally(sessionObj) {
    if (!sessionObj || !sessionObj.sessionId || !sessionObj.title) return;
    let sessions = getStoredSessions();
    const existingIdx = sessions.findIndex(s => s.sessionId === sessionObj.sessionId);
    if (existingIdx !== -1) {
        sessions[existingIdx] = sessionObj;
        if (existingIdx > 0) {
            const [item] = sessions.splice(existingIdx, 1);
            sessions.unshift(item);
        }
    } else {
        sessions.unshift(sessionObj);
    }
    if (sessions.length > 50) sessions = sessions.slice(0, 50);
    try {
        localStorage.setItem('ekms_saved_chat_sessions', JSON.stringify(sessions));
    } catch(e) {}
    renderSessionHistoryList(sessions);
}

// Save active session turn
function saveCurrentSession(stage, decision) {
    if (!currentSessionTitle) return;
    const sessionObj = {
        sessionId: currentSessionId,
        title: currentSessionTitle, // FIRST TYPED TEXT OR STARTER SYMPTOM
        timestamp: Date.now(),
        timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stage: stage || currentTriageState.stage || 'symptom',
        triageState: { ...currentTriageState },
        decision: decision || null,
        messages: JSON.parse(JSON.stringify(currentSessionMessages))
    };
    storeSessionLocally(sessionObj);
}

// Render sessions into the side menu drawer
function renderSessionHistoryList(sessions) {
    const menuContent = document.querySelector('.menu-content');
    if (!menuContent) return;

    if (!sessions || sessions.length === 0) {
        menuContent.innerHTML = '<div style="color:#888; font-size:0.9rem; text-align:center; margin-top:20px;">No chat history recorded yet</div>';
        return;
    }

    menuContent.innerHTML = '';
    
    sessions.forEach(sess => {
        if (!sess.title) return;
        const div = document.createElement('div');
        div.className = 'history-item';
        div.title = `Click to reopen chat: ${sess.title}`;
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '8px';
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <span style="color:#4285f4; font-size:0.9rem;"><i class="fa-regular fa-comment-dots"></i></span>
            <span class="hist-title" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;">${sess.title}</span>
            <span class="hist-time" style="font-size:0.72rem; color:#888; margin-left:auto;">${sess.timeStr || ''}</span>
        `;
        
        // Re-open this entire conversation when clicked!
        div.onclick = () => { 
            window.loadSession(sess.sessionId);
        };
        menuContent.appendChild(div);
    });
}

// Load and reopen a past conversation session into the chat window
window.loadSession = function(sessionId) {
    const sessions = getStoredSessions();
    const session = sessions.find(s => s.sessionId === sessionId);
    if (!session || !session.messages) return;

    if (!chatBox) chatBox = document.getElementById('chat-box');

    // 1. Restore active tracking
    currentSessionId = session.sessionId;
    currentSessionTitle = session.title;
    currentTriageState = session.triageState || { symptom: null, severity: null, duration: null, associated: [] };
    currentSessionMessages = JSON.parse(JSON.stringify(session.messages || []));

    // 2. Restore conversation memory context for LLM
    conversationHistory.length = 0;
    session.messages.forEach(m => {
        if (m.sender === 'user') {
            conversationHistory.push({ role: 'user', content: m.text });
        } else if (m.sender === 'bot') {
            conversationHistory.push({ role: 'assistant', content: m.sentence || m.text });
        }
    });

    // 3. Hide zero-state greeting
    const greeting = document.querySelector('.zero-state-greeting');
    if (greeting) greeting.style.display = 'none';

    // 4. Clear chatbox and render all messages from this session
    if (chatBox) {
        chatBox.innerHTML = '';

        session.messages.forEach((msg, idx) => {
            if (msg.sender === 'user') {
                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message', 'user-message');
                const textDiv = document.createElement('div');
                textDiv.classList.add('text');
                textDiv.innerHTML = (msg.text || '').replace(/\n/g, '<br>');
                messageDiv.appendChild(textDiv);
                chatBox.appendChild(messageDiv);
            } else if (msg.sender === 'bot') {
                const botMsg = document.createElement('div');
                botMsg.classList.add('message', 'bot-message');
                const textDiv = document.createElement('div');
                textDiv.classList.add('text');
                const cleanSent = window.formatChatSentence ? window.formatChatSentence(msg.sentence || msg.text || '') : (msg.sentence || msg.text || '');
                textDiv.innerHTML = `<div class="bot-sentence-text">${cleanSent}</div>`;
                botMsg.appendChild(textDiv);

                // If this is the last bot turn, render option chips if not decided
                const isLastBotMsg = idx >= session.messages.length - 2;
                if (isLastBotMsg && msg.options && msg.options.length > 0 && !msg.decision && window.renderSymptomOptions) {
                    window.renderSymptomOptions(botMsg, msg.options, msg.stage);
                }

                // Render decision card if present
                if (msg.decision && window.renderDecisionCard) {
                    window.renderDecisionCard(textDiv, msg.decision);
                }

                chatBox.appendChild(botMsg);
            }
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // 5. Restore Stepper and Live Case Bar
    if (window.updateStepper) window.updateStepper(session.stage || 'symptom');
    if (window.updateLiveCaseBar) window.updateLiveCaseBar(currentTriageState, session.decision);

    // 6. Close side menu
    const menu = document.getElementById('side-menu');
    if (menu) menu.classList.remove('active');
};

// Fetch permanent history from Firebase Firestore and merge sessions
let _syncHistoryRetryCount = 0;
async function syncFirestoreHistory() {
    // 1. Immediately render cached permanent sessions
    const cached = getStoredSessions();
    if (cached.length > 0) {
        renderSessionHistoryList(cached);
    }

    // 2. Query Firestore backend endpoint
    try {
        const response = await fetch(getApiUrl('/.netlify/functions/get-chat-history'));
        if (response.ok) {
            const data = await response.json();
            if (data.sessions && Array.isArray(data.sessions)) {
                _syncHistoryRetryCount = 0; // Reset on success
                // Remote Firestore is the authoritative source!
                const validSessions = [...data.sessions];
                
                // Only keep currently active uncommitted session if present
                if (currentSessionId && currentSessionTitle && !validSessions.some(s => s.sessionId === currentSessionId)) {
                    const activeLocal = cached.find(s => s.sessionId === currentSessionId);
                    if (activeLocal && activeLocal.messages && activeLocal.messages.length > 0) {
                        validSessions.unshift(activeLocal);
                    }
                }

                validSessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                try {
                    localStorage.setItem('ekms_saved_chat_sessions', JSON.stringify(validSessions));
                } catch(e) {}
                renderSessionHistoryList(validSessions);
                return;
            }
        }
    } catch (backendErr) {
        // Automatic quiet retry if server is temporarily starting up or rebooting
        if (_syncHistoryRetryCount < 2) {
            _syncHistoryRetryCount++;
            setTimeout(syncFirestoreHistory, 2500);
        }
    }

    // 3. Fallback: Client-side Firebase Firestore
    try {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            const db = firebase.firestore();
            const snapshot = await db.collection('chat_history').orderBy('timestamp', 'asc').limit(150).get();
            if (snapshot.empty) {
                // If database collection is empty, clear local list
                const validSessions = [];
                if (currentSessionId && currentSessionTitle) {
                    const activeLocal = cached.find(s => s.sessionId === currentSessionId);
                    if (activeLocal && activeLocal.messages && activeLocal.messages.length > 0) validSessions.push(activeLocal);
                }
                try {
                    localStorage.setItem('ekms_saved_chat_sessions', JSON.stringify(validSessions));
                } catch(e) {}
                renderSessionHistoryList(validSessions);
                return;
            }

            const sessionMap = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                const sId = data.sessionId || ('session_' + doc.id);
                if (!sessionMap[sId]) {
                    sessionMap[sId] = {
                        sessionId: sId,
                        title: null,
                        timestamp: data.timestamp && typeof data.timestamp.toMillis === 'function' ? data.timestamp.toMillis() : Date.now(),
                        timeStr: data.timestamp && typeof data.timestamp.toDate === 'function' 
                            ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                            : '',
                        stage: data.stage || 'symptom',
                        triageState: data.triageSummary || {},
                        decision: data.decision || null,
                        messages: []
                    };
                }
                const sess = sessionMap[sId];

                if (data.question && data.question !== 'Start Triage') {
                    if (!sess.title) {
                        sess.title = data.question;
                    }
                    sess.messages.push({ sender: 'user', text: data.question });
                }

                if (data.agentScript || data.answer) {
                    sess.messages.push({
                        sender: 'bot',
                        sentence: window.formatChatSentence ? window.formatChatSentence(data.agentScript || data.answer || '') : (data.agentScript || data.answer || ''),
                        options: data.options || [],
                        stage: data.stage,
                        triageSummary: data.triageSummary,
                        decision: data.decision
                    });
                }

                if (data.stage) sess.stage = data.stage;
                if (data.triageSummary) sess.triageState = { ...sess.triageState, ...data.triageSummary };
                if (data.decision) sess.decision = data.decision;
                if (data.timestamp && typeof data.timestamp.toMillis === 'function') {
                    sess.timestamp = data.timestamp.toMillis();
                    sess.timeStr = data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            });

            const SUB_OPTIONS = [
                'mild', 'moderate', 'severe', 'severe / acute', 'high grade', 'high', 'low grade',
                '<1 day', '<1 day (acute)', '1-3 days', '3-5 days', '>5 days', '>5 days (prolonged)',
                'with chills & rigors', 'persistent high grade', 'mild / low grade',
                'severe throbbing', 'dull / aching', 'sudden explosive (thunderclap)',
                'crushing retrosternal pressure', 'sharp pleuritic pain', 'burning / dyspeptic'
            ];

            const firestoreSessions = Object.values(sessionMap)
                .map(s => {
                    if (s.triageState && s.triageState.symptom && SUB_OPTIONS.includes(s.title.toLowerCase().trim())) {
                        s.title = s.triageState.symptom;
                    }
                    return s;
                })
                .filter(s => {
                    if (!s.title || s.messages.length === 0) return false;
                    if (s.messages.length === 1 && SUB_OPTIONS.includes(s.title.toLowerCase().trim())) return false;
                    return true;
                })
                .sort((a, b) => b.timestamp - a.timestamp);

            const validSessions = [...firestoreSessions];
            if (currentSessionId && currentSessionTitle && !validSessions.some(s => s.sessionId === currentSessionId)) {
                const activeLocal = cached.find(s => s.sessionId === currentSessionId);
                if (activeLocal && activeLocal.messages && activeLocal.messages.length > 0) validSessions.unshift(activeLocal);
            }
            validSessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            try {
                localStorage.setItem('ekms_saved_chat_sessions', JSON.stringify(validSessions));
            } catch(e) {}
            renderSessionHistoryList(validSessions);
        }
    } catch (err) {
        console.warn("Firestore history fallback notice:", err.message);
    }
}

// Sync history on startup and listen for admin delete broadcast
document.addEventListener('DOMContentLoaded', () => {
    syncFirestoreHistory();
});

window.addEventListener('storage', (e) => {
    if (e.key === 'ekms_saved_chat_sessions' || e.key === 'ekms_chat_history_cleared') {
        const cached = getStoredSessions();
        renderSessionHistoryList(cached);
        syncFirestoreHistory();
    }
});

// ---------------------------------------------------------
// UNIFIED HEADER ACTIONS (THEME & 9-DOT ADMIN)
// ---------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. 9-DOT APPS & ECOSYSTEM MENU LOGIC ---
    const appsAdminBtn = document.getElementById('apps-admin-btn');
    const appsPopup = document.getElementById('apps-popup');
    const appsMenuContainer = document.getElementById('apps-menu-container');
    const loginModal = document.getElementById('login-modal');
    const loginStatus = document.getElementById('login-status');

    window.toggleAppsMenu = function(e) {
        if (e) e.stopPropagation();
        if (appsPopup) {
            appsPopup.classList.toggle('active');
        }
    };

    document.addEventListener('click', (e) => {
        if (appsMenuContainer && !appsMenuContainer.contains(e.target) && appsPopup) {
            appsPopup.classList.remove('active');
        }
    });

    if (appsAdminBtn) {
        appsAdminBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/admin.html';
        });
    }

    // --- 2. LIGHT/DARK THEME TOGGLE LOGIC ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    
    function updateThemeStatusText() {
        const themeText = document.getElementById('theme-status-text');
        if (themeText) {
            themeText.textContent = document.body.classList.contains('light-theme') ? 'LIGHT' : 'DARK';
        }
    }

    if (themeToggleBtn && themeIcon) {
        const moonSVG = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
        const sunSVG = `
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;

        // Check user's saved preference on load
        if (localStorage.getItem('esic_theme') === 'light') {
            document.body.classList.add('light-theme');
            themeIcon.innerHTML = sunSVG;
        }
        updateThemeStatusText();

        // Handle the click with spin animation
        themeToggleBtn.addEventListener('click', () => {
            themeIcon.style.transform = 'rotate(180deg) scale(0.3)';
            themeIcon.style.opacity = '0';
            
            setTimeout(() => {
                document.body.classList.toggle('light-theme');
                
                if (document.body.classList.contains('light-theme')) {
                    themeIcon.innerHTML = sunSVG;
                    localStorage.setItem('esic_theme', 'light');
                } else {
                    themeIcon.innerHTML = moonSVG;
                    localStorage.setItem('esic_theme', 'dark');
                }
                updateThemeStatusText();
                
                themeIcon.style.transform = 'rotate(0deg) scale(1)';
                themeIcon.style.opacity = '1';
            }, 200); 
        });
    }
});

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
});

const installBtn = document.getElementById('install-app-btn');
if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            // Show the install prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
        } else {
            alert("App is already installed or your browser doesn't support installation.");
        }
    });
}