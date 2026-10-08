package com.smartapartment.security;

import com.smartapartment.repository.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.security.SecurityProperties;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Set;

/** Rechecks society account access for existing browser sessions after deactivation. */
@Component
@Order(SecurityProperties.DEFAULT_FILTER_ORDER + 1)
public class SocietyAccountAccessFilter extends OncePerRequestFilter {
    private static final Set<String> DASHBOARDS=Set.of("/dashboards/superadmin","/dashboards/society-admin",
            "/dashboards/resident","/dashboards/security","/dashboards/maintenance","/dashboards/maintenance-worker","/dashboards/accountant");
    private final AppUserRepository users;
    public SocietyAccountAccessFilter(AppUserRepository users){this.users=users;}
    @Override protected boolean shouldNotFilter(HttpServletRequest request){
        String path=request.getRequestURI().substring(request.getContextPath().length());
        return !path.startsWith("/api/society/")&&!DASHBOARDS.contains(path);
    }
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws IOException,ServletException {
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        if(authentication!=null&&authentication.isAuthenticated()&&!"anonymousUser".equals(authentication.getPrincipal())){
            var user=users.findByEmail(authentication.getName()).orElse(null);
            if(user!=null&&(user.isAccountLocked()||"INACTIVE".equalsIgnoreCase(user.getStatus()))){
                SecurityContextHolder.clearContext();var session=request.getSession(false);if(session!=null)session.invalidate();
                if(request.getRequestURI().substring(request.getContextPath().length()).startsWith("/api/")){
                    response.setStatus(401);response.setContentType("application/json");
                    response.getWriter().write("{\"message\":\"This society account has been deactivated or locked. Contact your administrator.\"}");
                }else response.sendRedirect(request.getContextPath()+"/");
                return;
            }
        }
        chain.doFilter(request,response);
    }
}
