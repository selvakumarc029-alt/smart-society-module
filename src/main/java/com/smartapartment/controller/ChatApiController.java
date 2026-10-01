package com.smartapartment.controller;

import com.smartapartment.dto.ChatDtos.*;
import com.smartapartment.service.ChatService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatApiController {

    private final ChatService chatService;

    public ChatApiController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/messages")
    public ResponseEntity<List<ChatMessageResponse>> getMessages(
            @RequestParam(required = false) String conversationId,
            @RequestParam(required = false) String channelType,
            @RequestParam(required = false) String viewerRole,
            HttpSession session) {
        if (viewerRole == null || viewerRole.isBlank()) {
            if (session != null && Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:admin"))) {
                viewerRole = "ADMIN";
            } else if (session != null && Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:maintenance"))) {
                viewerRole = "MAINTENANCE";
            } else if (session != null && Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:resident"))) {
                viewerRole = "CUSTOMER";
            }
        }
        List<ChatMessageResponse> messages = chatService.getMessages(conversationId, channelType, viewerRole);
        return ResponseEntity.ok(messages);
    }

    @PostMapping("/send")
    public ResponseEntity<ChatMessageResponse> sendMessage(@RequestBody SendMessageRequest req, HttpSession session) {
        // Enrich sender info if missing
        if (req.getSenderRole() == null || req.getSenderRole().isBlank()) {
            if (session != null && Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:admin"))) {
                req.setSenderRole("ADMIN");
                if (req.getSenderName() == null) req.setSenderName("Society Admin");
            } else if (session != null && Boolean.TRUE.equals(session.getAttribute("dashboard:smartapartment:maintenance"))) {
                req.setSenderRole("MAINTENANCE");
                if (req.getSenderName() == null) req.setSenderName("Maintenance Desk");
            } else {
                req.setSenderRole("CUSTOMER");
                if (req.getSenderName() == null) req.setSenderName("Resident");
            }
        }

        ChatMessageResponse response = chatService.sendMessage(req);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/threads")
    public ResponseEntity<List<ConversationSummary>> getConversations(
            @RequestParam(defaultValue = "CUSTOMER_MAINTENANCE") String channelType,
            @RequestParam(defaultValue = "MAINTENANCE") String viewerRole) {
        List<ConversationSummary> threads = chatService.getConversations(channelType, viewerRole);
        return ResponseEntity.ok(threads);
    }

    @PostMapping("/mark-read")
    public ResponseEntity<Map<String, Object>> markAsRead(
            @RequestParam String conversationId,
            @RequestParam String readerRole) {
        chatService.markConversationAsRead(conversationId, readerRole);
        return ResponseEntity.ok(Map.of("success", true, "conversationId", conversationId));
    }

    @GetMapping("/ticket/{ticketNumber}")
    public ResponseEntity<List<ChatMessageResponse>> getMessagesByTicket(
            @PathVariable String ticketNumber,
            @RequestParam(defaultValue = "CUSTOMER_MAINTENANCE") String channelType,
            @RequestParam(defaultValue = "CUSTOMER") String viewerRole) {
        List<ChatMessageResponse> messages = chatService.getMessages(ticketNumber, channelType, viewerRole);
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/request/{requestId}")
    public ResponseEntity<List<ChatMessageResponse>> getMessagesByRequest(
            @PathVariable String requestId,
            @RequestParam(defaultValue = "CUSTOMER_MAINTENANCE") String channelType,
            @RequestParam(defaultValue = "CUSTOMER") String viewerRole) {
        List<ChatMessageResponse> messages = chatService.getMessages(requestId, channelType, viewerRole);
        return ResponseEntity.ok(messages);
    }
}
