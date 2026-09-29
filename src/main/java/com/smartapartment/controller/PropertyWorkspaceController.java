package com.smartapartment.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PropertyWorkspaceController {
    @GetMapping({"/propertydirect/workspace", "/propertydirect/dashboards/owner", "/propertydirect/dashboards/builder"})
    public String workspace() { return "propertydirect/workspace"; }
}
