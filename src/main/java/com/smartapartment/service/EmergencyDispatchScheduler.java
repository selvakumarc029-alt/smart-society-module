package com.smartapartment.service;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
@Component
public class EmergencyDispatchScheduler {
    private final EmergencyMaintenanceService service;
    public EmergencyDispatchScheduler(EmergencyMaintenanceService service){this.service=service;}
    @Scheduled(fixedDelay=15000,initialDelay=15000)
    public void dispatch(){
        service.retryPending();
        try {
            service.processMaintenanceQueueAndAutoAssign("smartsociety");
        } catch (Exception ignored) {}
    }
}
