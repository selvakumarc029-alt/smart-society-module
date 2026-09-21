package com.smartapartment.entity;

import java.time.LocalTime;

public enum WorkerShift {
    MORNING("Morning Shift", LocalTime.of(6, 0), LocalTime.of(14, 0)),
    EVENING("Evening Shift", LocalTime.of(14, 0), LocalTime.of(22, 0)),
    NIGHT("Night Shift", LocalTime.of(22, 0), LocalTime.of(6, 0)),
    GENERAL("General Shift", LocalTime.of(9, 0), LocalTime.of(17, 0)),
    ALL_DAY("All Day / 24x7", LocalTime.of(0, 0), LocalTime.of(23, 59, 59));

    private final String displayName;
    private final LocalTime startTime;
    private final LocalTime endTime;

    WorkerShift(String displayName, LocalTime startTime, LocalTime endTime) {
        this.displayName = displayName;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    public String getDisplayName() {
        return displayName;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public boolean isWithinShift(LocalTime time) {
        if (time == null) return false;
        if (this == ALL_DAY) return true;
        if (startTime.isBefore(endTime)) {
            return !time.isBefore(startTime) && time.isBefore(endTime);
        } else {
            // Overnight shift e.g. 22:00 to 06:00
            return !time.isBefore(startTime) || time.isBefore(endTime);
        }
    }

    public static WorkerShift fromString(String text) {
        if (text == null || text.isBlank()) return GENERAL;
        String clean = text.trim().toUpperCase().replace(" ", "_");
        for (WorkerShift shift : values()) {
            if (shift.name().equalsIgnoreCase(clean) || shift.displayName.equalsIgnoreCase(text.trim())) {
                return shift;
            }
        }
        if (clean.contains("MORNING")) return MORNING;
        if (clean.contains("EVENING")) return EVENING;
        if (clean.contains("NIGHT")) return NIGHT;
        if (clean.contains("ALL") || clean.contains("24") || clean.contains("FLEX")) return ALL_DAY;
        return GENERAL;
    }
}
