package com.smartapartment.config;

import com.smartapartment.entity.UserRole;
import com.smartapartment.service.CurrentUserService;
import com.smartapartment.service.SecurityAccessAuditService;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;

/** Tracks Society guard access without changing PropertyDirect authentication. */
@Component @RequiredArgsConstructor
public class SocietySecuritySessionAudit implements WebMvcConfigurer,HandlerInterceptor,HttpSessionListener {
    private static final String KEY="society:security:accessLog";
    private final CurrentUserService current;
    private final SecurityAccessAuditService audit;
    @Override public void addInterceptors(InterceptorRegistry registry){registry.addInterceptor(this).addPathPatterns("/api/auth/dashboard-login","/dashboards/security","/dashboards/logout");}
    @Override public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler){
        if("/dashboards/logout".equals(request.getRequestURI())){
            var session=request.getSession(false);if(session!=null){audit.close((Long)session.getAttribute(KEY),"SIGNED_OUT");session.removeAttribute(KEY);}
        }
        return true;
    }
    @Override public void afterCompletion(HttpServletRequest request,HttpServletResponse response,Object handler,Exception ex){
        if(ex!=null||response.getStatus()!=200||"/dashboards/logout".equals(request.getRequestURI()))return;
        var session=request.getSession(false);if(session==null||session.getAttribute(KEY)!=null||!Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:security")))return;
        var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if(auth==null||auth.getAuthorities().stream().noneMatch(a->"ROLE_SECURITY_STAFF".equals(a.getAuthority())))return;
        var user=current.requireUser();if(user.getRole()==UserRole.SECURITY_STAFF)session.setAttribute(KEY,audit.login(user));
    }
    @Override public void sessionDestroyed(HttpSessionEvent event){audit.close((Long)event.getSession().getAttribute(KEY),"SESSION_ENDED");}
}
