import java.lang.reflect.*;
import java.util.*;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.controller.AdminInsightsApiController;
import com.smartapartment.service.CurrentUserService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
public class ResidentNoticeCheck {
 static Object repository(Class<?> type, java.lang.reflect.InvocationHandler handler) {return Proxy.newProxyInstance(type.getClassLoader(),new Class[]{type},handler);}
 public static void main(String[] args) throws Exception {
  AppUser admin=new AppUser();admin.setEmail("admin@test.local");admin.setTenantId("society-a");admin.setRole(UserRole.SOCIETY_ADMIN);
  AppUser recipient=new AppUser();recipient.setId(12L);recipient.setTenantId("society-a");recipient.setRole(UserRole.RESIDENT);
  final Notification[] saved={null};
  AppUserRepository users=(AppUserRepository)repository(AppUserRepository.class,(p,m,a)->Optional.of(m.getName().equals("findByEmail")?admin:recipient));
  NotificationRepository notices=(NotificationRepository)repository(NotificationRepository.class,(p,m,a)->{saved[0]=(Notification)a[0];saved[0].setId(1L);return saved[0];});
  var ctor=AdminInsightsApiController.class.getConstructors()[0];Object[] values=new Object[ctor.getParameterCount()];
  for(int i=0;i<values.length;i++){Class<?> type=ctor.getParameterTypes()[i];values[i]=type==CurrentUserService.class?new CurrentUserService(users):type==AppUserRepository.class?users:type==NotificationRepository.class?notices:null;}
  var controller=(AdminInsightsApiController)ctor.newInstance(values);
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(admin.getEmail(),"",List.of()));
  try {
   controller.notifyResident(new AdminInsightsApiController.ResidentNotice("resident@test.local","  Hello resident  "));
   if(!saved[0].getUserId().equals(12L)||!saved[0].getTenantId().equals("society-a")||!saved[0].getMessage().equals("Hello resident"))throw new AssertionError("Incorrect recipient");
   recipient.setTenantId("society-b"); saved[0]=null;
   try {controller.notifyResident(new AdminInsightsApiController.ResidentNotice("resident@test.local","Hello"));throw new AssertionError("Cross-tenant notification allowed");}catch(org.springframework.web.server.ResponseStatusException expected){if(expected.getStatusCode().value()!=404||saved[0]!=null)throw new AssertionError("Cross-tenant save");}
   System.out.println("Recipient targeting and cross-society isolation tests passed.");
  }finally{SecurityContextHolder.clearContext();}
 }
}