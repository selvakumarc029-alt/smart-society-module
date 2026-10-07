package com.smartapartment.controller;

import com.smartapartment.entity.CMSContent;
import com.smartapartment.repository.CMSContentRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/platform/cms")
public class SuperAdminExtendedApiController {

    private final CMSContentRepository cmsRepository;

    public SuperAdminExtendedApiController(CMSContentRepository cmsRepository) {
        this.cmsRepository = cmsRepository;
    }

    @GetMapping("/{category}")
    public List<CMSContent> getByCategory(@PathVariable String category) {
        return cmsRepository.findByCategoryOrderByCreatedAtDesc(category.toUpperCase());
    }

    @PostMapping("/{category}")
    @Transactional
    public CMSContent createItem(@PathVariable String category, @Valid @RequestBody CMSItemRequest request) {
        CMSContent item = new CMSContent();
        item.setCategory(category.toUpperCase());
        item.setTitle(request.title());
        item.setContent(request.content());
        item.setExtraMeta(request.extraMeta());
        item.setActive(request.active());
        return cmsRepository.save(item);
    }

    @PutMapping("/{id}")
    @Transactional
    public CMSContent updateItem(@PathVariable Long id, @Valid @RequestBody CMSItemRequest request) {
        CMSContent item = cmsRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("CMS Content item not found"));
        item.setTitle(request.title());
        item.setContent(request.content());
        item.setExtraMeta(request.extraMeta());
        item.setActive(request.active());
        return cmsRepository.save(item);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, Object> deleteItem(@PathVariable Long id) {
        cmsRepository.deleteById(id);
        return Map.of("message", "Deleted successfully", "id", id);
    }

    public record CMSItemRequest(
            @NotBlank String title,
            String content,
            String extraMeta,
            boolean active
    ) {}
}
