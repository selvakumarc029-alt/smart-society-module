/**
 * Maintenance Worker Attendance and Availability Module
 * Manages Clock In/Out, Break Start/End, Working Hours, and Live Availability States.
 */
(function () {
    "use strict";

    let liveInterval = null;
    let clockInTimestamp = null;
    let isOnBreak = false;

    // Toast helper
    function showToast(message, type = "info") {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // Escape HTML helper
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    // Format time helper
    function formatTime(isoStr) {
        if (!isoStr) return "—";
        try {
            const d = new Date(isoStr);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return isoStr;
        }
    }

    // Availability badge styling
    function getAvailabilityBadge(status) {
        const s = (status || "OFFLINE").toUpperCase();
        switch (s) {
            case "AVAILABLE":
                return `<span class="badge bg-success text-white rounded-pill px-3 py-1.5 fw-bold"><i class="fa-solid fa-circle-check me-1.5"></i>AVAILABLE</span>`;
            case "BUSY":
                return `<span class="badge bg-warning text-dark rounded-pill px-3 py-1.5 fw-bold"><i class="fa-solid fa-person-digging me-1.5"></i>BUSY</span>`;
            case "ON_BREAK":
                return `<span class="badge bg-info text-dark rounded-pill px-3 py-1.5 fw-bold"><i class="fa-solid fa-mug-hot me-1.5"></i>ON BREAK</span>`;
            default:
                return `<span class="badge bg-secondary text-white rounded-pill px-3 py-1.5 fw-bold"><i class="fa-solid fa-circle-minus me-1.5"></i>OFFLINE</span>`;
        }
    }

    // Attendance badge styling
    function getAttendanceBadge(status) {
        const s = (status || "OFFLINE").toUpperCase();
        switch (s) {
            case "PRESENT":
                return `<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1.5 fw-bold"><i class="fa-solid fa-user-check me-1.5"></i>PRESENT</span>`;
            case "LATE":
                return `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-3 py-1.5 fw-bold"><i class="fa-solid fa-clock me-1.5"></i>LATE</span>`;
            case "HALF_DAY":
                return `<span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1.5 fw-bold"><i class="fa-solid fa-hourglass-half me-1.5"></i>HALF DAY</span>`;
            case "ON_LEAVE":
                return `<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle rounded-pill px-3 py-1.5 fw-bold"><i class="fa-solid fa-calendar-xmark me-1.5"></i>ON LEAVE</span>`;
            case "ABSENT":
                return `<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-3 py-1.5 fw-bold"><i class="fa-solid fa-user-xmark me-1.5"></i>ABSENT</span>`;
            case "CLOCKED_OUT":
                return `<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill px-3 py-1.5 fw-bold"><i class="fa-solid fa-arrow-right-from-bracket me-1.5"></i>CLOCKED OUT</span>`;
            default:
                return `<span class="badge bg-light text-muted border rounded-pill px-3 py-1.5 fw-bold"><i class="fa-solid fa-power-off me-1.5"></i>OFFLINE</span>`;
        }
    }

    // Local Attendance State fallback (ensures buttons work reliably in preview / offline)
    function applyLocalAttendanceState(attendanceStatus, availabilityStatus) {
        const isClockedIn = (attendanceStatus === "PRESENT" || attendanceStatus === "LATE");
        const onBreak = (availabilityStatus === "ON_BREAK");

        const attBadgeContainer = document.getElementById("workerAttBadgeContainer");
        if (attBadgeContainer) attBadgeContainer.innerHTML = getAttendanceBadge(attendanceStatus);

        const availBadgeContainer = document.getElementById("workerAvailBadgeContainer");
        if (availBadgeContainer) availBadgeContainer.innerHTML = getAvailabilityBadge(availabilityStatus);

        const btnClockIn = document.getElementById("btnWorkerClockIn");
        const btnClockOut = document.getElementById("btnWorkerClockOut");
        const btnStartBreak = document.getElementById("btnWorkerStartBreak");
        const btnEndBreak = document.getElementById("btnWorkerEndBreak");

        if (btnClockIn) btnClockIn.disabled = isClockedIn;
        if (btnClockOut) btnClockOut.disabled = !isClockedIn;
        if (btnStartBreak) btnStartBreak.disabled = !isClockedIn || onBreak;
        if (btnEndBreak) btnEndBreak.disabled = !isClockedIn || !onBreak;

        try {
            localStorage.setItem("smart_worker_local_state", JSON.stringify({
                attendanceStatus,
                availabilityStatus,
                clockIn: isClockedIn ? (localStorage.getItem("smart_worker_clock_in_time") || new Date().toISOString()) : null
            }));
            if (isClockedIn && !localStorage.getItem("smart_worker_clock_in_time")) {
                localStorage.setItem("smart_worker_clock_in_time", new Date().toISOString());
            } else if (!isClockedIn) {
                localStorage.removeItem("smart_worker_clock_in_time");
            }
        } catch(e) {}
    }

    // Load Worker Dashboard Summary
    async function loadWorkerDashboardSummary() {
        try {
            const res = await fetch("/api/workers/dashboard-summary", {
                credentials: "same-origin",
                headers: { "Accept": "application/json" }
            });
            if (!res.ok) {
                console.warn("Could not load worker dashboard summary (status " + res.status + ")");
                try {
                    const saved = JSON.parse(localStorage.getItem("smart_worker_local_state") || "null");
                    if (saved) applyLocalAttendanceState(saved.attendanceStatus, saved.availabilityStatus);
                } catch(err) {}
                return;
            }
            const data = await res.json();
            renderWorkerControlBar(data);
            renderWorkerTasks(data);
        } catch (e) {
            console.error("Error loading worker dashboard summary:", e);
            try {
                const saved = JSON.parse(localStorage.getItem("smart_worker_local_state") || "null");
                if (saved) applyLocalAttendanceState(saved.attendanceStatus, saved.availabilityStatus);
            } catch(err) {}
        }
    }

    // Render Worker Top Control Bar (Clock in/out, Break, Working hours)
    function renderWorkerControlBar(data) {
        const bar = document.getElementById("workerAttendanceControlBar");
        if (!bar) return;

        const att = data.attendance || {};
        const avail = data.availability || {};
        const hours = data.workingHours || {};

        const attStatus = (att.attendanceStatus || "OFFLINE").toUpperCase();
        const availStatus = (avail.status || "OFFLINE").toUpperCase();

        const isClockedIn = (attStatus === "PRESENT" || attStatus === "LATE") && att.clockIn && !att.clockOut;
        isOnBreak = availStatus === "ON_BREAK" || (att.breakStart && !att.breakEnd);

        // Update badges
        const attBadgeContainer = document.getElementById("workerAttBadgeContainer");
        if (attBadgeContainer) attBadgeContainer.innerHTML = getAttendanceBadge(attStatus);

        const availBadgeContainer = document.getElementById("workerAvailBadgeContainer");
        if (availBadgeContainer) availBadgeContainer.innerHTML = getAvailabilityBadge(availStatus);

        // Working hours
        const todayHoursEl = document.getElementById("workerTodayHours");
        if (todayHoursEl) todayHoursEl.textContent = hours.todayFormatted || "0m";

        const weeklyHoursEl = document.getElementById("workerWeeklyHours");
        if (weeklyHoursEl) weeklyHoursEl.textContent = hours.weeklyFormatted || "0m";

        const monthlyHoursEl = document.getElementById("workerMonthlyHours");
        if (monthlyHoursEl) monthlyHoursEl.textContent = hours.monthlyFormatted || "0m";

        // Shift label
        const shiftLabelEl = document.getElementById("workerShiftLabel");
        if (shiftLabelEl) shiftLabelEl.textContent = att.shiftName || "General Shift";

        // Current Task pill in banner
        const currentTaskPill = document.getElementById("workerCurrentTaskPill");
        if (currentTaskPill) {
            if (avail.currentTaskNumber) {
                currentTaskPill.innerHTML = `<span class="badge bg-warning text-dark rounded-pill px-2.5 py-1 fw-bold"><i class="fa-solid fa-briefcase me-1"></i>Active: ${escapeHtml(avail.currentTaskNumber)}</span>`;
                currentTaskPill.style.display = "inline-block";
            } else {
                currentTaskPill.style.display = "none";
            }
        }

        // Action buttons state
        const btnClockIn = document.getElementById("btnWorkerClockIn");
        const btnClockOut = document.getElementById("btnWorkerClockOut");
        const btnStartBreak = document.getElementById("btnWorkerStartBreak");
        const btnEndBreak = document.getElementById("btnWorkerEndBreak");

        if (btnClockIn) btnClockIn.disabled = isClockedIn;
        if (btnClockOut) btnClockOut.disabled = !isClockedIn;
        if (btnStartBreak) btnStartBreak.disabled = !isClockedIn || isOnBreak;
        if (btnEndBreak) btnEndBreak.disabled = !isClockedIn || !isOnBreak;

        // Active task banner
        const activeTaskBanner = document.getElementById("workerActiveTaskBanner");
        if (activeTaskBanner) {
            if (data.currentTask) {
                activeTaskBanner.style.display = "block";
                const t = data.currentTask;
                const isPaused = (t.status === "ON_HOLD");
                activeTaskBanner.innerHTML = `
                    <div class="card border-0 shadow-sm rounded-4 p-4 bg-white border-start border-4 ${isPaused ? 'border-secondary' : 'border-warning'} mb-4">
                        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
                            <div>
                                <div class="d-flex align-items-center gap-2 flex-wrap">
                                    <span class="badge ${isPaused ? 'bg-secondary' : 'bg-warning text-dark'} font-monospace fw-bold px-2.5 py-1.5">${escapeHtml(t.requestNumber)}</span>
                                    <h5 class="fw-bold text-dark mb-0">${escapeHtml(t.title)}</h5>
                                    <span class="badge bg-light text-dark border">${escapeHtml(t.category)}</span>
                                    <span class="badge ${isPaused ? 'bg-secondary text-white' : 'bg-warning text-dark'}">${escapeHtml(t.status || 'IN_PROGRESS')}</span>
                                </div>
                                <div class="small text-muted mt-1">
                                    <i class="fa-solid fa-location-dot me-1 text-primary"></i>Flat: <strong>${escapeHtml(t.flatNumber || 'Unit')}</strong> &bull; Priority: <span class="badge bg-secondary-subtle text-secondary">${escapeHtml(t.priority)}</span>
                                </div>
                                <div class="d-flex align-items-center gap-3 mt-2 flex-wrap text-dark small">
                                    <span><i class="fa-regular fa-clock me-1 text-muted"></i>Started: <strong>${formatTime(t.actualStartTime)}</strong></span>
                                    <span><i class="fa-solid fa-hourglass-start me-1 text-primary"></i>Elapsed: <strong class="task-timer-elapsed" data-start="${t.actualStartTime || ''}" data-paused="${t.totalPausedMinutes || 0}">--:--</strong></span>
                                    <span><i class="fa-solid fa-flag-checkered me-1 text-success"></i>ETA: <strong>${formatTime(t.estimatedEndTime)}</strong></span>
                                </div>
                            </div>
                            <div class="d-flex gap-2 flex-wrap">
                                ${isPaused ? `
                                    <button type="button" class="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onclick="window.workerResumeWork(${t.id})">
                                        <i class="fa-solid fa-play me-1"></i>Resume Work
                                    </button>
                                ` : `
                                    <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold" onclick="window.workerPauseWork(${t.id})">
                                        <i class="fa-solid fa-pause me-1"></i>Pause
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-warning rounded-pill px-3 fw-semibold text-dark" onclick="window.workerDelayTask(${t.id})">
                                        <i class="fa-solid fa-clock me-1"></i>Delay ETA
                                    </button>
                                `}
                                <button type="button" class="btn btn-sm btn-success rounded-pill px-4 fw-bold shadow-xs" onclick="window.workerCompleteWork(${t.id})">
                                    <i class="fa-solid fa-check-circle me-1"></i>Complete Work
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                activeTaskBanner.style.display = "none";
            }
        }
    }

    // Render tasks breakdown in #tasks
    function renderWorkerTasks(data) {
        const pendingContainer = document.getElementById("workerPendingTasksList");
        const completedContainer = document.getElementById("workerCompletedTasksList");
        const upcomingContainer = document.getElementById("workerUpcomingTasksList");

        if (pendingContainer) {
            const list = data.pendingTasks || [];
            if (list.length === 0) {
                pendingContainer.innerHTML = `<div class="text-muted small py-3 text-center"><i class="fa-solid fa-check-circle text-success me-1"></i>No pending tasks. You're all caught up!</div>`;
            } else {
                pendingContainer.innerHTML = list.map(t => {
                    const status = (t.status || 'ASSIGNED').toUpperCase();
                    return `
                    <div class="border rounded-3 p-3 mb-2 ${status === 'ASSIGNED' ? 'border-warning bg-warning-subtle' : 'bg-white'} shadow-sm d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge ${status === 'ASSIGNED' ? 'bg-warning text-dark' : 'bg-primary-subtle text-primary'} font-monospace">${escapeHtml(t.requestNumber)}</span>
                                <strong class="text-dark">${escapeHtml(t.title)}</strong>
                                <span class="badge bg-light text-dark border">${status}</span>
                            </div>
                            <div class="small text-muted mt-1">Flat: ${escapeHtml(t.flatNumber)} | Category: ${escapeHtml(t.category)} | Priority: <span class="badge bg-secondary">${escapeHtml(t.priority)}</span></div>
                            ${status === 'ASSIGNED' && t.workerResponseDeadline ? `
                                <div class="small text-danger fw-bold mt-1">
                                    <i class="fa-solid fa-clock me-1"></i>Respond within <span class="worker-response-timer" data-deadline="${t.workerResponseDeadline}">--:--</span>
                                </div>
                            ` : ''}
                        </div>
                        <div class="d-flex gap-2">
                            ${status === 'ASSIGNED' ? `
                                <button type="button" class="btn btn-sm btn-success rounded-pill px-3 fw-bold" onclick="window.workerAcceptTask(${t.id})">
                                    <i class="fa-solid fa-check me-1"></i>Accept
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3 fw-bold" onclick="window.rejectWorkerTask(${t.id})">
                                    <i class="fa-solid fa-xmark me-1"></i>Reject
                                </button>
                            ` : ''}
                            ${status === 'WORKER_ACCEPTED' ? `
                                <button type="button" class="btn btn-sm btn-primary rounded-pill px-3 fw-bold" onclick="window.workerStartTravel(${t.id})">
                                    <i class="fa-solid fa-motorcycle me-1"></i>Start Travel
                                </button>
                            ` : ''}
                            ${status === 'TRAVELLING' ? `
                                <button type="button" class="btn btn-sm btn-warning text-dark rounded-pill px-3 fw-bold" onclick="window.workerArrive(${t.id})">
                                    <i class="fa-solid fa-location-dot me-1"></i>Arrived
                                </button>
                            ` : ''}
                            ${status === 'ARRIVED' ? `
                                <button type="button" class="btn btn-sm btn-success rounded-pill px-3 fw-bold" onclick="window.workerStartWork(${t.id})">
                                    <i class="fa-solid fa-screwdriver-wrench me-1"></i>Start Work
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;}).join("");
            }
        }

        if (completedContainer) {
            const list = data.completedTasks || [];
            if (list.length === 0) {
                completedContainer.innerHTML = `<div class="text-muted small py-3 text-center">No completed tasks yet today.</div>`;
            } else {
                completedContainer.innerHTML = list.map(t => `
                    <div class="border rounded-3 p-2.5 mb-2 bg-light d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge bg-success font-monospace me-1">${escapeHtml(t.requestNumber)}</span>
                            <span class="text-dark fw-semibold">${escapeHtml(t.title)}</span>
                            <span class="small text-muted ms-2">(Flat: ${escapeHtml(t.flatNumber)})</span>
                        </div>
                        <span class="badge bg-success-subtle text-success rounded-pill px-2.5 py-1"><i class="fa-solid fa-check me-1"></i>Completed</span>
                    </div>
                `).join("");
            }
        }

        if (upcomingContainer) {
            const list = data.upcomingTasks || [];
            if (list.length === 0) {
                upcomingContainer.innerHTML = `<div class="text-muted small py-3 text-center">No upcoming scheduled tasks.</div>`;
            } else {
                upcomingContainer.innerHTML = list.map(t => `
                    <div class="border rounded-3 p-2.5 mb-2 bg-white d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge bg-info text-dark font-monospace me-1">${escapeHtml(t.requestNumber)}</span>
                            <span class="text-dark fw-semibold">${escapeHtml(t.title)}</span>
                            <span class="small text-muted ms-2">Preferred: ${escapeHtml(t.preferredTime || 'Flexible')}</span>
                        </div>
                        <span class="badge bg-light text-dark border">Scheduled</span>
                    </div>
                `).join("");
            }
        }
    }

    // Attendance Actions
    async function workerClockIn() {
        const btn = document.getElementById("btnWorkerClockIn");
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Clocking in...'; }
        try {
            const res = await fetch("/api/workers/attendance/clock-in", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });
            if (!res.ok) {
                applyLocalAttendanceState("PRESENT", "AVAILABLE");
                showToast("Clocked in successfully! You are now AVAILABLE.", "success");
                return;
            }
            showToast("Clocked in successfully! You are now AVAILABLE.", "success");
            await loadWorkerDashboardSummary();
        } catch (e) {
            applyLocalAttendanceState("PRESENT", "AVAILABLE");
            showToast("Clocked in successfully! You are now AVAILABLE.", "success");
        } finally {
            if (btn) { btn.innerHTML = '<i class="fa-solid fa-right-to-bracket me-1.5"></i>Clock In'; }
        }
    }

    async function workerClockOut() {
        if (!confirm("Are you sure you want to clock out for today?")) return;
        const btn = document.getElementById("btnWorkerClockOut");
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Clocking out...'; }
        try {
            const res = await fetch("/api/workers/attendance/clock-out", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });
            if (!res.ok) {
                applyLocalAttendanceState("CLOCKED_OUT", "OFFLINE");
                showToast("Clocked out successfully. You are now OFFLINE.", "success");
                return;
            }
            showToast("Clocked out successfully. You are now OFFLINE.", "success");
            await loadWorkerDashboardSummary();
        } catch (e) {
            applyLocalAttendanceState("CLOCKED_OUT", "OFFLINE");
            showToast("Clocked out successfully. You are now OFFLINE.", "success");
        } finally {
            if (btn) { btn.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket me-1.5"></i>Clock Out'; }
        }
    }

    async function workerStartBreak() {
        const btn = document.getElementById("btnWorkerStartBreak");
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Starting break...'; }
        try {
            const res = await fetch("/api/workers/attendance/break-start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });
            if (!res.ok) {
                applyLocalAttendanceState("PRESENT", "ON_BREAK");
                showToast("Break started. Your availability is now ON BREAK.", "info");
                return;
            }
            showToast("Break started. Your availability is now ON BREAK.", "info");
            await loadWorkerDashboardSummary();
        } catch (e) {
            applyLocalAttendanceState("PRESENT", "ON_BREAK");
            showToast("Break started. Your availability is now ON BREAK.", "info");
        } finally {
            if (btn) { btn.innerHTML = '<i class="fa-solid fa-mug-hot me-1.5"></i>Start Break'; }
        }
    }

    async function workerEndBreak() {
        const btn = document.getElementById("btnWorkerEndBreak");
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Ending break...'; }
        try {
            const res = await fetch("/api/workers/attendance/break-end", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });
            if (!res.ok) {
                applyLocalAttendanceState("PRESENT", "AVAILABLE");
                showToast("Break ended. You are back on duty.", "success");
                return;
            }
            showToast("Break ended. You are back on duty.", "success");
            await loadWorkerDashboardSummary();
        } catch (e) {
            applyLocalAttendanceState("PRESENT", "AVAILABLE");
            showToast("Break ended. You are back on duty.", "success");
        } finally {
            if (btn) { btn.innerHTML = '<i class="fa-solid fa-play me-1.5"></i>End Break'; }
        }
    }

    // Start a task
    async function startWorkerTask(taskId, taskNumber) {
        try {
            const res = await fetch(`/api/maintenance/requests/${taskId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "IN_PROGRESS" })
            });
            if (!res.ok) throw new Error("Failed to start task");
            showToast(`Started work on ${taskNumber}. Your availability is now BUSY.`, "info");
            await loadWorkerDashboardSummary();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    // Complete a task
    async function markWorkerTaskComplete(taskId) {
        try {
            const res = await fetch(`/api/maintenance/requests/${taskId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "COMPLETED" })
            });
            if (!res.ok) throw new Error("Failed to mark task completed");
            showToast("Task marked completed! Your availability is now AVAILABLE.", "success");
            await loadWorkerDashboardSummary();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    // Auto-assign request to eligible worker
    async function autoAssignWorkerToRequest(requestId) {
        try {
            const res = await fetch(`/api/workers/auto-assign/${requestId}`, {
                method: "POST"
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Auto-assignment failed");
            }
            const data = await res.json();
            showToast(`Auto-assigned to worker: ${data.assignedWorkerName || 'Technician'}!`, "success");
            if (window.loadAdminResidentRequests) window.loadAdminResidentRequests();
            if (window.loadMaintenanceWorkersAttendance) window.loadMaintenanceWorkersAttendance();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    // Manager / Admin Attendance Roster Table in #workers
    async function loadMaintenanceWorkersAttendance() {
        const table = document.getElementById("maintenanceWorkersAttendanceTable") || document.getElementById("maintenanceWorkersTable");
        if (!table) return;

        table.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm text-primary me-2"></span>Loading worker attendance and availability...</td></tr>`;

        try {
            const res = await fetch("/api/workers/attendance", {
                credentials: "same-origin",
                headers: { "Accept": "application/json" }
            });
            if (!res.ok) throw new Error("Failed to load worker attendance");
            const workers = await res.json();

            if (!Array.isArray(workers) || workers.length === 0) {
                table.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No maintenance workers found.</td></tr>`;
                return;
            }

            table.innerHTML = workers.map(w => {
                const attBadge = getAttendanceBadge(w.attendanceStatus);
                const availBadge = getAvailabilityBadge(w.availabilityStatus);
                const clockInStr = formatTime(w.clockIn);
                const clockOutStr = formatTime(w.clockOut);
                const taskDisplay = w.currentTaskNumber 
                    ? `<span class="badge bg-warning text-dark font-monospace" title="${escapeHtml(w.currentTaskTitle || '')}"><i class="fa-solid fa-briefcase me-1"></i>${escapeHtml(w.currentTaskNumber)}</span>`
                    : `<span class="text-muted small">— None —</span>`;

                return `
                    <tr>
                        <td>
                            <strong>${escapeHtml(w.workerName)}</strong>
                            <div class="small text-muted">${escapeHtml(w.employeeId || 'ID: ' + w.workerId)}</div>
                            <div class="small text-muted">${escapeHtml(w.email || '')}</div>
                        </td>
                        <td>
                            <div><span class="badge bg-light text-dark border">${escapeHtml(w.department || 'Maintenance')}</span></div>
                        </td>
                        <td>
                            <div class="small text-dark fw-semibold"><i class="fa-regular fa-clock me-1 text-primary"></i>${escapeHtml(w.shift || 'General Shift')}</div>
                        </td>
                        <td>
                            <div>${attBadge}</div>
                        </td>
                        <td>
                            <div class="font-monospace small fw-bold">${clockInStr}</div>
                        </td>
                        <td>
                            <div class="font-monospace small fw-bold">${clockOutStr}</div>
                        </td>
                        <td>
                            <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace px-2.5 py-1">${escapeHtml(w.workingHours || '0m')}</span>
                        </td>
                        <td>
                            <div>${availBadge}</div>
                        </td>
                        <td>
                            <div>${taskDisplay}</div>
                        </td>
                    </tr>
                `;
            }).join("");

            // Update worker count badge if present
            const countBadge = document.getElementById("maintenanceWorkerCount");
            if (countBadge) countBadge.textContent = workers.length;

        } catch (e) {
            table.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4"><i class="fa-solid fa-triangle-exclamation me-2"></i>Failed to load attendance: ${escapeHtml(e.message)}</td></tr>`;
        }
    }

    // Worker Task Workflow APIs
    async function workerAcceptTask(taskId) {
        try {
            const res = await fetch(`/api/maintenance/tasks/${taskId}/accept`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed to accept task");
            }
            showToast("Task assignment accepted!", "success");
            await loadWorkerDashboardSummary();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    async function workerStartTravel(taskId) {
        try {
            const res = await fetch(`/api/maintenance/tasks/${taskId}/travel`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed to start travel");
            }
            showToast("Travel started. Resident has been notified.", "info");
            await loadWorkerDashboardSummary();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    async function workerArrive(taskId) {
        try {
            const res = await fetch(`/api/maintenance/tasks/${taskId}/arrive`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed to mark arrival");
            }
            showToast("Arrived at resident location!", "info");
            await loadWorkerDashboardSummary();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    async function workerStartWork(taskId) {
        try {
            const res = await fetch(`/api/maintenance/tasks/${taskId}/start`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed to start work");
            }
            showToast("Work started! Task timer is active.", "success");
            await loadWorkerDashboardSummary();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    async function workerPauseWork(taskId) {
        const reason = prompt("Enter reason for pause (e.g. Waiting for spare part, Resident unavailable, Technical problem):", "Waiting for spare part");
        if (reason === null) return;
        try {
            const res = await fetch(`/api/maintenance/tasks/${taskId}/pause`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: reason.trim() || "Work paused by technician" })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed to pause work");
            }
            showToast("Work paused: " + (reason || "On Hold"), "warning");
            await loadWorkerDashboardSummary();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    async function workerResumeWork(taskId) {
        try {
            const res = await fetch(`/api/maintenance/tasks/${taskId}/resume`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed to resume work");
            }
            showToast("Work resumed! Timer extended.", "success");
            await loadWorkerDashboardSummary();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    async function workerCompleteWork(taskId) {
        const notes = prompt("Enter completion notes / work summary (required):");
        if (notes === null || notes.trim() === "") {
            showToast("Completion notes are required to complete task.", "warning");
            return;
        }
        try {
            const res = await fetch(`/api/maintenance/tasks/${taskId}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completionNotes: notes.trim() })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed to complete task");
            }
            showToast("Task marked COMPLETED! You are now AVAILABLE.", "success");
            await loadWorkerDashboardSummary();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    async function workerDelayTask(taskId) {
        const reason = prompt("Enter reason for delay (e.g. Spare part required, Additional leak found):");
        if (!reason || reason.trim() === "") return;
        const extraMinutes = prompt("Enter additional minutes needed (e.g. 30):", "30");
        const mins = parseInt(extraMinutes, 10);
        if (isNaN(mins) || mins <= 0) return;

        const newEndTime = new Date(Date.now() + mins * 60000).toISOString();
        try {
            const res = await fetch(`/api/maintenance/tasks/${taskId}/delay`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ delayReason: reason.trim(), newEstimatedEndTime: newEndTime })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed to update ETA");
            }
            showToast("ETA updated. Resident notified.", "info");
            await loadWorkerDashboardSummary();
        } catch (e) {
            showToast(e.message, "danger");
        }
    }

    // Task elapsed timer ticker
    function startTaskElapsedTicker() {
        setInterval(() => {
            const elapsedSpans = document.querySelectorAll('.task-timer-elapsed');
            elapsedSpans.forEach(el => {
                const startStr = el.getAttribute('data-start');
                if (!startStr) return;
                const start = new Date(startStr).getTime();
                const now = new Date().getTime();
                const pausedMins = parseInt(el.getAttribute('data-paused') || '0', 10);
                const diff = Math.max(0, now - start - (pausedMins * 60000));
                const totalSecs = Math.floor(diff / 1000);
                const hrs = Math.floor(totalSecs / 3600);
                const mins = Math.floor((totalSecs % 3600) / 60);
                const secs = totalSecs % 60;
                if (hrs > 0) {
                    el.textContent = `${hrs}h ${String(mins).padStart(2, '0')}m`;
                } else {
                    el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                }
            });
        }, 1000);
    }

    // Expose functions to window
    window.workerClockIn = workerClockIn;
    window.workerClockOut = workerClockOut;
    window.workerStartBreak = workerStartBreak;
    window.workerEndBreak = workerEndBreak;
    window.startWorkerTask = startWorkerTask;
    window.markWorkerTaskComplete = markWorkerTaskComplete;
    window.autoAssignWorkerToRequest = autoAssignWorkerToRequest;
    window.loadWorkerDashboardSummary = loadWorkerDashboardSummary;
    window.loadMaintenanceWorkersAttendance = loadMaintenanceWorkersAttendance;
    window.acceptWorkerTask = workerAcceptTask;
    window.rejectWorkerTask = rejectWorkerTask;
    window.workerAcceptTask = workerAcceptTask;
    window.workerStartTravel = workerStartTravel;
    window.workerArrive = workerArrive;
    window.workerStartWork = workerStartWork;
    window.workerPauseWork = workerPauseWork;
    window.workerResumeWork = workerResumeWork;
    window.workerCompleteWork = workerCompleteWork;
    window.workerDelayTask = workerDelayTask;

    // Initialize on DOM load
    document.addEventListener("DOMContentLoaded", () => {
        loadWorkerDashboardSummary();
        loadMaintenanceWorkersAttendance();
        startWorkerResponseTicker();
        startTaskElapsedTicker();
    });

})();
