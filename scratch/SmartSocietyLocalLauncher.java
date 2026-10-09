import org.springframework.boot.SpringApplication;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;

// Local preview launcher: avoid the Windows selector loopback failure.
class SmartSocietyLocalLauncher {
    static class LocalConnector implements WebServerFactoryCustomizer<TomcatServletWebServerFactory> {
        public void customize(TomcatServletWebServerFactory factory) {
            factory.setProtocol("org.apache.coyote.http11.Http11Nio2Protocol");
        }
    }
    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(com.smartapartment.SmartApartmentApplication.class);
        app.setAdditionalProfiles("smartsociety-local");
        app.addInitializers(context -> context.getBeanFactory().registerSingleton("societyLocalConnector", new LocalConnector()));
        app.run(args);
    }
}
