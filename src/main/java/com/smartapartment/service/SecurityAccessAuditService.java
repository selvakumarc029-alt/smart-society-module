package com.smartapartment.service;
import com.smartapartment.entity.*;
import com.smartapartment.repository.SecurityAccessLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Service @RequiredArgsConstructor
public class SecurityAccessAuditService {
    private final SecurityAccessLogRepository logs;
    @Transactional public Long login(AppUser user){
        var log=new SecurityAccessLog();log.setTenantId(user.getTenantId());log.setUserId(user.getId());log.setGuardName(user.getFullName());log.setLoginAt(LocalDateTime.now());return logs.save(log).getId();
    }
    @Transactional public void close(Long id,String reason){
        if(id==null)return;
        logs.findById(id).filter(l->l.getLogoutAt()==null).ifPresent(l->{l.setLogoutAt(LocalDateTime.now());l.setEndReason(reason);logs.save(l);});
    }
}
