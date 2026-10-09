package com.smartapartment;
import com.smartapartment.service.GuardGatePresence;
import jakarta.servlet.http.HttpSessionBindingEvent;
import jakarta.servlet.http.HttpSessionEvent;
import org.springframework.mock.web.MockHttpSession;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
public class GuardDeploymentTest {
 public static void main(String[] args){
  GuardGatePresence presence=new GuardGatePresence();MockHttpSession session=new MockHttpSession();
  session.setAttribute("securityConsoleTenant","society-a");session.setAttribute("securityConsoleGuard",7L);session.setAttribute("securityConsoleGate",2L);session.setAttribute("securityConsoleToken","test-token");session.setAttribute("securityConsoleStarted",Instant.now());
  presence.attributeAdded(new HttpSessionBindingEvent(session,"securityConsoleStarted"));
  assertEquals(1,presence.active("society-a").size());assertEquals(2L,presence.active("society-a").getFirst().gateId());assertTrue(presence.active("society-b").isEmpty());
  session.setAttribute("securityConsoleGate",3L);presence.attributeReplaced(new HttpSessionBindingEvent(session,"securityConsoleStarted"));assertEquals(3L,presence.active("society-a").getFirst().gateId());
  session.setAttribute("securityConsoleStarted",Instant.now().minusSeconds(12*3600+1));assertTrue(presence.active("society-a").isEmpty());
  session.setAttribute("securityConsoleStarted",Instant.now());session.removeAttribute("securityConsoleToken");assertTrue(presence.active("society-a").isEmpty());
  session.setAttribute("securityConsoleToken","test-token");presence.sessionDestroyed(new HttpSessionEvent(session));assertTrue(presence.active("society-a").isEmpty());
  System.out.println("Guard presence tests passed: gate sign-in, gate switching, tenant isolation, session expiry, token removal, logout cleanup.");
 }
}
