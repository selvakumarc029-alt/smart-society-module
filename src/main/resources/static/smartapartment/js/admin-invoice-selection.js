(() => {
    "use strict";
    if (!["smartapartment", "smartsociety"].includes(document.body?.dataset.platform)
        || document.body.dataset.dashboardRole !== "admin") return;
    const field = id => document.getElementById(id);
    const typeKey = value => String(value || "").replace(/\s+/g, "").toUpperCase();
    let flats = [], generation = 0;
    function options(select, items, placeholder) {
        select.replaceChildren(new Option(placeholder, ""));
        items.forEach(([label, value]) => select.add(new Option(label, String(value))));
    }
    function selectType() {
        const type = field("adminInvoiceUnitType").value;
        options(field("adminInvoiceFlat"), flats.filter(flat => typeKey(flat.type) === type)
            .map(flat => [`${flat.unitNo}${flat.block ? ' · ' + flat.block : ''} · ${typeKey(flat.type)}`, flat.id]), "Select flat number");
        window.adminInvoiceSelectedFlat = null;
    }
    window.loadAdminInvoiceFlats = async (scope = "flat") => {
        const current = ++generation;
        const batch = scope === "batch";
        field("adminInvoiceScope").value = batch ? "batch" : "flat";
        field("adminInvoiceFlatFields").hidden = batch;
        field("adminInvoiceFlatFields").style.display = batch ? "none" : "";
        ["adminInvoiceUnitType", "adminInvoiceFlat"].forEach(id => { field(id).required = !batch; field(id).disabled = batch; });
        field("adminInvoiceAudience").textContent = batch ? "Batch: applied to every registered society flat" : "Applied only to the selected flat";
        field("adminInvoiceSelectionMessage").textContent = "";
        window.adminInvoiceSelectedFlat = null;
        const submit = field("adminDetailedInvoiceForm").querySelector('[type="submit"]');
        submit.disabled = !batch;
        if (batch) return;
        options(field("adminInvoiceUnitType"), [], "Loading flat types…");
        options(field("adminInvoiceFlat"), [], "Select a flat type first");
        try {
            const response = await fetch("/api/society/apartments", {credentials: "same-origin", headers: {Accept: "application/json"}});
            const data = await response.json();
            if (response.redirected || !response.ok || !Array.isArray(data)) throw Error("Unable to load society flats. Refresh or sign in again.");
            if (current !== generation) return;
            flats = data;
            const types = [...new Set(flats.map(flat => typeKey(flat.type)).filter(Boolean))].sort();
            options(field("adminInvoiceUnitType"), types.map(type => [type, type]), "Select BHK / flat type");
            if (!types.length) throw Error("No flats with a BHK type are registered. Add or update your society flats first.");
            submit.disabled = false;
        } catch (error) { if (current === generation) field("adminInvoiceSelectionMessage").textContent = error.message; }
    };
    document.addEventListener("DOMContentLoaded", () => {
        field("adminInvoiceUnitType")?.addEventListener("change", selectType);
        field("adminInvoiceFlat")?.addEventListener("change", () => {
            const flat = flats.find(item => String(item.id) === field("adminInvoiceFlat").value);
            window.adminInvoiceSelectedFlat = flat || null;
            if (Number(flat?.monthlyMaintenance) > 0) field("adminSimpleAmount").value = flat.monthlyMaintenance;
            window.updateAdminInvoiceEstimate?.();
        });
        const now = new Date(), due = new Date(now);
        due.setDate(due.getDate() + 15);
        const local = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        field("adminBatchMonth").value = local(now).slice(0, 7);
        field("adminBatchDueDate").value = local(due);
    });
})();
