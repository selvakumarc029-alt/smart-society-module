package com.smartapartment.service;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
/** Active console sessions are evidence of gate sign-in, not physical location. */
@Component
public class GuardGatePresence implements HttpSessionAttributeListener,HttpSessionListener {
    private final Map<String,HttpSession> sessions=new ConcurrentHashMap<>();
    @Override public void attributeAdded(HttpSessionBindingEvent event){if("securityConsoleStarted".equals(event.getName()))sessions.put(event.getSession().getId(),event.getSession());}
    @Override public void attributeReplaced(HttpSessionBindingEvent event){attributeAdded(event);}
    @Override public void sessionDestroyed(HttpSessionEvent event){sessions.remove(event.getSession().getId());}
    public record Presence(Long guardId,Long gateId,Instant since){}
    public List<Presence> active(String tenant){
        List<Presence> result=new ArrayList<>();
        sessions.forEach((id,session)->{try{
            if(!tenant.equals(session.getAttribute("securityConsoleTenant")))return;
            Instant since=(Instant)session.getAttribute("securityConsoleStarted");
            if(since!=null&&since.plusSeconds(12*3600).isAfter(Instant.now())&&session.getAttribute("securityConsoleToken")!=null)
                result.add(new Presence((Long)session.getAttribute("securityConsoleGuard"),(Long)session.getAttribute("securityConsoleGate"),since));
        }catch(IllegalStateException ex){sessions.remove(id);}});return result;
    }
}
