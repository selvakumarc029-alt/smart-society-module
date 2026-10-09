import java.lang.reflect.*;
import java.util.*;
import com.smartapartment.entity.*;
import com.smartapartment.repository.*;
import com.smartapartment.controller.AdminInsightsApiController;
import com.smartapartment.service.CurrentUserService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
public class SocietyServiceScopeCheck {
 public static void main(String[] args) throws Exception {
  AppUser admin=new AppUser();admin.setEmail("admin@test.local");admin.setTenantId("society-a");admin.setRole(UserRole.SOCIETY_ADMIN);
  AppUserRepository users=(AppUserRepository)Proxy.newProxyInstance(AppUserRepository.class.getClassLoader(),new Class[]{AppUserRepository.class},(p,m,a)->Optional.of(admin));
  List<CommonMaintenanceTicket> rows=new ArrayList<>();
  for(String[] data:new String[][]{{"society-a","smartsociety"},{"society-b","smartsociety"},{"society-a","propertydirect"}}){var t=new CommonMaintenanceTicket();t.setTenantId(data[0]);t.setSourcePlatform(data[1]);rows.add(t);}
  var repo=(CommonMaintenanceTicketRepository)Proxy.newProxyInstance(CommonMaintenanceTicketRepository.class.getClassLoader(),new Class[]{CommonMaintenanceTicketRepository.class},(p,m,a)->rows);
  var ctor=AdminInsightsApiController.class.getConstructors()[0];Object[] values=new Object[ctor.getParameterCount()];
  for(int i=0;i<values.length;i++){var type=ctor.getParameterTypes()[i];values[i]=type==CurrentUserService.class?new CurrentUserService(users):type==CommonMaintenanceTicketRepository.class?repo:null;}
  var controller=(AdminInsightsApiController)ctor.newInstance(values);
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(admin.getEmail(),"",List.of()));
  try {if(controller.serviceRequests().size()!=1 || controller.serviceRequests().get(0)!=rows.get(0))throw new AssertionError("Scope leak");System.out.println("Society and platform isolation passed.");}finally{SecurityContextHolder.clearContext();}
 }
}