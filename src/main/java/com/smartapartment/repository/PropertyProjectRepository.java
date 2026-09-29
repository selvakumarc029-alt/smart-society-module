package com.smartapartment.repository;
import com.smartapartment.entity.PropertyProject;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PropertyProjectRepository extends JpaRepository<PropertyProject, Long> {
    List<PropertyProject> findByBuilderIdOrderByCreatedAtDesc(Long builderId);
}
