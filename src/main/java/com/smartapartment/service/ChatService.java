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

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("hh:mm a");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd MMM, hh:mm a");

    public ChatService(ChatConversationRepository conversationRepository,
                       ChatMessageRepository messageRepository,
                       MaintenanceRequestRepository maintenanceRequestRepository) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.maintenanceRequestRepository = maintenanceRequestRepository;
        seedInitialChatData();
    }

    /**
     * Seeds initial conversation and message data connected to maintenance tickets.
     */
    private synchronized void seedInitialChatData() {
        try {
            if (conversationRepository.count() > 0) {
                return;
            }

            // Ticket 1: REQ-1024 (AC Repair) - Customer <-> Maintenance
            ChatConversation conv1 = new ChatConversation();
            conv1.setTicketNumber("REQ-1024");
            conv1.setTicketTitle("AC Repair");
            conv1.setConversationType("CUSTOMER_MAINTENANCE");
            conv1.setCustomerId("selva@smartsociety.com");
            conv1.setCustomerName("Selva");
            conv1.setCustomerUnit("Flat A-204");
            conv1.setMaintenanceUserId("kumar.tech");
            conv1.setMaintenanceUserName("Kumar");
            conv1.setStatus("OPEN");
            conv1.setCreatedAt(LocalDateTime.now().minusMinutes(40));
            conv1.setUpdatedAt(LocalDateTime.now().minusMinutes(10));
            
            maintenanceRequestRepository.findByRequestNumber("REQ-1024")
                    .or(() -> maintenanceRequestRepository.findByRequestNumber("MR-2026-00001"))
                    .ifPresent(mr -> conv1.setMaintenanceRequestId(mr.getId()));
            
            ChatConversation savedConv1 = conversationRepository.save(conv1);

            // Messages for REQ-1024
            ChatMessage m1_1 = new ChatMessage();
            m1_1.setConversationId(savedConv1.getId());
            m1_1.setSenderId("kumar.tech");
            m1_1.setSenderRole("MAINTENANCE");
            m1_1.setSenderName("Kumar");
            m1_1.setMessage("I have been assigned to your request.");
            m1_1.setMessageType("TEXT");
            m1_1.setRead(true);
            m1_1.setCreatedAt(LocalDateTime.now().minusMinutes(35));
            messageRepository.save(m1_1);

            ChatMessage m1_2 = new ChatMessage();
            m1_2.setConversationId(savedConv1.getId());
            m1_2.setSenderId("selva@smartsociety.com");
            m1_2.setSenderRole("CUSTOMER");
            m1_2.setSenderName("Selva");
            m1_2.setMessage("When will you reach?");
            m1_2.setMessageType("TEXT");
            m1_2.setRead(true);
            m1_2.setCreatedAt(LocalDateTime.now().minusMinutes(30));
            messageRepository.save(m1_2);

            ChatMessage m1_3 = new ChatMessage();
            m1_3.setConversationId(savedConv1.getId());
            m1_3.setSenderId("kumar.tech");
            m1_3.setSenderRole("MAINTENANCE");
            m1_3.setSenderName("Kumar");
            m1_3.setMessage("Approximately 15 minutes.");
            m1_3.setMessageType("TEXT");
            m1_3.setRead(true);
            m1_3.setCreatedAt(LocalDateTime.now().minusMinutes(25));
            messageRepository.save(m1_3);

            // 2 unread messages from customer for REQ-1024
            ChatMessage m1_4 = new ChatMessage();
            m1_4.setConversationId(savedConv1.getId());
            m1_4.setSenderId("selva@smartsociety.com");
            m1_4.setSenderRole("CUSTOMER");
            m1_4.setSenderName("Selva");
            m1_4.setMessage("Okay, I am at Flat A-204 right now.");
            m1_4.setMessageType("TEXT");
            m1_4.setRead(false);
            m1_4.setCreatedAt(LocalDateTime.now().minusMinutes(15));
            messageRepository.save(m1_4);

            ChatMessage m1_5 = new ChatMessage();
            m1_5.setConversationId(savedConv1.getId());
            m1_5.setSenderId("selva@smartsociety.com");
            m1_5.setSenderRole("CUSTOMER");
            m1_5.setSenderName("Selva");
            m1_5.setMessage("Please check the AC refrigerant level as well.");
            m1_5.setMessageType("TEXT");
            m1_5.setRead(false);
            m1_5.setCreatedAt(LocalDateTime.now().minusMinutes(10));
            messageRepository.save(m1_5);

            // Ticket 1: REQ-1024 (AC Repair) - Maintenance <-> Admin (INTERNAL ESCALATION)
            ChatConversation conv1Admin = new ChatConversation();
            conv1Admin.setTicketNumber("REQ-1024");
            conv1Admin.setTicketTitle("AC Repair · Part Replacement Approval");
            conv1Admin.setConversationType("MAINTENANCE_ADMIN");
            conv1Admin.setCustomerId("selva@smartsociety.com");
            conv1Admin.setCustomerName("Selva");
            conv1Admin.setCustomerUnit("Flat A-204");
            conv1Admin.setMaintenanceUserId("kumar.tech");
            conv1Admin.setMaintenanceUserName("Kumar");
            conv1Admin.setAdminId("admin.office");
            conv1Admin.setAdminName("Society Admin Office");
            conv1Admin.setStatus("OPEN");
            conv1Admin.setCreatedAt(LocalDateTime.now().minusMinutes(20));
            conv1Admin.setUpdatedAt(LocalDateTime.now().minusMinutes(5));
            if (conv1.getMaintenanceRequestId() != null) {
                conv1Admin.setMaintenanceRequestId(conv1.getMaintenanceRequestId());
            }
            ChatConversation savedConv1Admin = conversationRepository.save(conv1Admin);

            ChatMessage m1Admin_1 = new ChatMessage();
            m1Admin_1.setConversationId(savedConv1Admin.getId());
            m1Admin_1.setSenderId("kumar.tech");
            m1Admin_1.setSenderRole("MAINTENANCE");
            m1Admin_1.setSenderName("Kumar");
            m1Admin_1.setMessage("Inspected AC for Flat A-204 (Ticket #REQ-1024). Compressor start capacitor is blown. Replacement part cost: Rs. 1,800. Requesting board approval.");
            m1Admin_1.setMessageType("TEXT");
            m1Admin_1.setRead(true);
            m1Admin_1.setCreatedAt(LocalDateTime.now().minusMinutes(15));
            messageRepository.save(m1Admin_1);

            ChatMessage m1Admin_2 = new ChatMessage();
            m1Admin_2.setConversationId(savedConv1Admin.getId());
            m1Admin_2.setSenderId("admin.office");
            m1Admin_2.setSenderRole("ADMIN");
            m1Admin_2.setSenderName("Society Admin Office");
            m1Admin_2.setMessage("Approved. Use certified OEM spare and log vendor invoice under society maintenance budget.");
            m1Admin_2.setMessageType("TEXT");
            m1Admin_2.setRead(true);
            m1Admin_2.setCreatedAt(LocalDateTime.now().minusMinutes(5));
            messageRepository.save(m1Admin_2);

            // Ticket 2: REQ-1025 (Plumbing) - Customer <-> Maintenance
            ChatConversation conv2 = new ChatConversation();
            conv2.setTicketNumber("REQ-1025");
            conv2.setTicketTitle("Plumbing");
            conv2.setConversationType("CUSTOMER_MAINTENANCE");
            conv2.setCustomerId("arun@smartsociety.com");
            conv2.setCustomerName("Arun");
            conv2.setCustomerUnit("Flat B-103");
            conv2.setMaintenanceUserId("ramesh.plumber");
            conv2.setMaintenanceUserName("Ramesh (Plumber)");
            conv2.setStatus("OPEN");
            conv2.setCreatedAt(LocalDateTime.now().minusHours(1));
            conv2.setUpdatedAt(LocalDateTime.now().minusMinutes(18));
            ChatConversation savedConv2 = conversationRepository.save(conv2);

            ChatMessage m2_1 = new ChatMessage();
            m2_1.setConversationId(savedConv2.getId());
            m2_1.setSenderId("ramesh.plumber");
            m2_1.setSenderRole("MAINTENANCE");
            m2_1.setSenderName("Ramesh (Plumber)");
            m2_1.setMessage("I have taken up your plumbing request.");
            m2_1.setMessageType("TEXT");
            m2_1.setRead(true);
            m2_1.setCreatedAt(LocalDateTime.now().minusMinutes(30));
            messageRepository.save(m2_1);

            // 1 unread message from customer for REQ-1025
            ChatMessage m2_2 = new ChatMessage();
            m2_2.setConversationId(savedConv2.getId());
            m2_2.setSenderId("arun@smartsociety.com");
            m2_2.setSenderRole("CUSTOMER");
            m2_2.setSenderName("Arun");
            m2_2.setMessage("Water is leaking from the sink tap. Please bring new gasket.");
            m2_2.setMessageType("TEXT");
            m2_2.setRead(false);
            m2_2.setCreatedAt(LocalDateTime.now().minusMinutes(18));
            messageRepository.save(m2_2);

            // Ticket 2: T-102 (Bathroom Water Leakage) - Maintenance <-> Admin (INTERNAL ESCALATION)
            ChatConversation conv2Admin = new ChatConversation();
            conv2Admin.setTicketNumber("T-102");
            conv2Admin.setTicketTitle("Bathroom Water Leakage (AMC Corrosion Notice)");
            conv2Admin.setConversationType("MAINTENANCE_ADMIN");
            conv2Admin.setCustomerId("kavya@smartsociety.com");
            conv2Admin.setCustomerName("Kavya N");
            conv2Admin.setCustomerUnit("Flat A-101");
            conv2Admin.setMaintenanceUserId("suresh.lead");
            conv2Admin.setMaintenanceUserName("Lead Engineer Suresh");
            conv2Admin.setAdminId("admin.office");
            conv2Admin.setAdminName("Society Admin Office");
            conv2Admin.setStatus("OPEN");
            conv2Admin.setCreatedAt(LocalDateTime.now().minusHours(1));
            conv2Admin.setUpdatedAt(LocalDateTime.now().minusMinutes(35));
            ChatConversation savedConv2Admin = conversationRepository.save(conv2Admin);

            ChatMessage m2Admin_1 = new ChatMessage();
            m2Admin_1.setConversationId(savedConv2Admin.getId());
            m2Admin_1.setSenderId("suresh.lead");
            m2Admin_1.setSenderRole("MAINTENANCE");
            m2Admin_1.setSenderName("Lead Engineer Suresh");
            m2Admin_1.setMessage("Internal note for #T-102: Main riser shaft shows early salt scaling. Recommended to include in quarterly plumbing AMC check.");
            m2Admin_1.setMessageType("TEXT");
            m2Admin_1.setRead(true);
            m2Admin_1.setCreatedAt(LocalDateTime.now().minusMinutes(35));
            messageRepository.save(m2Admin_1);

            // Ticket 3: T-102 (Bathroom Water Leakage) - Customer <-> Maintenance
            ChatConversation convT102 = new ChatConversation();
            convT102.setTicketNumber("T-102");
            convT102.setTicketTitle("Bathroom Water Leakage");
            convT102.setConversationType("CUSTOMER_MAINTENANCE");
            convT102.setCustomerId("selva@smartsociety.com");
            convT102.setCustomerName("Selva");
            convT102.setCustomerUnit("Flat A-101");
            convT102.setMaintenanceUserId("ramesh.plumber");
            convT102.setMaintenanceUserName("Ramesh (Plumber)");
            convT102.setStatus("OPEN");
            convT102.setCreatedAt(LocalDateTime.now().minusHours(1));
            convT102.setUpdatedAt(LocalDateTime.now().minusMinutes(22));
            ChatConversation savedConvT102 = conversationRepository.save(convT102);

            ChatMessage mT102_1 = new ChatMessage();
            mT102_1.setConversationId(savedConvT102.getId());
            mT102_1.setSenderId("ramesh.plumber");
            mT102_1.setSenderRole("MAINTENANCE");
            mT102_1.setSenderName("Ramesh (Plumber)");
            mT102_1.setMessage("Hello! I have taken up your bathroom water leakage request (Ticket #T-102).");
            mT102_1.setMessageType("TEXT");
            mT102_1.setRead(true);
            mT102_1.setCreatedAt(LocalDateTime.now().minusMinutes(40));
            messageRepository.save(mT102_1);

            ChatMessage mT102_2 = new ChatMessage();
            mT102_2.setConversationId(savedConvT102.getId());
            mT102_2.setSenderId("selva@smartsociety.com");
            mT102_2.setSenderRole("CUSTOMER");
            mT102_2.setSenderName("Selva");
            mT102_2.setMessage("Water is dripping continuously from the shower mixer valve onto the bathroom floor.");
            mT102_2.setMessageType("TEXT");
            mT102_2.setRead(true);
            mT102_2.setCreatedAt(LocalDateTime.now().minusMinutes(35));
            messageRepository.save(mT102_2);

            ChatMessage mT102_3 = new ChatMessage();
            mT102_3.setConversationId(savedConvT102.getId());
            mT102_3.setSenderId("ramesh.plumber");
            mT102_3.setSenderRole("MAINTENANCE");
            mT102_3.setSenderName("Ramesh (Plumber)");
            mT102_3.setMessage("Understood. I am on my way with replacement Teflon washers and sealing compound.");
            mT102_3.setMessageType("TEXT");
            mT102_3.setRead(true);
            mT102_3.setCreatedAt(LocalDateTime.now().minusMinutes(22));
            messageRepository.save(mT102_3);

        } catch (Exception e) {
            // Keep app bootstrap resilient
        }
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
                return byId.get();
            }
        }

        // 2. By ticketNumber and conversationType
        String ticketNum = extractTicketNumber(req);
        if (ticketNum != null && !ticketNum.isBlank()) {
            Optional<ChatConversation> byTicket = conversationRepository.findByTicketNumberAndConversationType(ticketNum, convType);
            if (byTicket.isPresent()) {
                return byTicket.get();
            }
        }

        // 3. By maintenanceRequestId and conversationType
        if (req.getMaintenanceRequestId() != null) {
            Optional<ChatConversation> byReqId = conversationRepository.findByMaintenanceRequestIdAndConversationType(req.getMaintenanceRequestId(), convType);
            if (byReqId.isPresent()) {
                return byReqId.get();
            }
        }

        // 4. Create new conversation connected to ticket
        ChatConversation conv = new ChatConversation();
        conv.setConversationType(convType);
        conv.setTicketNumber(ticketNum != null ? ticketNum : "TICKET-" + System.currentTimeMillis());
        conv.setTicketTitle(req.getTicketTitle() != null ? req.getTicketTitle() : "Maintenance Request");
        conv.setStatus("OPEN");
        conv.setMaintenanceRequestId(req.getMaintenanceRequestId());

        // Attempt to enrich from MaintenanceRequest entity if available
        if (ticketNum != null) {
            maintenanceRequestRepository.findByRequestNumber(ticketNum).ifPresent(mr -> {
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
            conv.setCustomerUnit(req.getSenderUnit() != null ? req.getSenderUnit() : "Flat A-101");
        }
        if (conv.getMaintenanceUserName() == null) {
            conv.setMaintenanceUserName(req.getSenderRole() != null && req.getSenderRole().equals("MAINTENANCE") ? req.getSenderName() : "Maintenance Crew");
        }
        if (conv.getAdminName() == null) {
            conv.setAdminName(req.getSenderRole() != null && req.getSenderRole().equals("ADMIN") ? req.getSenderName() : "Society Admin");
        }

        conv.setCreatedAt(LocalDateTime.now());
        conv.setUpdatedAt(LocalDateTime.now());
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
            messageRepository.markConversationAsRead(conv.getId(), readerRole);
        });
    }

    /**
     * Computes unread counts for navigation badges.
     */
    public UnreadCountSummary getUnreadSummary(String userRole) {
        long custUnread = 0;
        long adminUnread = 0;

        List<ChatConversation> custConvs = conversationRepository.findByConversationTypeOrderByUpdatedAtDesc("CUSTOMER_MAINTENANCE");
        for (ChatConversation c : custConvs) {
            custUnread += messageRepository.countByConversationIdAndSenderRoleNotAndIsReadFalse(c.getId(), userRole);
        }

        if (!"CUSTOMER".equalsIgnoreCase(userRole)) {
            List<ChatConversation> adminConvs = conversationRepository.findByConversationTypeOrderByUpdatedAtDesc("MAINTENANCE_ADMIN");
            for (ChatConversation c : adminConvs) {
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
