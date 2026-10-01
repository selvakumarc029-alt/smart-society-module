package com.smartapartment.repository;

import com.smartapartment.entity.ChatConversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatConversationRepository extends JpaRepository<ChatConversation, Long> {

    Optional<ChatConversation> findByMaintenanceRequestIdAndConversationType(Long maintenanceRequestId, String conversationType);

    Optional<ChatConversation> findByTicketNumberAndConversationType(String ticketNumber, String conversationType);

    List<ChatConversation> findByConversationTypeOrderByUpdatedAtDesc(String conversationType);

    List<ChatConversation> findByMaintenanceRequestIdOrderByUpdatedAtDesc(Long maintenanceRequestId);

    List<ChatConversation> findByCustomerIdAndConversationTypeOrderByUpdatedAtDesc(String customerId, String conversationType);

    List<ChatConversation> findByMaintenanceUserIdAndConversationTypeOrderByUpdatedAtDesc(String maintenanceUserId, String conversationType);
}
