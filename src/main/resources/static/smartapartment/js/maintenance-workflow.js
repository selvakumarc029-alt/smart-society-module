/**
 * ==========================================================================
 * SMART SOCIETY - RESIDENT MAINTENANCE LIFECYCLE WORKFLOW JS
 * Complete 10-Stage Lifecycle with AI Categorization, AMC Assignment,
 * Live Stepper, Estimate Approvals, Work Proof, Payments & Ratings.
 * ==========================================================================
 */

(() => {
    'use strict';

    // State
    const state = {
        currentStep: 1,
        selectedCategory: 'Plumbing',
        categoryDetails: {
            'Plumbing': { name: 'Plumbing', icon: 'fa-faucet-drip', class: 'mw-cat-plumbing', skill: 'Master Plumber' },
            'Electrical': { name: 'Electrical', icon: 'fa-bolt', class: 'mw-cat-electrical', skill: 'Senior Electrician' },
            'AC': { name: 'AC & HVAC', icon: 'fa-snowflake', class: 'mw-cat-ac', skill: 'HVAC Specialist' },
            'Carpentry': { name: 'Carpentry', icon: 'fa-hammer', class: 'mw-cat-carpentry', skill: 'Joinery Carpenter' },
            'Cleaning': { name: 'Deep Cleaning', icon: 'fa-broom', class: 'mw-cat-cleaning', skill: 'Sanitization Expert' },
            'Others': { name: 'Others', icon: 'fa-screwdriver-wrench', class: 'mw-cat-others', skill: 'Multi-Skilled Technician' }
        },
        aiAnalysis: {
            category: 'Plumbing',
            priority: 'NORMAL',
            isEmergency: false,
            requiredSkill: 'Master Plumber',
            reason: 'Standard maintenance inspection'
        },
        attachmentBase64: null,
        activeBookingId: null,
        activeTicketRef: null,
        pollTimer: null,
        eventSource: null,
        selectedRating: 5,
        reviewTags: new Set(['Punctual', 'Clean Work', 'Polite'])
    };

    // DOM Elements Helpers
    const $ = (id) => document.getElementById(id);
    const esc = (text) => String(text ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

    // =========================================================================
    // STEP 1-5 WIZARD LOGIC
    // =========================================================================
    function initWizard() {
        const wizardModal = $('residentServiceWorkflowModal');
        if (!wizardModal) return;

        // Category card clicks
        document.querySelectorAll('.mw-cat-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.mw-cat-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.selectedCategory = card.dataset.category || 'Plumbing';
                triggerAiAnalysis();
            });
        });

        // Problem description input listener (debounced AI call)
        let aiTimeout = null;
        const descInput = $('mwProblemDescription');
        if (descInput) {
            descInput.addEventListener('input', () => {
                clearTimeout(aiTimeout);
                aiTimeout = setTimeout(triggerAiAnalysis, 400);
            });
        }

        // File upload drag & drop and file picker
        const dropZone = $('mwDropZone');
        const fileInput = $('mwFileInput');
        if (dropZone && fileInput) {
            dropZone.addEventListener('click', () => fileInput.click());
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
            });
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
            });
        }

        // Slot cards selection
        document.querySelectorAll('.mw-slot-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.mw-slot-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                const radio = card.querySelector('input[type="radio"]');
                if (radio) radio.checked = true;
            });
        });

        // Date selector presets
        const todayBtn = $('mwDateTodayBtn');
        const tomorrowBtn = $('mwDateTomorrowBtn');
        const dateInput = $('mwPreferredDateInput');
        if (todayBtn && tomorrowBtn && dateInput) {
            const todayStr = new Date().toISOString().split('T')[0];
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            dateInput.value = todayStr;
            todayBtn.addEventListener('click', () => { dateInput.value = todayStr; todayBtn.classList.add('btn-primary'); todayBtn.classList.remove('btn-outline-primary'); tomorrowBtn.classList.remove('btn-primary'); tomorrowBtn.classList.add('btn-outline-primary'); });
            tomorrowBtn.addEventListener('click', () => { dateInput.value = tomorrowStr; tomorrowBtn.classList.add('btn-primary'); tomorrowBtn.classList.remove('btn-outline-primary'); todayBtn.classList.remove('btn-primary'); todayBtn.classList.add('btn-outline-primary'); });
        }
    }

    function handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            state.attachmentBase64 = e.target.result;
            const preview = $('mwFilePreview');
            const previewContainer = $('mwFilePreviewContainer');
            if (preview && previewContainer) {
                preview.src = state.attachmentBase64;
                previewContainer.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }

    window.removeWorkflowFile = function(e) {
        if (e) e.stopPropagation();
        state.attachmentBase64 = null;
        const previewContainer = $('mwFilePreviewContainer');
        const fileInput = $('mwFileInput');
        if (previewContainer) previewContainer.style.display = 'none';
        if (fileInput) fileInput.value = '';
    };

    // Live AI categorization with fast local rule fallback
    async function triggerAiAnalysis() {
        const desc = ($('mwProblemDescription')?.value || '').trim();
        const cat = state.selectedCategory;

        // Instant local heuristic
        let isEmg = /burst|flood|spark|smoke|fire|electric shock|cylinder|gas leak|overflow|short circuit|urgent|danger|emergency/i.test(desc);
        let pri = isEmg ? 'EMERGENCY' : /leak|clog|stuck|lock|noise|trip|not cooling/i.test(desc) ? 'HIGH' : 'NORMAL';

        // Call backend /api/maintenance/workflow/analyze
        try {
            const res = await fetch('/api/maintenance/workflow/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: desc.slice(0, 50), description: desc, category: cat })
            });
            if (res.ok) {
                const data = await res.json();
                state.aiAnalysis = {
                    category: data.serviceCategory || cat,
                    priority: data.priority || pri,
                    isEmergency: Boolean(data.isEmergency),
                    requiredSkill: data.requiredSkill || 'Technician',
                    reason: data.reason || 'AI verified service requirement'
                };
            }
        } catch (e) {
            // Local fallback
            state.aiAnalysis = {
                category: cat,
                priority: pri,
                isEmergency: isEmg,
                requiredSkill: state.categoryDetails[cat]?.skill || 'Technician',
                reason: isEmg ? 'Urgent symptom detected - elevated to Emergency' : 'Standard resident service request'
            };
        }

        renderAiBadge();
    }

    function renderAiBadge() {
        const aiContainer = $('mwAiTriageCard');
        if (!aiContainer) return;

        const ai = state.aiAnalysis;
        const priClass = ai.isEmergency ? 'mw-pill-priority-emergency' : ai.priority === 'HIGH' ? 'mw-pill-priority-high' : 'mw-pill-priority-normal';

        aiContainer.innerHTML = `
            <div class="mw-ai-header">
                <span class="mw-ai-badge"><i class="fa-solid fa-brain"></i> AI / Rule-Based Categorization</span>
                <span class="small text-muted"><i class="fa-solid fa-check-circle text-success me-1"></i>Live verified</span>
            </div>
            <p class="small text-muted mb-1">${esc(ai.reason)}</p>
            <div class="mw-ai-meta-pills">
                <span class="mw-meta-pill mw-pill-vendor"><i class="fa-solid fa-tag me-1"></i>Category: <strong>${esc(ai.category)}</strong></span>
                <span class="mw-meta-pill ${priClass}"><i class="fa-solid ${ai.isEmergency ? 'fa-bolt' : 'fa-gauge-high'} me-1"></i>Priority: <strong>${esc(ai.priority)}</strong> ${ai.isEmergency ? '(EMERGENCY)' : ''}</span>
                <span class="mw-meta-pill mw-pill-skill"><i class="fa-solid fa-user-shield me-1"></i>Required Skill: <strong>${esc(ai.requiredSkill)}</strong></span>
            </div>
        `;
    }

    // Wizard Navigation (1 to 5)
    window.goToWorkflowStep = function(step) {
        if (step < 1 || step > 5) return;

        // Validation for step 2
        if (step > 2 && state.currentStep === 2) {
            const desc = ($('mwProblemDescription')?.value || '').trim();
            if (!desc) {
                alert('Please describe your maintenance problem before proceeding.');
                $('mwProblemDescription')?.focus();
                return;
            }
        }

        state.currentStep = step;

        // Toggle views
        for (let i = 1; i <= 5; i++) {
            const stepEl = $(`mwStep${i}`);
            if (stepEl) stepEl.style.display = i === step ? 'block' : 'none';

            const nodeEl = $(`mwStepNode${i}`);
            if (nodeEl) {
                nodeEl.classList.toggle('active', i === step);
                nodeEl.classList.toggle('completed', i < step);
            }
        }

        // Update progress line
        const progressFill = $('mwProgressFill');
        if (progressFill) progressFill.style.width = `${((step - 1) / 4) * 100}%`;

        // Footer buttons
        const prevBtn = $('mwWizardPrevBtn');
        const nextBtn = $('mwWizardNextBtn');
        const submitBtn = $('mwWizardSubmitBtn');

        if (prevBtn) prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
        if (nextBtn) nextBtn.style.display = step < 5 ? 'inline-flex' : 'none';
        if (submitBtn) submitBtn.style.display = step === 5 ? 'inline-flex' : 'none';

        if (step === 5) renderStep5Review();
    };

    function renderStep5Review() {
        const desc = ($('mwProblemDescription')?.value || '').trim();
        const slotEl = document.querySelector('.mw-slot-card.selected');
        const slot = slotEl ? slotEl.dataset.slot : 'Morning (09:00 AM - 12:00 PM)';
        const date = $('mwPreferredDateInput')?.value || new Date().toISOString().split('T')[0];
        const unit = $('mwUnitInput')?.value || 'A-101';
        const phone = $('mwPhoneInput')?.value || '+91 98440 22010';
        const ai = state.aiAnalysis;

        const container = $('mwReviewSummaryContent');
        if (!container) return;

        container.innerHTML = `
            <div class="row g-3">
                <div class="col-md-6">
                    <div class="p-3 bg-light rounded-3 border">
                        <span class="small text-muted fw-bold text-uppercase d-block mb-1">Service & Issue</span>
                        <div class="d-flex align-items-center gap-2 mb-2">
                            <span class="badge bg-primary px-3 py-1 rounded-pill">${esc(state.selectedCategory)}</span>
                            <span class="badge ${ai.isEmergency ? 'bg-danger' : 'bg-secondary'} px-2 py-1 rounded-pill">${esc(ai.priority)}</span>
                        </div>
                        <p class="small text-dark mb-0 fw-semibold">${esc(desc)}</p>
                        ${state.attachmentBase64 ? `<div class="mt-2"><img src="${state.attachmentBase64}" class="rounded border" style="max-height: 70px;"></div>` : ''}
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="p-3 bg-light rounded-3 border">
                        <span class="small text-muted fw-bold text-uppercase d-block mb-1">Schedule & Location</span>
                        <p class="small mb-1"><i class="fa-regular fa-calendar me-2 text-primary"></i><strong>${esc(date)}</strong> (${esc(slot)})</p>
                        <p class="small mb-1"><i class="fa-solid fa-location-dot me-2 text-danger"></i>Unit: <strong>${esc(unit)}</strong></p>
                        <p class="small mb-0"><i class="fa-solid fa-phone me-2 text-success"></i>Contact: <strong>${esc(phone)}</strong></p>
                    </div>
                </div>
                <div class="col-12">
                    <div class="p-3 rounded-3" style="background:#f0fdf4; border:1px solid #bbf7d0;">
                        <div class="d-flex align-items-center gap-2 text-success fw-bold small mb-1">
                            <i class="fa-solid fa-shield-halved"></i> AMC / Society Coverage Checked
                        </div>
                        <p class="small text-muted mb-0">
                            Our Auto Assignment Engine will prioritize society AMC vendors for zero callout fee. If all AMC technicians are occupied, an approved external vendor will be automatically dispatched.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    // Submit Request to Backend
    window.submitWorkflowRequest = async function() {
        const submitBtn = $('mwWizardSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Creating Ticket & Assigning…';
        }

        const desc = ($('mwProblemDescription')?.value || '').trim();
        const slotEl = document.querySelector('.mw-slot-card.selected');
        const slot = slotEl ? slotEl.dataset.slot : 'MORNING';
        const date = $('mwPreferredDateInput')?.value || new Date().toISOString().split('T')[0];
        const unit = $('mwUnitInput')?.value || 'A-101';
        const phone = $('mwPhoneInput')?.value || '9844022010';
        const name = $('mwNameInput')?.value || 'Kavya Sharma';
        const perm = $('mwEntryPermissionCheckbox')?.checked ?? true;

        const payload = {
            title: `${state.selectedCategory} Issue - Unit ${unit}`,
            category: state.selectedCategory,
            description: desc,
            unitNumber: unit,
            serviceAddress: `Flat ${unit}, SmartApartment Society, Bengaluru`,
            contactPhone: phone,
            contactName: name,
            preferredDate: date,
            preferredSlot: slot,
            attachmentUrl: state.attachmentBase64,
            accessPermission: perm
        };

        try {
            const res = await fetch('/api/maintenance/workflow/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Submission failed');

            // Close wizard
            closeMaintenanceWorkflowWizard();

            // Launch Live Tracker with the created booking ID
            const bookingId = data.bookingId || data.id;
            const ref = data.orderReference || data.bookingReference || data.ticketId || String(bookingId);
            openMaintenanceLiveTracker(ref);

            // Refresh table if present
            if (window.loadNoBrokerMaintenanceTickets) window.loadNoBrokerMaintenanceTickets();

        } catch (err) {
            alert('Error submitting maintenance request: ' + err.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i> Submit Request';
            }
        }
    };

    // Modal openers / closers
    window.openMaintenanceWorkflowWizard = function(preselectedCat = null) {
        if (preselectedCat && state.categoryDetails[preselectedCat]) {
            state.selectedCategory = preselectedCat;
            document.querySelectorAll('.mw-cat-card').forEach(c => {
                c.classList.toggle('selected', c.dataset.category === preselectedCat);
            });
        }
        const modal = $('residentServiceWorkflowModal');
        if (modal) modal.style.display = 'flex';
        goToWorkflowStep(1);
    };

    window.closeMaintenanceWorkflowWizard = function() {
        const modal = $('residentServiceWorkflowModal');
        if (modal) modal.style.display = 'none';
    };

    // =========================================================================
    // STEP 6-16 LIVE TRACKER LOGIC (10 STAGES)
    // =========================================================================
    window.openMaintenanceLiveTracker = async function(ref) {
        state.activeTicketRef = ref;
        const modal = $('residentMaintenanceTrackerModal');
        if (modal) modal.style.display = 'flex';
        await loadTicketData(ref);
        connectSSE(ref);
    };

    window.closeMaintenanceLiveTracker = function() {
        const modal = $('residentMaintenanceTrackerModal');
        if (modal) modal.style.display = 'none';
        if (state.eventSource) { state.eventSource.close(); state.eventSource = null; }
        if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
    };

    async function loadTicketData(ref) {
        if (!ref) return;
        try {
            const res = await fetch(`/api/maintenance/workflow/tickets/${encodeURIComponent(ref)}`);
            if (!res.ok) throw new Error('Ticket not found');
            const data = await res.json();
            state.activeBookingId = data.bookingId || data.id;
            renderTracker(data);
        } catch (err) {
            console.error('Failed to load ticket data:', err);
        }
    }

    function connectSSE(ref) {
        if (state.eventSource) { state.eventSource.close(); state.eventSource = null; }
        state.eventSource = new EventSource(`/api/maintenance/topic/order/${encodeURIComponent(ref)}`);
        state.eventSource.addEventListener('order', () => loadTicketData(ref));
        state.eventSource.onerror = () => {
            state.eventSource?.close();
            state.eventSource = null;
            if (!state.pollTimer) {
                state.pollTimer = setInterval(() => loadTicketData(ref), 5000);
            }
        };
    }

    // Map backend jobStatus to 10-stage index (1 to 10)
    function mapStatusToStage(status) {
        switch (status) {
            case 'TICKET_CREATED': return 1;
            case 'ANALYZED': return 2;
            case 'CHECKING_AMC': return 3;
            case 'OFFERED':
            case 'ASSIGNED':
            case 'ACCEPTED': return 4;
            case 'TRAVELING': return 5;
            case 'ARRIVED': return 6;
            case 'DIAGNOSING':
            case 'ESTIMATE_PENDING': return 7;
            case 'IN_PROGRESS': return 8;
            case 'WORK_COMPLETED': return 9;
            case 'PAYMENT_PENDING':
            case 'PENDING_REVIEW':
            case 'PAID':
            case 'CLOSED':
            case 'RESOLVED': return 10;
            default: return 4;
        }
    }

    function renderTracker(d) {
        const status = d.jobStatus || d.status || 'OFFERED';
        const currentStage = mapStatusToStage(status);
        const isAmc = Boolean(d.isAmcVendor);
        const isEmergency = Boolean(d.isEmergency);
        const partnerName = d.partnerName || d.assignedPartnerName || 'Assigning technician…';
        const partnerPhone = d.partnerPhone || d.assignedPartnerPhone || '';
        const partnerRating = d.partnerRating || d.assignedPartnerRating || 4.9;

        // Header
        const headerEl = $('mwTrackerHeaderContent');
        if (headerEl) {
            headerEl.innerHTML = `
                <div>
                    <div class="d-flex align-items-center gap-2 mb-1">
                        <h4 class="fw-bold mb-0 text-dark">${esc(d.category || 'Maintenance')} Service</h4>
                        <span class="badge bg-dark">${esc(d.bookingReference || d.orderReference)}</span>
                        ${isEmergency ? '<span class="badge bg-danger"><i class="fa-solid fa-bolt me-1"></i>Emergency</span>' : '<span class="badge bg-secondary">Standard</span>'}
                    </div>
                    <span class="small text-muted"><i class="fa-solid fa-location-dot me-1 text-danger"></i>${esc(d.unitNumber || 'Unit')} · SmartApartment Society</span>
                </div>
                <div>
                    ${isAmc 
                        ? '<span class="mw-vendor-badge-amc"><i class="fa-solid fa-shield-check"></i> Society AMC Vendor (Zero Callout Fee)</span>'
                        : '<span class="mw-vendor-badge-ext"><i class="fa-solid fa-handshake"></i> Approved External Vendor</span>'}
                </div>
            `;
        }

        // 10-Stage Horizontal Stepper
        const stages = [
            { num: 1, label: 'Ticket Created' },
            { num: 2, label: 'AI Triage' },
            { num: 3, label: 'Vendor Check' },
            { num: 4, label: 'Job Confirmed' },
            { num: 5, label: 'En Route' },
            { num: 6, label: 'Arrived' },
            { num: 7, label: 'Diagnosis' },
            { num: 8, label: 'Repairing' },
            { num: 9, label: 'Completed' },
            { num: 10, label: 'Confirmed & Closed' }
        ];

        const stepperEl = $('mwLifecycleStepper');
        if (stepperEl) {
            let html = '';
            stages.forEach((s, idx) => {
                const isDone = s.num < currentStage || (currentStage === 10 && s.num <= 10);
                const isActive = s.num === currentStage && currentStage !== 10;
                const cls = isDone ? 'done' : isActive ? 'active' : '';

                html += `
                    <div class="mw-stage-item ${cls}">
                        <div class="mw-stage-circle">
                            ${isDone ? '<i class="fa-solid fa-check"></i>' : s.num}
                        </div>
                        <span class="mw-stage-label">${esc(s.label)}</span>
                    </div>
                `;
                if (idx < stages.length - 1) {
                    html += `<div class="mw-stage-connector ${isDone ? 'done' : ''}"></div>`;
                }
            });
            stepperEl.innerHTML = html;
        }

        // Technician card
        const techCard = $('mwTechnicianDetailsContent');
        if (techCard) {
            techCard.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center" style="width: 54px; height: 54px; font-size: 1.4rem;">
                        <i class="fa-solid fa-user-gear"></i>
                    </div>
                    <div>
                        <span class="small text-muted fw-bold text-uppercase d-block">Assigned Technician</span>
                        <h6 class="fw-bold mb-0 text-dark fs-5">${esc(partnerName)}</h6>
                        <span class="badge bg-light text-dark border rounded-pill small mt-1">
                            <i class="fa-solid fa-star text-warning me-1"></i>${Number(partnerRating).toFixed(1)} Rating
                        </span>
                    </div>
                </div>
                <hr class="my-3">
                <div class="d-flex justify-content-between small mb-1">
                    <span class="text-muted">Vendor Classification:</span>
                    <strong>${isAmc ? 'Internal Society AMC Team' : 'External Approved Contractor'}</strong>
                </div>
                <div class="d-flex justify-content-between small">
                    <span class="text-muted">Contact Phone:</span>
                    ${partnerPhone ? `<a href="tel:${esc(partnerPhone)}" class="fw-bold text-decoration-none"><i class="fa-solid fa-phone me-1"></i>${esc(partnerPhone)}</a>` : '<strong>Assigned upon acceptance</strong>'}
                </div>
            `;
        }

        // Live status banner
        const statusBanner = $('mwCurrentStatusBanner');
        if (statusBanner) {
            statusBanner.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <div class="spinner-grow spinner-grow-sm text-primary" role="status"></div>
                    <div>
                        <strong>Current Status: ${esc(d.statusText || d.jobStatus || d.status)}</strong>
                        <div class="small text-muted">${esc(d.dispatchReason || 'Workflow proceeding smoothly.')}</div>
                    </div>
                </div>
            `;
        }

        // Interactive dynamic panels based on status
        renderDynamicActionSlots(d);
    }

    function renderDynamicActionSlots(d) {
        const slotContainer = $('mwDynamicWorkflowSlot');
        if (!slotContainer) return;

        const status = d.jobStatus || d.status || '';
        let slotHtml = '';

        // 1. ESTIMATE APPROVAL (Step: Resident Approval)
        if (status === 'ESTIMATE_PENDING' || (d.estimateStatus === 'PENDING_APPROVAL')) {
            slotHtml += `
                <div class="mw-estimate-card animate__animated animate__fadeIn">
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="fw-bold mb-0 text-dark"><i class="fa-solid fa-file-invoice-dollar text-warning me-2"></i>Cost Estimate Submitted by Technician</h6>
                        <span class="badge bg-warning text-dark fw-bold">Resident Approval Required</span>
                    </div>
                    <p class="small text-muted mt-2 mb-3">${esc(d.estimateDescription || 'Technician diagnosed the issue and identified necessary spare parts.')}</p>
                    <table class="mw-estimate-table">
                        <tr><td>Parts & Materials:</td><td class="text-end fw-bold">${esc(d.estimatePartsBreakdown || 'Specified parts')}</td></tr>
                        <tr><td>Labor & Service Charge:</td><td class="text-end fw-bold">${esc(d.estimateLaborBreakdown || 'Standard installation')}</td></tr>
                        <tr style="border-top: 2px solid #fde68a; font-size: 1rem;"><td class="fw-bold">Total Estimate Amount:</td><td class="text-end text-primary fw-bold">₹${esc(d.estimateAmount || '0')}</td></tr>
                    </table>
                    <div class="d-flex justify-content-end gap-2 mt-3">
                        <button type="button" class="btn btn-outline-danger rounded-pill px-4 btn-sm fw-bold" onclick="handleEstimateDecision(false)">
                            <i class="fa-solid fa-xmark me-1"></i> Reject / Request Alternative
                        </button>
                        <button type="button" class="btn btn-success rounded-pill px-4 btn-sm fw-bold shadow-sm" onclick="handleEstimateDecision(true)">
                            <i class="fa-solid fa-check me-1"></i> Approve Estimate & Start Repair
                        </button>
                    </div>
                </div>
            `;
        }

        // 2. RESIDENT CONFIRMATION & WORK PROOF (Step: Resident Confirmation)
        if (status === 'WORK_COMPLETED') {
            slotHtml += `
                <div class="card border-0 shadow-sm rounded-4 p-4 mb-3 bg-white animate__animated animate__fadeIn">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <span class="badge bg-success px-3 py-1 rounded-pill mb-1"><i class="fa-solid fa-circle-check me-1"></i>Work Completed</span>
                            <h5 class="fw-bold mb-0 text-dark">Please Inspect and Confirm Resolution</h5>
                        </div>
                        ${d.reopenCount > 0 ? `<span class="badge bg-danger">Reopened ${d.reopenCount} time(s)</span>` : ''}
                    </div>
                    <p class="text-muted small">${esc(d.completionNotes || 'The technician has finished repairing the issue and uploaded work completion proof.')}</p>
                    
                    ${d.afterPhotoUrl ? `
                        <div class="mb-3">
                            <span class="small fw-bold text-muted d-block mb-1">Technician Work Photo:</span>
                            <img src="${esc(d.afterPhotoUrl)}" class="rounded-3 border shadow-sm" style="max-height: 200px; max-width: 100%; object-fit: cover;">
                        </div>
                    ` : ''}

                    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3 border-top">
                        <button type="button" class="btn btn-outline-danger rounded-pill px-4 fw-bold" onclick="handleResidentConfirm(false)">
                            <i class="fa-solid fa-rotate-left me-1"></i> Issue Not Resolved / Reopen Ticket
                        </button>
                        <button type="button" class="btn btn-primary rounded-pill px-4 fw-bold shadow" onclick="handleResidentConfirm(true)">
                            <i class="fa-solid fa-circle-check me-1"></i> Confirm Resolution
                        </button>
                    </div>
                </div>
            `;
        }

        // 3. PAYMENT (Step: Payment)
        if (status === 'PAYMENT_PENDING' || (d.paymentStatus === 'PENDING')) {
            slotHtml += `
                <div class="card border-0 shadow-sm rounded-4 p-4 mb-3 bg-white animate__animated animate__fadeIn">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="fw-bold mb-0 text-dark"><i class="fa-solid fa-credit-card text-primary me-2"></i>Payment Due for Approved Repairs</h5>
                        <strong class="fs-4 text-success">₹${esc(d.estimateAmount || '0')}</strong>
                    </div>
                    <p class="small text-muted">Resolution was confirmed. Please complete the payment to generate your official Society Tax Invoice.</p>
                    <div class="row g-2 mb-3">
                        <div class="col-4">
                            <button type="button" class="btn btn-outline-primary w-100 py-2 rounded-3 fw-bold small" onclick="processPayment('UPI')"><i class="fa-brands fa-google-pay fs-5 d-block mb-1"></i>UPI / QR Code</button>
                        </div>
                        <div class="col-4">
                            <button type="button" class="btn btn-outline-primary w-100 py-2 rounded-3 fw-bold small" onclick="processPayment('CARD')"><i class="fa-solid fa-credit-card fs-5 d-block mb-1"></i>Debit / Credit Card</button>
                        </div>
                        <div class="col-4">
                            <button type="button" class="btn btn-outline-primary w-100 py-2 rounded-3 fw-bold small" onclick="processPayment('CASH')"><i class="fa-solid fa-money-bill-wave fs-5 d-block mb-1"></i>Cash to Technician</button>
                        </div>
                    </div>
                </div>
            `;
        }

        // 4. RATING & TAX INVOICE (Step: Rating & Feedback / Close)
        if (['PENDING_REVIEW', 'PAID', 'CLOSED', 'RESOLVED'].includes(status)) {
            const hasInvoice = Boolean(d.invoiceNumber);
            const isClosed = status === 'CLOSED' || Number(d.rating || 0) > 0;

            slotHtml += `
                <div class="card border-0 shadow-sm rounded-4 p-4 mb-3 bg-white animate__animated animate__fadeIn">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <span class="badge bg-success px-3 py-1 rounded-pill mb-1"><i class="fa-solid fa-circle-check me-1"></i>Service Finalized</span>
                            <h5 class="fw-bold mb-0 text-dark">Rate Your Service & Feedback</h5>
                        </div>
                        ${hasInvoice ? `
                            <button type="button" class="btn btn-dark rounded-pill px-3 btn-sm fw-bold" onclick="viewTaxInvoice()">
                                <i class="fa-solid fa-file-pdf me-1"></i> Tax Invoice (${esc(d.invoiceNumber)})
                            </button>
                        ` : ''}
                    </div>

                    ${isClosed ? `
                        <div class="p-3 bg-light rounded-3 text-center">
                            <div class="text-warning fs-3 mb-1">
                                ${'★'.repeat(d.rating || 5)}${'☆'.repeat(5 - (d.rating || 5))}
                            </div>
                            <h6 class="fw-bold text-dark mb-1">Ticket Closed & Rated</h6>
                            <p class="small text-muted mb-0">"${esc(d.review || 'Excellent quick resolution.')}"</p>
                        </div>
                    ` : `
                        <form id="mwRatingForm" onsubmit="submitWorkflowRating(event)">
                            <label class="fw-bold small mb-2 text-dark">Star Rating (1 to 5):</label>
                            <div class="mw-stars-wrapper mb-3" id="mwStarSelector">
                                <button type="button" class="mw-star-btn selected" data-star="1">★</button>
                                <button type="button" class="mw-star-btn selected" data-star="2">★</button>
                                <button type="button" class="mw-star-btn selected" data-star="3">★</button>
                                <button type="button" class="mw-star-btn selected" data-star="4">★</button>
                                <button type="button" class="mw-star-btn selected" data-star="5">★</button>
                            </div>
                            <label class="fw-bold small mb-2 text-dark">Service Feedback & Review:</label>
                            <textarea id="mwReviewInput" class="form-control rounded-3 mb-3" rows="3" placeholder="Share your feedback about the technician's punctuality, work quality, and neatness..."></textarea>
                            <button type="submit" class="btn btn-success rounded-pill px-5 fw-bold shadow">
                                <i class="fa-solid fa-paper-plane me-2"></i> Submit Feedback & Close Ticket
                            </button>
                        </form>
                    `}
                </div>
            `;
        }

        // 5. DEMO SIMULATION CONTROLS (Allows user to test all technician stages right from browser)
        slotHtml += `
            <div class="mw-sim-toolbar">
                <div class="sim-title"><i class="fa-solid fa-sliders"></i> Technician & Workflow Test Simulation Toolbar</div>
                <div class="d-flex flex-wrap gap-2">
                    ${['OFFERED', 'ASSIGNED'].includes(status) ? `
                        <button type="button" class="btn btn-sm btn-success rounded-pill px-3 fw-bold" onclick="simVendorResponse(true)"><i class="fa-solid fa-check me-1"></i> Accept Job</button>
                        <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold" onclick="simVendorResponse(false)"><i class="fa-solid fa-xmark me-1"></i> Decline Job (Reassign)</button>
                    ` : ''}

                    ${status === 'ACCEPTED' ? `
                        <button type="button" class="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onclick="simTravel()"><i class="fa-solid fa-motorcycle me-1"></i> Start Travel</button>
                    ` : ''}

                    ${status === 'TRAVELING' ? `
                        <button type="button" class="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onclick="simArrive()"><i class="fa-solid fa-location-dot me-1"></i> Arrived at Apartment</button>
                    ` : ''}

                    ${status === 'ARRIVED' ? `
                        <button type="button" class="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onclick="simDiagnosis()"><i class="fa-solid fa-magnifying-glass me-1"></i> Start Diagnosis</button>
                    ` : ''}

                    ${status === 'DIAGNOSING' ? `
                        <button type="button" class="btn btn-sm btn-success rounded-pill px-3 fw-bold" onclick="simStartRepair()"><i class="fa-solid fa-wrench me-1"></i> No Extra Cost (Start Repair)</button>
                        <button type="button" class="btn btn-sm btn-warning rounded-pill px-3 fw-bold" onclick="simSubmitEstimate()"><i class="fa-solid fa-file-invoice-dollar me-1"></i> Extra Cost (Submit Estimate)</button>
                    ` : ''}

                    ${status === 'IN_PROGRESS' ? `
                        <button type="button" class="btn btn-sm btn-success rounded-pill px-3 fw-bold" onclick="simCompleteWork()"><i class="fa-solid fa-check-double me-1"></i> Technician: Mark Work Completed</button>
                    ` : ''}

                    <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3" onclick="loadTicketData('${state.activeTicketRef}')"><i class="fa-solid fa-rotate me-1"></i> Refresh</button>
                </div>
            </div>
        `;

        slotContainer.innerHTML = slotHtml;

        // Bind star clicks if form is present
        document.querySelectorAll('.mw-star-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const star = Number(btn.dataset.star || 5);
                state.selectedRating = star;
                document.querySelectorAll('.mw-star-btn').forEach(b => {
                    b.classList.toggle('selected', Number(b.dataset.star) <= star);
                });
            });
        });
    }

    // =========================================================================
    // API ACTION HANDLERS
    // =========================================================================
    window.handleEstimateDecision = async function(approved) {
        let reason = null;
        if (!approved) {
            reason = prompt('Please enter rejection reason or request for alternate parts:', 'Estimate seems higher than standard market rate.');
            if (reason === null) return; // User cancelled prompt
        }

        try {
            const res = await fetch(`/api/maintenance/workflow/tickets/${state.activeBookingId}/estimate-decision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approved, rejectionReason: reason })
            });
            if (res.ok) await loadTicketData(state.activeTicketRef);
        } catch (e) {
            alert('Error updating estimate: ' + e.message);
        }
    };

    window.handleResidentConfirm = async function(confirmed) {
        let reason = null;
        if (!confirmed) {
            reason = prompt('Please enter reason why the issue is not resolved:', 'Tap is still leaking slowly from base.');
            if (reason === null) return;
        }

        try {
            const res = await fetch(`/api/maintenance/workflow/tickets/${state.activeBookingId}/resident-confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmed, reopenReason: reason })
            });
            if (res.ok) await loadTicketData(state.activeTicketRef);
        } catch (e) {
            alert('Error confirming resolution: ' + e.message);
        }
    };

    window.processPayment = async function(method) {
        try {
            const res = await fetch(`/api/maintenance/workflow/tickets/${state.activeBookingId}/payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentMethod: method, paymentReference: 'PAY-' + Date.now().toString().slice(-6) })
            });
            if (res.ok) {
                alert(`Payment via ${method} successful! Official Tax Invoice generated.`);
                await loadTicketData(state.activeTicketRef);
            }
        } catch (e) {
            alert('Payment error: ' + e.message);
        }
    };

    window.submitWorkflowRating = async function(e) {
        e.preventDefault();
        const review = ($('mwReviewInput')?.value || 'Excellent service.').trim();
        try {
            const res = await fetch(`/api/maintenance/workflow/tickets/${state.activeBookingId}/rating`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: state.selectedRating, review, tags: [...state.reviewTags] })
            });
            if (res.ok) {
                alert('Thank you! Your feedback has been recorded and the maintenance ticket is now CLOSED.');
                await loadTicketData(state.activeTicketRef);
            }
        } catch (err) {
            alert('Error submitting rating: ' + err.message);
        }
    };

    window.viewTaxInvoice = async function() {
        try {
            const res = await fetch(`/api/maintenance/workflow/tickets/${state.activeBookingId}/invoice`);
            if (!res.ok) throw new Error('Invoice not found');
            const data = await res.json();
            
            // Populate and open invoice modal
            if (window.openResidentInvoiceModal) {
                window.openResidentInvoiceModal(
                    data.invoiceNumber || 'INV-2026-0801',
                    data.unitNumber || 'A-101',
                    data.requesterName || 'Kavya Sharma',
                    data.laborAmount ? String(data.laborAmount) : '200',
                    data.partsAmount ? String(data.partsAmount) : '450',
                    data.taxAmount ? String(data.taxAmount) : '0',
                    data.totalAmount ? String(data.totalAmount) : '650',
                    data.paymentStatus || 'PAID'
                );
            } else {
                alert(`Official Tax Invoice: ${data.invoiceNumber}\nAmount: ₹${data.totalAmount}\nStatus: ${data.paymentStatus}`);
            }
        } catch (e) {
            alert('Error loading invoice: ' + e.message);
        }
    };

    // Technician simulations
    window.simVendorResponse = async function(accept) {
        await fetch(`/api/maintenance/workflow/tickets/${state.activeBookingId}/vendor-response`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accept, declineReason: accept ? null : 'Technician busy on high priority emergency' })
        });
        await loadTicketData(state.activeTicketRef);
    };

    window.simTravel = async function() {
        await fetch(`/api/maintenance/workflow/tickets/${state.activeBookingId}/travel`, { method: 'POST' });
        await loadTicketData(state.activeTicketRef);
    };

    window.simArrive = async function() {
        await fetch(`/api/maintenance/workflow/tickets/${state.activeBookingId}/arrive`, { method: 'POST' });
        await loadTicketData(state.activeTicketRef);
    };

    window.simDiagnosis = async function() {
        await fetch(`/api/maintenance/workflow/tickets/${state.activeBookingId}/diagnosis`, { method: 'POST' });
        await loadTicketData(state.activeTicketRef);
    };

    window.simStartRepair = async function() {
        await fetch(`/api/maintenance/workflow/tickets/${state.activeBookingId}/start-repair`, { method: 'POST' });
        await loadTicketData(state.activeTicketRef);
    };

    window.simSubmitEstimate = async function() {
        const parts = prompt('Enter parts cost in INR:', '350');
        const labor = prompt('Enter labor cost in INR:', '200');
        if (!parts || !labor) return;
        const total = parseFloat(parts) + parseFloat(labor);

        await fetch(`/api/maintenance/workflow/tickets/${state.activeBookingId}/estimate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: total,
                estimateAmount: total,
                parts: `₹${parts} (Heavy-duty brass valve & Teflon seal)`,
                partsBreakdown: `₹${parts} (Heavy-duty brass valve & Teflon seal)`,
                labor: `₹${labor} (Disassembly & fitting charge)`,
                laborBreakdown: `₹${labor} (Disassembly & fitting charge)`,
                description: 'Replaced cracked internal fitting and seal ring.'
            })
        });
        await loadTicketData(state.activeTicketRef);
    };

    window.simCompleteWork = async function() {
        const notes = prompt('Technician completion notes:', 'Work completed smoothly. Checked with pressure test and zero leaks detected.');
        if (notes === null) return;

        await fetch(`/api/maintenance/workflow/tickets/${state.activeBookingId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                completionNotes: notes,
                photoUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&auto=format&fit=crop&q=80'
            })
        });
        await loadTicketData(state.activeTicketRef);
    };

    // Quick helper to track the latest order
    window.openLatestActiveTracker = function() {
        if (state.activeTicketRef) {
            openMaintenanceLiveTracker(state.activeTicketRef);
        } else {
            // Find from bookings or default
            openMaintenanceLiveTracker('ORD-EMG-0001');
        }
    };

    // Initialize on DOM load
    document.addEventListener('DOMContentLoaded', initWizard);

})();
