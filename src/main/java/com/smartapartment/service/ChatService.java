package com.smartapartment.service;

import com.smartapartment.dto.ChatDtos.*;
import com.smartapartment.entity.ChatConversation;
import com.smartapartment.entity.ChatMessage;
import com.smartapartment.entity.MaintenanceRequest;
import com.smartapartment.repository.ChatConversationRepository;
import com.smartapartment.repository.ChatMessageRepository;
import com.smartapartment.repository.MaintenanceRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChatService {

    private final ChatConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;
    private final MaintenanceRequestRepository maintenanceRequestRepository;
    private final CurrentUserService currentUser;
    private final com.smartapartment.repository.ResidentRepository residents;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("hh:mm a");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd MMM, hh:mm a");

    public ChatService(ChatConversationRepository conversationRepository,
                       ChatMessageRepository messageRepository,
                       MaintenanceRequestRepository maintenanceRequestRepository,
                       CurrentUserService currentUser,
                       com.smartapartment.repository.ResidentRepository residents) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.maintenanceRequestRepository = maintenanceRequestRepository;
        this.currentUser = currentUser;
        this.residents = residents;

    }

    /**
     * Resolves or creates a ChatConversation linked directly to the maintenance request / ticket.
     */
    @Transactional
    public ChatConversation resolveOrCreateConversation(SendMessageRequest req) {
        String convType = req.getConversationType() != null && !req.getConversationType().isBlank()
                ? req.getConversationType()
                : (req.getChannelType() != null && !req.getChannelType().isBlank() ? req.getChannelType() : "CUSTOMER_MAINTENANCE");

        // 1. By conversationId (numeric)
        if (req.getConversationId() != null) {
            Optional<ChatConversation> byId = conversationRepository.findById(req.getConversationId());
            if (byId.isPresent()) {
                requireAccess(byId.get());
                return byId.get();
            }
        }

        // 2. By ticketNumber and conversationType
        String ticketNum = extractTicketNumber(req);
        if (ticketNum != null && !ticketNum.isBlank()) {
            Optional<ChatConversation> byTicket = conversationRepository.findByTicketNumberAndConversationType(ticketNum, convType);
            if (byTicket.isPresent()) {
                requireAccess(byTicket.get());
                return byTicket.get();
            }
        }

        // 3. By maintenanceRequestId and conversationType
        if (req.getMaintenanceRequestId() != null) {
            Optional<ChatConversation> byReqId = conversationRepository.findByMaintenanceRequestIdAndConversationType(req.getMaintenanceRequestId(), convType);
            if (byReqId.isPresent()) {
                requireAccess(byReqId.get());
                return byReqId.get();
            }
        }

        // 4. Create new conversation connected to ticket
        ChatConversation conv = new ChatConversation();
        conv.setTenantId(currentUser.requireTenantId());
        if ("CUSTOMER".equals(req.getSenderRole())) conv.setCustomerId(currentUser.requireUser().getEmail());
        conv.setConversationType(convType);
        conv.setTicketNumber(ticketNum != null ? ticketNum : "TICKET-" + System.currentTimeMillis());
        conv.setTicketTitle(req.getTicketTitle() != null ? req.getTicketTitle() : "Maintenance Request");
        conv.setStatus("OPEN");
        conv.setMaintenanceRequestId(req.getMaintenanceRequestId());
        if (req.getMaintenanceRequestId()!=null) {
            var request=maintenanceRequestRepository.findById(req.getMaintenanceRequestId()).orElseThrow(() ->
                    new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"Request was not found"));
            requireRequestAccess(request);
        }

        // Attempt to enrich from MaintenanceRequest entity if available
        if (ticketNum != null) {
            maintenanceRequestRepository.findByRequestNumber(ticketNum).ifPresent(mr -> {
                requireRequestAccess(mr);
                conv.setMaintenanceRequestId(mr.getId());
                if (conv.getTicketTitle() == null || conv.getTicketTitle().equals("Maintenance Request")) {
                    conv.setTicketTitle(mr.getTitle());
                }
                if (conv.getCustomerId() == null) conv.setCustomerId(String.valueOf(mr.getResidentId()));
                if (conv.getCustomerName() == null) conv.setCustomerName(mr.getResidentName());
                if (conv.getCustomerUnit() == null) conv.setCustomerUnit(mr.getApartmentUnit());
                if (conv.getMaintenanceUserName() == null) conv.setMaintenanceUserName(mr.getAssignedWorkerName());
            });
        }

        if (conv.getCustomerName() == null) {
            conv.setCustomerName(req.getSenderRole() != null && req.getSenderRole().equals("CUSTOMER") ? req.getSenderName() : "Resident");
        }
        if (conv.getCustomerUnit() == null) {
            conv.setCustomerUnit(req.getSenderUnit() != null ? req.getSenderUnit() : "");
        }
        if (conv.getMaintenanceUserName() == null) {
            conv.setMaintenanceUserName(req.getSenderRole() != null && req.getSenderRole().equals("MAINTENANCE") ? req.getSenderName() : "Maintenance Crew");
        }
        if (conv.getAdminName() == null) {
            conv.setAdminName(req.getSenderRole() != null && req.getSenderRole().equals("ADMIN") ? req.getSenderName() : "Society Admin");
        }

        conv.setCreatedAt(LocalDateTime.now());
        conv.setUpdatedAt(LocalDateTime.now());
        requireAccess(conv);
        return conversationRepository.save(conv);
    }

    private String extractTicketNumber(SendMessageRequest req) {
        if (req.getTicketNumber() != null && !req.getTicketNumber().isBlank()) {
            return req.getTicketNumber().trim().replace("#", "");
        }
        String key = req.getConversationKey();
        if (key == null) key = "";
        if (key.startsWith("req_")) {
            String sub = key.substring(4);
            int idx = sub.lastIndexOf('_');
            if (idx > 0) {
                return sub.substring(0, idx);
            }
            return sub;
        }
        return null;
    }

    private String extractTicketNumberFromKey(String key) {
        if (key == null || key.isBlank()) return null;
        if (key.startsWith("req_")) {
            String sub = key.substring(4);
            int idx = sub.lastIndexOf('_');
            if (idx > 0) {
                return sub.substring(0, idx);
            }
            return sub;
        }
        return key;
    }

    /**
     * Resolves conversation by either numeric ID or string key (e.g. req_REQ-1024_cust, req_REQ-1024_admin).
     */
    public Optional<ChatConversation> resolveConversation(String convIdOrKey, String fallbackType) {
        if (convIdOrKey == null || convIdOrKey.isBlank()) {
            return Optional.empty();
        }

        // Try numeric ID
        try {
            Long numericId = Long.parseLong(convIdOrKey.trim());
            Optional<ChatConversation> byId = conversationRepository.findById(numericId);
            if (byId.isPresent()) {
                return byId;
            }
        } catch (NumberFormatException ignored) {}

        // Parse key like "req_REQ-1024_cust" or "req_REQ-1024_admin"
        String convType = fallbackType;
        if (convIdOrKey.endsWith("_admin")) {
            convType = "MAINTENANCE_ADMIN";
        } else if (convIdOrKey.endsWith("_cust")) {
            convType = "CUSTOMER_MAINTENANCE";
        }
        if (convType == null || convType.isBlank()) {
            convType = "CUSTOMER_MAINTENANCE";
        }

        String ticketNum = extractTicketNumberFromKey(convIdOrKey);
        if (ticketNum != null) {
            Optional<ChatConversation> byTicket = conversationRepository.findByTicketNumberAndConversationType(ticketNum, convType);
            if (byTicket.isPresent()) {
                return byTicket;
            }
        }

        // Check by ticket number directly
        return conversationRepository.findByTicketNumberAndConversationType(convIdOrKey.trim().replace("#", ""), convType);
    }

    /**
     * Sends a new chat message connected to the conversation and ticket.
     */
    @Transactional
    public ChatMessageResponse sendMessage(SendMessageRequest req) {
        var actor=currentUser.requireUser();
        if (!java.util.Set.of(com.smartapartment.entity.UserRole.RESIDENT, com.smartapartment.entity.UserRole.MAINTENANCE_STAFF,
                com.smartapartment.entity.UserRole.SOCIETY_ADMIN, com.smartapartment.entity.UserRole.FACILITY_MANAGER).contains(actor.getRole()))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN);
        req.setSenderRole(actor.getRole()==com.smartapartment.entity.UserRole.RESIDENT ? "CUSTOMER"
                : actor.getRole()==com.smartapartment.entity.UserRole.MAINTENANCE_STAFF ? "MAINTENANCE" : "ADMIN");
        req.setSenderId(actor.getEmail());req.setSenderEmail(actor.getEmail());req.setSenderName(actor.getFullName());
        if (req.getMessage()==null || req.getMessage().isBlank())
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Message is required");
        ChatConversation conversation = resolveOrCreateConversation(req);

        ChatMessage msg = new ChatMessage();
        msg.setConversationId(conversation.getId());
        msg.setSenderId(req.getSenderId() != null ? req.getSenderId() : (req.getSenderEmail() != null ? req.getSenderEmail() : req.getSenderName()));
        msg.setSenderRole(req.getSenderRole() != null ? req.getSenderRole() : "CUSTOMER");
        msg.setSenderName(req.getSenderName() != null ? req.getSenderName() : "User");
        msg.setMessage(req.getMessage() != null ? req.getMessage().trim() : "");
        msg.setMessageType(req.getMessageType() != null && !req.getMessageType().isBlank() ? req.getMessageType() : "TEXT");
        msg.setRead(false);
        msg.setCreatedAt(LocalDateTime.now());

        ChatMessage saved = messageRepository.save(msg);

        // Update conversation timestamp
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conversation);

        return mapToResponse(saved, conversation);
    }

    /**
     * Retrieves messages for a conversation, enforcing security separation.
     */
    @Transactional
    public List<ChatMessageResponse> getMessages(String conversationId, String channelType, String viewerRole) {
        Optional<ChatConversation> convOpt = resolveConversation(conversationId, channelType);
        if (convOpt.isEmpty()) {
            return Collections.emptyList();
        }

        ChatConversation conv = convOpt.get();
        requireAccess(conv);

        // STRICT SEPARATION: Customer CANNOT view MAINTENANCE_ADMIN conversations
        if ("CUSTOMER".equalsIgnoreCase(viewerRole) && "MAINTENANCE_ADMIN".equalsIgnoreCase(conv.getConversationType())) {
            return Collections.emptyList();
        }

        // Mark incoming messages as read
        if (viewerRole != null && !viewerRole.isBlank()) {
            messageRepository.markConversationAsRead(conv.getId(), viewerRole);
        }

        List<ChatMessage> list = messageRepository.findByConversationIdOrderByCreatedAtAsc(conv.getId());
        return list.stream()
                .map(m -> mapToResponse(m, conv))
                .collect(Collectors.toList());
    }

    /**
     * Lists conversation threads for the given channel, enforcing security rules.
     */
    public List<ConversationSummary> getConversations(String channelType, String viewerRole) {
        String queryType = (channelType != null && !channelType.isBlank()) ? channelType : "CUSTOMER_MAINTENANCE";

        // Security check
        if ("CUSTOMER".equalsIgnoreCase(viewerRole) && "MAINTENANCE_ADMIN".equalsIgnoreCase(queryType)) {
            return Collections.emptyList();
        }

        List<ChatConversation> conversations = conversationRepository.findByConversationTypeOrderByUpdatedAtDesc(queryType);
        List<ConversationSummary> summaries = new ArrayList<>();

        for (ChatConversation conv : conversations) {
            if (!canAccess(conv)) continue;
            List<ChatMessage> msgs = messageRepository.findByConversationIdOrderByCreatedAtAsc(conv.getId());
            String lastMsgText = "No messages yet";
            String lastSender = "";
            String formattedTime = "";
            long unread = 0;

            if (!msgs.isEmpty()) {
                ChatMessage latest = msgs.get(msgs.size() - 1);
                lastMsgText = latest.getMessage();
                lastSender = latest.getSenderName() != null ? latest.getSenderName() : latest.getSenderRole();
                formattedTime = formatTime(latest.getCreatedAt());
            }

            if (viewerRole != null && !viewerRole.isBlank()) {
                unread = messageRepository.countByConversationIdAndSenderRoleNotAndIsReadFalse(conv.getId(), viewerRole);
            }

            String convKey = "req_" + conv.getTicketNumber() + (conv.getConversationType().equals("MAINTENANCE_ADMIN") ? "_admin" : "_cust");

            summaries.add(ConversationSummary.builder()
                    .id(conv.getId())
                    .conversationId(conv.getId())
                    .conversationKey(convKey)
                    .maintenanceRequestId(conv.getMaintenanceRequestId())
                    .ticketNumber(conv.getTicketNumber())
                    .ticketTitle(conv.getTicketTitle())
                    .channelType(conv.getConversationType())
                    .conversationType(conv.getConversationType())
                    .customerId(conv.getCustomerId())
                    .customerName(conv.getCustomerName())
                    .customerUnit(conv.getCustomerUnit())
                    .maintenanceUserId(conv.getMaintenanceUserId())
                    .maintenanceUserName(conv.getMaintenanceUserName())
                    .adminId(conv.getAdminId())
                    .adminName(conv.getAdminName())
                    .title(conv.getTicketTitle() != null ? conv.getTicketTitle() : "Ticket #" + conv.getTicketNumber())
                    .subtitle(conv.getCustomerUnit() != null ? conv.getCustomerUnit() + " · " + conv.getCustomerName() : "Ticket #" + conv.getTicketNumber())
                    .unit(conv.getCustomerUnit())
                    .lastMessage(lastMsgText)
                    .lastSender(lastSender)
                    .formattedTime(formattedTime)
                    .unreadCount(unread)
                    .status(conv.getStatus())
                    .createdAt(conv.getCreatedAt())
                    .updatedAt(conv.getUpdatedAt())
                    .build());
        }

        return summaries;
    }

    /**
     * Marks messages in a conversation as read.
     */
    @Transactional
    public void markConversationAsRead(String convId, String readerRole) {
        resolveConversation(convId, null).ifPresent(conv -> {
            requireAccess(conv);
            messageRepository.markConversationAsRead(conv.getId(), readerRole);
        });
    }

    private void requireAccess(ChatConversation conversation) {
        if (!canAccess(conversation)) throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.FORBIDDEN,"This conversation is not available to your account");
    }

    private boolean canAccess(ChatConversation conversation) {
        var actor=currentUser.requireUser();
        String tenant=conversation.getTenantId();
        if (tenant==null && conversation.getMaintenanceRequestId()!=null)
            tenant=maintenanceRequestRepository.findById(conversation.getMaintenanceRequestId()).map(com.smartapartment.entity.MaintenanceRequest::getTenantId).orElse(null);
        if (!java.util.Objects.equals(actor.getTenantId(),tenant) || tenant==null) return false;
        if (actor.getRole()==com.smartapartment.entity.UserRole.RESIDENT) {
            if (!"CUSTOMER_MAINTENANCE".equals(conversation.getConversationType())) return false;
            String customer=conversation.getCustomerId();
            return actor.getEmail().equalsIgnoreCase(customer==null ? "" : customer)
                    || residents.findFirstByUserOrderByIdAsc(actor).map(profile -> String.valueOf(profile.getId()).equals(customer)).orElse(false);
        }
        return actor.getRole()==com.smartapartment.entity.UserRole.SOCIETY_ADMIN
                || actor.getRole()==com.smartapartment.entity.UserRole.FACILITY_MANAGER
                || actor.getRole()==com.smartapartment.entity.UserRole.MAINTENANCE_STAFF;
    }

    private void requireRequestAccess(com.smartapartment.entity.MaintenanceRequest request) {
        var actor=currentUser.requireUser();
        if (!java.util.Objects.equals(actor.getTenantId(),request.getTenantId())
                || actor.getRole()==com.smartapartment.entity.UserRole.RESIDENT
                && !actor.getEmail().equalsIgnoreCase(request.getResidentEmail()==null ? "" : request.getResidentEmail()))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN,"Request belongs to another account");
    }

    /**
     * Computes unread counts for navigation badges.
     */
    public UnreadCountSummary getUnreadSummary(String userRole) {
        long custUnread = 0;
        long adminUnread = 0;

        List<ChatConversation> custConvs = conversationRepository.findByConversationTypeOrderByUpdatedAtDesc("CUSTOMER_MAINTENANCE");
        for (ChatConversation c : custConvs) {
            if (!canAccess(c)) continue;
            custUnread += messageRepository.countByConversationIdAndSenderRoleNotAndIsReadFalse(c.getId(), userRole);
        }

        if (!"CUSTOMER".equalsIgnoreCase(userRole)) {
            List<ChatConversation> adminConvs = conversationRepository.findByConversationTypeOrderByUpdatedAtDesc("MAINTENANCE_ADMIN");
            for (ChatConversation c : adminConvs) {
                if (!canAccess(c)) continue;
                adminUnread += messageRepository.countByConversationIdAndSenderRoleNotAndIsReadFalse(c.getId(), userRole);
            }
        }

        return UnreadCountSummary.builder()
                .customerMaintenanceUnread(custUnread)
                .maintenanceAdminUnread(adminUnread)
                .totalUnread(custUnread + adminUnread)
                .build();
    }

    private ChatMessageResponse mapToResponse(ChatMessage msg, ChatConversation conv) {
        String convKey = "req_" + conv.getTicketNumber() + (conv.getConversationType().equals("MAINTENANCE_ADMIN") ? "_admin" : "_cust");

        return ChatMessageResponse.builder()
                .id(msg.getId())
                .conversationId(conv.getId())
                .conversationKey(convKey)
                .maintenanceRequestId(conv.getMaintenanceRequestId())
                .ticketNumber(conv.getTicketNumber())
                .ticketTitle(conv.getTicketTitle())
                .channelType(conv.getConversationType())
                .conversationType(conv.getConversationType())
                .senderId(msg.getSenderId())
                .senderRole(msg.getSenderRole())
                .senderName(msg.getSenderName())
                .senderUnit(msg.getSenderRole().equals("CUSTOMER") ? conv.getCustomerUnit() : (msg.getSenderRole().equals("MAINTENANCE") ? "Maintenance Team" : "Admin Board"))
                .message(msg.getMessage())
                .messageType(msg.getMessageType())
                .isRead(msg.isRead())
                .createdAt(msg.getCreatedAt())
                .formattedTime(formatTime(msg.getCreatedAt()))
                .build();
    }

    private String formatTime(LocalDateTime dt) {
        if (dt == null) return "";
        if (dt.toLocalDate().isEqual(LocalDateTime.now().toLocalDate())) {
            return dt.format(TIME_FORMATTER);
        }
        return dt.format(DATE_TIME_FORMATTER);
    }
}
