import java.time.LocalDate;
import org.springframework.core.MethodParameter;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.method.annotation.RequestParamMethodArgumentResolver;
import org.springframework.web.bind.support.DefaultDataBinderFactory;
import org.springframework.web.bind.support.ConfigurableWebBindingInitializer;
import org.springframework.format.support.DefaultFormattingConversionService;
public class DateBindingCheck {
 public static void main(String[] args) throws Exception {
  var initializer = new ConfigurableWebBindingInitializer(); initializer.setConversionService(new DefaultFormattingConversionService());
  var binder = new DefaultDataBinderFactory(initializer);
  var resolver = new RequestParamMethodArgumentResolver(false);
  var request = new MockHttpServletRequest(); request.setParameter("start","2026-10-09"); request.setParameter("end","2026-10-10");
  for(String name : new String[]{"maintenance","security"}) {
   var method = com.smartapartment.controller.AdminInsightsApiController.class.getMethod(name, LocalDate.class, LocalDate.class);
   for(int i=0;i<2;i++) {
    var value=resolver.resolveArgument(new MethodParameter(method,i),null,new ServletWebRequest(request),binder);
    if(!LocalDate.of(2026,10,9+i).equals(value)) throw new AssertionError("Incorrect date binding");
   }
  }
  System.out.println("Maintenance and security ISO date parameter binding passed.");
 }
}