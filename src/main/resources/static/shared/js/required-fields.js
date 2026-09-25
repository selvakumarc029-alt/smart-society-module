(function () {
    "use strict";

    const FIELD_SELECTOR = "input[required], select[required], textarea[required], [data-required='true']";
    const SKIP_TYPES = new Set(["hidden", "button", "submit", "reset"]);

    function fieldsIn(scope) {
        return [...scope.querySelectorAll(FIELD_SELECTOR)].filter(field => !field.disabled && !SKIP_TYPES.has((field.type || "").toLowerCase()));
    }

    function labelFor(field) {
        if (field.id) {
            const explicit = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
            if (explicit) return explicit;
        }
        return field.closest("label") || field.parentElement?.querySelector(":scope > label");
    }

    function isLoginForm(field) {
        const scope = field.closest("form, .modal, .dialog, [data-required-scope], .modal-card, fieldset");
        if (!scope) return false;
        if (scope.dataset.noRequiredStar === "true" || scope.closest("[data-no-required-star='true']")) return true;
        if (scope.id && /login|signin|auth/i.test(scope.id)) return true;
        if (scope.className && /login|signin|auth/i.test(scope.className)) return true;
        const heading = scope.querySelector("h1, h2, h3, h4, .modal-title, legend, #dashboardLoginTitle")?.textContent || "";
        if (/login|sign in|log in|authentication|credentials/i.test(heading)) return true;
        const buttonText = scope.querySelector("button, input[type='submit']")?.textContent || "";
        if (/login|sign in|log in/i.test(buttonText)) return true;
        return false;
    }

    function markLabel(field) {
        field.required = true;
        field.setAttribute("aria-required", "true");
        if (isLoginForm(field)) return;

        const label = labelFor(field);
        if (!label || label.querySelector(".required-star")) return;
        const star = document.createElement("span");
        star.className = "required-star";
        star.setAttribute("aria-hidden", "true");
        star.textContent = " *";

        const titleSpan = label.querySelector(":scope > span:not(.required-star)") || label.querySelector("span:not(.required-star)");
        if (titleSpan) {
            if (titleSpan.textContent.trim().endsWith("*")) {
                titleSpan.textContent = titleSpan.textContent.trim().replace(/\s*\*+$/, "");
            }
            titleSpan.appendChild(star);
        } else {
            const textNode = [...label.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
            if (textNode) {
                textNode.after(star);
            } else {
                const directFieldContainer = [...label.children].find(child => child.matches?.("input, select, textarea") || child.contains(field));
                label.insertBefore(star, directFieldContainer || null);
            }
        }
    }

    function clearError(field) {
        field.classList.remove("required-field-invalid");
        field.removeAttribute("aria-invalid");
        field.parentElement?.querySelector(":scope > .required-field-error")?.remove();
    }

    function showError(field) {
        clearError(field);
        field.classList.add("required-field-invalid");
        field.setAttribute("aria-invalid", "true");
        const error = document.createElement("small");
        error.className = "required-field-error";
        error.textContent = field.validationMessage || "This field is required.";
        field.insertAdjacentElement("afterend", error);
    }

    function isValid(field) {
        if ((field.type || "").toLowerCase() === "checkbox") return field.checked;
        return field.checkValidity() && String(field.value || "").trim() !== "";
    }

    function validate(scope, options) {
        const requiredFields = fieldsIn(scope);
        requiredFields.forEach(markLabel);
        requiredFields.forEach(clearError);
        const invalid = requiredFields.filter(field => !isValid(field));
        invalid.forEach(showError);
        scope.querySelector(":scope > .required-form-alert")?.remove();
        if (!invalid.length) return true;

        const alert = document.createElement("div");
        alert.className = "required-form-alert";
        alert.setAttribute("role", "alert");
        alert.textContent = "Please complete all fields marked with a red * before submitting.";
        scope.prepend(alert);
        if (options?.focus !== false) {
            invalid[0].focus({ preventScroll: true });
            invalid[0].scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return false;
    }

    function enhance(root) {
        const scopes = root.matches?.("form, [data-required-scope]") ? [root] : [...root.querySelectorAll?.("form, [data-required-scope]") || []];
        scopes.forEach(scope => fieldsIn(scope).forEach(markLabel));
    }

    document.addEventListener("submit", event => {
        if (!validate(event.target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    document.addEventListener("click", event => {
        const button = event.target.closest?.("button, [role='button']");
        if (!button || button.disabled) return;
        const scope = button.closest("form, [data-required-scope]");
        if (!scope) return;
        const submitsByIntent = button.matches("[data-required-submit]") ||
            (/^(button|)$/i.test(button.getAttribute("type") || "button") && /submit|confirm|save|send|create|register|login|book|publish|raise|request|record|verify|update|continue/i.test(button.textContent || ""));
        if (submitsByIntent && !validate(scope)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    document.addEventListener("input", event => {
        if (event.target.matches?.(FIELD_SELECTOR)) clearError(event.target);
    });
    document.addEventListener("change", event => {
        if (event.target.matches?.(FIELD_SELECTOR)) clearError(event.target);
    });

    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) enhance(node);
    })));

    function boot() {
        enhance(document);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    window.validateRequiredScope = validate;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();
