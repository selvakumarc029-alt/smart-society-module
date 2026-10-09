import sys

# 1. Patch AuthController.java
auth_path = 'c:/smart-society-module-main/src/main/java/com/smartapartment/controller/AuthController.java'
with open(auth_path, 'r', encoding='utf-8') as f:
    auth_content = f.read()

target1 = '''            if ("owner@propertydirect".equalsIgnoreCase(existingAccount.getUsername())
                    || "owner@propertydirect".equalsIgnoreCase(existingAccount.getEmail())
                    || (existingAccount.getUsername() != null && existingAccount.getUsername().toLowerCase().contains("owner"))
                    || "owner".equalsIgnoreCase(safe(request.role()))) {
                if (!"OWNER".equalsIgnoreCase(existingAccount.getRole())) {
                    existingAccount.setRole("OWNER");
                    existingAccount.setName("Property Owner");
                    existingAccount = propertyDirectCustomers.save(existingAccount);
                }
            } else if ("agent@propertydirect".equalsIgnoreCase(existingAccount.getUsername())
                    || "vendor@propertydirect".equalsIgnoreCase(existingAccount.getUsername())) {
                if (!"OWNER".equalsIgnoreCase(existingAccount.getRole())) {
                    existingAccount.setRole("OWNER");
                    existingAccount = propertyDirectCustomers.save(existingAccount);
                }
            }'''

replacement1 = '''            if ("owner@propertydirect".equalsIgnoreCase(existingAccount.getUsername())
                    || "owner@propertydirect".equalsIgnoreCase(existingAccount.getEmail())
                    || (existingAccount.getUsername() != null && existingAccount.getUsername().toLowerCase().contains("owner"))
                    || "owner".equalsIgnoreCase(safe(request.role()))) {
                if (!"OWNER".equalsIgnoreCase(existingAccount.getRole())) {
                    existingAccount.setRole("OWNER");
                    existingAccount.setName("Property Owner");
                    existingAccount = propertyDirectCustomers.save(existingAccount);
                }
            } else if ("agent@propertydirect".equalsIgnoreCase(existingAccount.getUsername())
                    || "vendor@propertydirect".equalsIgnoreCase(existingAccount.getUsername())) {
                if (!"OWNER".equalsIgnoreCase(existingAccount.getRole())) {
                    existingAccount.setRole("OWNER");
                    existingAccount = propertyDirectCustomers.save(existingAccount);
                }
            } else if ("customer@propertydirect".equalsIgnoreCase(existingAccount.getUsername())
                    || "customer@propertydirect".equalsIgnoreCase(existingAccount.getEmail())
                    || "customer@propertydirect.in".equalsIgnoreCase(existingAccount.getEmail())
                    || "customer@propertydirect.com".equalsIgnoreCase(existingAccount.getEmail())
                    || "customer".equalsIgnoreCase(safe(request.role()))
                    || (existingAccount.getUsername() != null && existingAccount.getUsername().toLowerCase().contains("customer") && !"owner".equalsIgnoreCase(safe(request.role())) && !"builder".equalsIgnoreCase(safe(request.role())))) {
                if (!"CUSTOMER".equalsIgnoreCase(existingAccount.getRole())) {
                    existingAccount.setRole("CUSTOMER");
                    existingAccount.setName("PropertyDirect Customer");
                    existingAccount.setPostingVerified(false);
                    existingAccount = propertyDirectCustomers.save(existingAccount);
                }
            }'''

target2 = '''            if ("owner".equalsIgnoreCase(activeCred.role())
                    || "agent".equalsIgnoreCase(activeCred.role())
                    || "vendor".equalsIgnoreCase(activeCred.role())
                    || username.contains("owner")) {
                if (!"OWNER".equalsIgnoreCase(owner.getRole())) {
                    owner.setRole("OWNER");
                    owner.setName("Property Owner");
                    owner = propertyDirectCustomers.save(owner);
                }
            }'''

replacement2 = '''            if ("owner".equalsIgnoreCase(activeCred.role())
                    || "agent".equalsIgnoreCase(activeCred.role())
                    || "vendor".equalsIgnoreCase(activeCred.role())
                    || username.contains("owner")) {
                if (!"OWNER".equalsIgnoreCase(owner.getRole())) {
                    owner.setRole("OWNER");
                    owner.setName("Property Owner");
                    owner = propertyDirectCustomers.save(owner);
                }
            } else if ("customer".equalsIgnoreCase(activeCred.role())
                    || username.contains("customer")) {
                if (!"CUSTOMER".equalsIgnoreCase(owner.getRole())) {
                    owner.setRole("CUSTOMER");
                    owner.setName("PropertyDirect Customer");
                    owner.setPostingVerified(false);
                    owner = propertyDirectCustomers.save(owner);
                }
            }'''

# Normalize newlines for matching
normalized_auth = auth_content.replace('\r\n', '\n')
target1_norm = target1.replace('\r\n', '\n')
target2_norm = target2.replace('\r\n', '\n')

assert target1_norm in normalized_auth, "target1 not found in AuthController"
assert target2_norm in normalized_auth, "target2 not found in AuthController"

normalized_auth = normalized_auth.replace(target1_norm, replacement1.replace('\r\n', '\n'), 1)
normalized_auth = normalized_auth.replace(target2_norm, replacement2.replace('\r\n', '\n'), 1)

with open(auth_path, 'w', encoding='utf-8') as f:
    f.write(normalized_auth.replace('\n', '\r\n'))
print("Successfully patched AuthController.java")

# 2. Patch DashboardController.java
dash_path = 'c:/smart-society-module-main/src/main/java/com/smartapartment/controller/DashboardController.java'
with open(dash_path, 'r', encoding='utf-8') as f:
    dash_content = f.read()

target_dash = '''    @GetMapping("/propertydirect/dashboards/owner")
    public String propertyDirectOwner(HttpSession session) {
        if (session != null) {
            session.setAttribute("dashboard:propertydirect:owner", Boolean.TRUE);
            session.setAttribute("dashboard:propertydirect:agent", Boolean.TRUE);
            session.setAttribute("dashboard:propertydirect:vendor", Boolean.TRUE);
        }
        return "propertydirect/dashboards/owner";
    }'''

replacement_dash = '''    @GetMapping("/propertydirect/dashboards/owner")
    public String propertyDirectOwner(HttpSession session) {
        if (session != null) {
            if (Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:customer"))
                    && !Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:owner"))
                    && !Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:admin"))
                    && !Boolean.TRUE.equals(session.getAttribute("dashboard:propertydirect:superadmin"))) {
                return "redirect:/propertydirect/dashboards/customer";
            }
            session.setAttribute("dashboard:propertydirect:owner", Boolean.TRUE);
            session.setAttribute("dashboard:propertydirect:agent", Boolean.TRUE);
            session.setAttribute("dashboard:propertydirect:vendor", Boolean.TRUE);
        }
        return "propertydirect/dashboards/owner";
    }'''

normalized_dash = dash_content.replace('\r\n', '\n')
target_dash_norm = target_dash.replace('\r\n', '\n')

assert target_dash_norm in normalized_dash, "target_dash not found in DashboardController"
normalized_dash = normalized_dash.replace(target_dash_norm, replacement_dash.replace('\r\n', '\n'), 1)

with open(dash_path, 'w', encoding='utf-8') as f:
    f.write(normalized_dash.replace('\n', '\r\n'))
print("Successfully patched DashboardController.java")
