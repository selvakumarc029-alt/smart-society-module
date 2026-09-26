package com.smartapartment.dto;

import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class HomeServicePackageDto {
    private Long id;
    private String category;
    private String subService;
    private String designation;
    private String packageName;
    private Double price;
    private String pricePrefix;
    private String rating;
    private String reviews;
    private String duration;
    private String optionsCount;
    private String features;
    private List<String> featureList;
    private String detailedSections;
    private String badge;
    private String thumbnail;
    private Boolean active;
}
