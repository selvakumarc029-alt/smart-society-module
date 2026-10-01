package com.smartapartment.repository;

import com.smartapartment.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByConversationIdOrderByCreatedAtAsc(Long conversationId);

    List<ChatMessage> findByConversationIdInOrderByCreatedAtAsc(List<Long> conversationIds);

    long countByConversationIdAndSenderRoleNotAndIsReadFalse(Long conversationId, String senderRole);

    @Transactional
    @Modifying
    @Query("UPDATE ChatMessage m SET m.isRead = true WHERE m.conversationId = :conversationId AND m.senderRole <> :readerRole")
    void markConversationAsRead(@Param("conversationId") Long conversationId, @Param("readerRole") String readerRole);
}
