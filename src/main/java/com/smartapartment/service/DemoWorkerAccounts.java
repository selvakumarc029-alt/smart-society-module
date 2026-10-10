package com.smartapartment.service;

import java.util.Locale;
import java.util.Set;

/** Exact identities installed by the development data loader. */
public final class DemoWorkerAccounts {
    private static final Set<String> EMAILS = Set.of("maintenance@smartapartment", "maintenance@smartsociety",
            "plumber@smartapartment", "electrician@smartapartment", "carpenter@smartapartment", "cleaner@smartapartment");
    private DemoWorkerAccounts() {}
    public static boolean isDemo(String email) {
        return email != null && EMAILS.contains(email.trim().toLowerCase(Locale.ROOT));
    }
}
