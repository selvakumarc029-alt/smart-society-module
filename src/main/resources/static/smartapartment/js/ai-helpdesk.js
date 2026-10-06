(() => {
    const API_BASE = "/api/society/helpdesk";

    const getLocalHelpdeskAnswer = (question) => {
        const q = (question || "").toLowerCase();
        if (q.includes("bill") || q.includes("pay") || q.includes("due") || q.includes("fee") || q.includes("maintenance bill")) {
            return {
                answer: "💳 **Maintenance Billing & Invoices**\nYou can view your pending society dues, download past receipts, and pay online through the **Society Bills** portal.",
                category: "Billing & Accounts",
                suggestedTeam: "Accounts Team",
                priority: "MEDIUM",
                quickLinks: [{ label: "Pay Bills / Invoices", target: "/society/bills" }],
                canCreateTicket: false
            };
        }
        if (q.includes("visitor") || q.includes("guest") || q.includes("entry") || q.includes("pass") || q.includes("delivery")) {
            return {
                answer: "🚗 **Visitor & Gate Pass Management**\nResidents can pre-authorize visitor entries, share digital QR passes, and track delivery entries seamlessly in the **Visitor Passes** section.",
                category: "Security & Gates",
                suggestedTeam: "Security Desk",
                priority: "LOW",
                quickLinks: [{ label: "Visitor Passes", target: "/society/visitors" }],
                canCreateTicket: false
            };
        }
        if (q.includes("amenit") || q.includes("club") || q.includes("pool") || q.includes("gym") || q.includes("hall") || q.includes("book")) {
            return {
                answer: "🏊 **Clubhouse & Amenity Bookings**\nReserve society amenities including the clubhouse, swimming pool, badminton court, or party hall with live slot tracking.",
                category: "Amenities",
                suggestedTeam: "Facility Management",
                priority: "LOW",
                quickLinks: [{ label: "Amenity Bookings", target: "/society/amenities" }],
                canCreateTicket: false
            };
        }
        if (q.includes("leak") || q.includes("plumb") || q.includes("pipe") || q.includes("water") || q.includes("drain") || q.includes("tap")) {
            return {
                answer: "🔧 **Plumbing & Water Support**\nFor water leaks or pipe damages, turn off the nearest stopcock if accessible. You can raise a priority maintenance ticket below for immediate worker dispatch.",
                category: "Plumbing",
                suggestedTeam: "Plumbing Maintenance",
                priority: "HIGH",
                canCreateTicket: true
            };
        }
        if (q.includes("power") || q.includes("electric") || q.includes("fuse") || q.includes("light") || q.includes("spark") || q.includes("wiring")) {
            return {
                answer: "⚡ **Electrical Service Support**\nPlease stay clear of any sparking points. Check your unit MCB switchboard first. You can raise a ticket for our on-duty electrician to visit.",
                category: "Electrical",
                suggestedTeam: "Electrical Maintenance",
                priority: "HIGH",
                canCreateTicket: true
            };
        }
        if (q.includes("lift") || q.includes("elevator") || q.includes("stuck")) {
            return {
                answer: "🚨 **Elevator Emergency Support**\nElevator breakdown teams and security are alerted. For emergencies, press the in-cabin alarm or call the security intercom directly.",
                category: "Elevator / Lift",
                suggestedTeam: "Emergency Dispatch",
                priority: "URGENT",
                canCreateTicket: true
            };
        }
        return {
            answer: "🤖 **AI Helpdesk Assistant**\nI'm ready to assist you with maintenance work orders, bill payments, amenity reservations, and guest passes. You can also raise a support ticket directly below.",
            category: "General Support",
            suggestedTeam: "Society Helpdesk",
            priority: "NORMAL",
            quickLinks: [
                { label: "Pay Bills", target: "/society/bills" },
                { label: "Guest Entry", target: "/society/visitors" }
            ],
            canCreateTicket: true
        };
    };

    const request = async (path, body) => {
        try {
            const response = await fetch(`${API_BASE}${path}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify(body)
            });

            const contentType = response.headers.get("content-type") || "";
            if (response.redirected || !contentType.includes("application/json")) {
                if (path === "/ask" && body && body.question) {
                    return getLocalHelpdeskAnswer(body.question);
                }
                throw new Error("Service temporarily unavailable");
            }

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (path === "/ask" && body && body.question) {
                    return getLocalHelpdeskAnswer(body.question);
                }
                throw new Error(data.message || "AI Helpdesk is currently unavailable");
            }
            if (path === "/ask" && (!data || !data.answer)) {
                return getLocalHelpdeskAnswer(body ? body.question : "");
            }
            return data;
        } catch (err) {
            if (path === "/ask" && body && body.question) {
                return getLocalHelpdeskAnswer(body.question);
            }
            throw err;
        }
    };

    const formatTimestamp = () => {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const parseSimpleMarkdown = (text) => {
        if (!text) return "";
        let formatted = String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        
        // Bold formatting **text**
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italics formatting *text*
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Linebreaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    };

    const createMessageBubble = (text, isUser = false, meta = null) => {
        const messageText = (text && String(text).trim().length > 0)
            ? String(text).trim()
            : (isUser ? "..." : "Hello! How can I assist you with maintenance, billing, or visitor passes today?");

        const wrapper = document.createElement("div");
        wrapper.className = `ai-helpdesk__message-wrapper ai-helpdesk__message-wrapper--${isUser ? "user" : "bot"}`;
        
        const bubble = document.createElement("div");
        bubble.className = "ai-helpdesk__message";
        bubble.innerHTML = parseSimpleMarkdown(messageText);
        
        wrapper.appendChild(bubble);

        if (!isUser && meta) {
            // Category & Priority Tags
            if (meta.category || meta.suggestedTeam) {
                const tagsDiv = document.createElement("div");
                tagsDiv.className = "ai-helpdesk__meta-tags";
                
                if (meta.category) {
                    const catTag = document.createElement("span");
                    catTag.className = "ai-helpdesk__tag ai-helpdesk__tag--category";
                    catTag.innerHTML = `<i class="fa-solid fa-folder-open me-1"></i>${meta.category}`;
                    tagsDiv.appendChild(catTag);
                }
                if (meta.suggestedTeam) {
                    const teamTag = document.createElement("span");
                    teamTag.className = "ai-helpdesk__tag ai-helpdesk__tag--team";
                    teamTag.innerHTML = `<i class="fa-solid fa-users me-1"></i>${meta.suggestedTeam}`;
                    tagsDiv.appendChild(teamTag);
                }
                if (meta.priority) {
                    const prioTag = document.createElement("span");
                    prioTag.className = `ai-helpdesk__tag ai-helpdesk__tag--priority-${meta.priority}`;
                    prioTag.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-1"></i>${meta.priority}`;
                    tagsDiv.appendChild(prioTag);
                }
                wrapper.appendChild(tagsDiv);
            }

            // Quick Links & Ticket Button
            const actionsDiv = document.createElement("div");
            actionsDiv.className = "ai-helpdesk__msg-actions";
            let hasActions = false;

            if (meta.quickLinks && meta.quickLinks.length > 0) {
                meta.quickLinks.forEach(link => {
                    hasActions = true;
                    const a = document.createElement("a");
                    a.className = "ai-helpdesk__msg-btn";
                    a.href = link.target || "#";
                    a.innerHTML = `<i class="fa-solid fa-arrow-right me-1"></i>${link.label}`;
                    a.addEventListener("click", (e) => {
                        if (link.target.startsWith("#")) {
                            e.preventDefault();
                            const targetEl = document.querySelector(link.target);
                            if (targetEl) {
                                targetEl.scrollIntoView({ behavior: 'smooth' });
                            } else {
                                window.location.hash = link.target;
                            }
                        }
                    });
                    actionsDiv.appendChild(a);
                });
            }

            if (meta.canCreateTicket) {
                hasActions = true;
                const ticketBtn = document.createElement("button");
                ticketBtn.type = "button";
                ticketBtn.className = "ai-helpdesk__msg-btn ai-helpdesk__msg-btn--ticket";
                ticketBtn.innerHTML = `<i class="fa-solid fa-ticket me-1"></i>Raise Ticket`;
                ticketBtn.addEventListener("click", () => handleCreateTicket(meta.lastQuestion, ticketBtn, wrapper));
                actionsDiv.appendChild(ticketBtn);
            }

            if (hasActions) {
                wrapper.appendChild(actionsDiv);
            }
        }

        const timeSpan = document.createElement("span");
        timeSpan.className = "ai-helpdesk__time";
        timeSpan.textContent = formatTimestamp();
        wrapper.appendChild(timeSpan);

        return wrapper;
    };

    const createTypingIndicator = () => {
        const typingWrapper = document.createElement("div");
        typingWrapper.className = "ai-helpdesk__message-wrapper ai-helpdesk__message-wrapper--bot";
        typingWrapper.id = "aiHelpdeskTyping";
        typingWrapper.innerHTML = `
            <div class="ai-helpdesk__typing">
                <span></span><span></span><span></span>
            </div>
        `;
        return typingWrapper;
    };

    let lastUserQuestion = "";
    let messagesContainer;
    let inputField;
    let sendBtn;

    const scrollToBottom = () => {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    };

    const handleCreateTicket = async (question, ticketBtn, wrapper) => {
        if (!question) return;
        ticketBtn.disabled = true;
        ticketBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i>Creating Ticket...`;
        
        try {
            const result = await request("/tickets", { question });
            ticketBtn.remove();
            
            const confirmDiv = document.createElement("div");
            confirmDiv.className = "ai-helpdesk__meta-tags mt-2";
            confirmDiv.innerHTML = `
                <span class="ai-helpdesk__tag ai-helpdesk__tag--category" style="background:#dcfce7; color:#15803d; font-size:0.8rem; padding:6px 10px;">
                    <i class="fa-solid fa-circle-check me-1"></i>${result.message}
                </span>
            `;
            wrapper.appendChild(confirmDiv);
            scrollToBottom();
        } catch (error) {
            ticketBtn.disabled = false;
            ticketBtn.innerHTML = `<i class="fa-solid fa-ticket me-1"></i>Try Again`;
            const errWrapper = createMessageBubble(`❌ Failed to create ticket: ${error.message}`, false);
            messagesContainer.appendChild(errWrapper);
            scrollToBottom();
        }
    };

    const handleSendQuestion = async (questionText) => {
        const text = questionText || inputField.value.trim();
        if (!text) return;

        lastUserQuestion = text;
        if (inputField) inputField.value = "";
        
        // Add User Message
        const userMsgWrapper = createMessageBubble(text, true);
        messagesContainer.appendChild(userMsgWrapper);
        scrollToBottom();

        // Add Typing Indicator
        const typingEl = createTypingIndicator();
        messagesContainer.appendChild(typingEl);
        scrollToBottom();

        if (sendBtn) sendBtn.disabled = true;

        try {
            const data = await request("/ask", { question: text });
            
            // Remove typing indicator
            const activeTyping = document.getElementById("aiHelpdeskTyping");
            if (activeTyping) activeTyping.remove();

            // Add Bot Answer
            const botMsgWrapper = createMessageBubble(data.answer, false, {
                category: data.category,
                suggestedTeam: data.suggestedTeam,
                priority: data.priority,
                slaHours: data.slaHours,
                canCreateTicket: data.canCreateTicket,
                quickLinks: data.quickLinks,
                lastQuestion: text
            });
            messagesContainer.appendChild(botMsgWrapper);
            scrollToBottom();
        } catch (error) {
            const activeTyping = document.getElementById("aiHelpdeskTyping");
            if (activeTyping) activeTyping.remove();

            const botMsgWrapper = createMessageBubble(`⚠️ ${error.message}`, false);
            messagesContainer.appendChild(botMsgWrapper);
            scrollToBottom();
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        if (!document.body.dataset.dashboardRole && !document.querySelector(".sidebar")) return;

        // Create Widget Container
        const widget = document.createElement("aside");
        widget.className = "ai-helpdesk";
        widget.hidden = true;
        widget.innerHTML = `
            <div class="ai-helpdesk__head">
                <div class="ai-helpdesk__brand">
                    <div class="ai-helpdesk__avatar">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div class="ai-helpdesk__title-group">
                        <h6 class="ai-helpdesk__title">AI Helpdesk</h6>
                        <span class="ai-helpdesk__subtitle">
                            <span class="ai-helpdesk__status-dot"></span> Online & Ready
                        </span>
                    </div>
                </div>
                <button class="ai-helpdesk__close" type="button" aria-label="Close Helpdesk">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="ai-helpdesk__body">
                <div class="ai-helpdesk__messages"></div>
                <div class="ai-helpdesk__suggestions">
                    <button class="ai-helpdesk__chip" type="button" data-prompt="Pay my maintenance bill"><i class="fa-solid fa-credit-card text-primary me-1"></i>Pay Bills</button>
                    <button class="ai-helpdesk__chip" type="button" data-prompt="Create a guest visitor pass"><i class="fa-solid fa-car text-success me-1"></i>Guest Entry</button>
                    <button class="ai-helpdesk__chip" type="button" data-prompt="Book clubhouse or amenity"><i class="fa-solid fa-swimming-pool text-info me-1"></i>Book Amenity</button>
                    <button class="ai-helpdesk__chip" type="button" data-prompt="Water pipe leakage in apartment"><i class="fa-solid fa-faucet-drip text-warning me-1"></i>Water Leak</button>
                    <button class="ai-helpdesk__chip" type="button" data-prompt="Power outage electrical issue"><i class="fa-solid fa-bolt text-danger me-1"></i>Power Issue</button>
                </div>
                <form class="ai-helpdesk__form" autocomplete="off">
                    <input class="ai-helpdesk__input" name="question" placeholder="Ask about billing, visitors, bookings..." required>
                    <button class="ai-helpdesk__send-btn" type="submit" aria-label="Send Question">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        `;

        // Create Floating Toggle Button
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "ai-helpdesk-toggle";
        toggle.setAttribute("aria-label", "Toggle AI Helpdesk");
        toggle.innerHTML = `
            <span class="ai-helpdesk-toggle__badge"></span>
            <i class="fa-solid fa-wand-magic-sparkles ai-helpdesk-toggle__icon"></i>
            <span>AI Helpdesk</span>
        `;

        document.body.append(widget, toggle);

        messagesContainer = widget.querySelector(".ai-helpdesk__messages");
        inputField = widget.querySelector(".ai-helpdesk__input");
        sendBtn = widget.querySelector(".ai-helpdesk__send-btn");

        // Initial Greeting
        const welcomeWrapper = createMessageBubble("👋 **Hello! I am your SmartSociety AI Assistant.**\nHow can I help you today? Ask me about **billing**, **visitor passes**, **amenity bookings**, or **maintenance tickets**.", false);
        messagesContainer.appendChild(welcomeWrapper);

        // Toggle Widget Event
        const toggleWidget = () => {
            const isHidden = widget.hidden;
            widget.hidden = !isHidden;
            toggle.classList.toggle("is-active", isHidden);
            if (isHidden && inputField) {
                setTimeout(() => inputField.focus(), 150);
            }
        };

        toggle.addEventListener("click", toggleWidget);
        widget.querySelector(".ai-helpdesk__close").addEventListener("click", () => {
            widget.hidden = true;
            toggle.classList.remove("is-active");
        });

        // ESC key to close widget
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !widget.hidden) {
                widget.hidden = true;
                toggle.classList.remove("is-active");
            }
        });

        // Quick Suggestion Chips Click
        widget.querySelectorAll(".ai-helpdesk__chip").forEach(chip => {
            chip.addEventListener("click", () => {
                const prompt = chip.getAttribute("data-prompt");
                if (prompt) {
                    handleSendQuestion(prompt);
                }
            });
        });

        // Submit Form Event
        widget.querySelector(".ai-helpdesk__form").addEventListener("submit", (e) => {
            e.preventDefault();
            handleSendQuestion();
        });
    });
})();
